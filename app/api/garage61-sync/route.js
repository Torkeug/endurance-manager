import { NextResponse } from "next/server";
import { createClient } from "../../../lib/auth";
import { supabaseServer as supabase } from "../../../lib/supabase-server";
import { GARAGE61_API, g61Fetch } from "../../../lib/garage61";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const iracingTrackId = searchParams.get("iracing_track_id");
  const targetDriverId = searchParams.get("driver_id"); // optional — fetch for another driver

  if (!iracingTrackId) {
    return NextResponse.json({ error: "iracing_track_id_required" }, { status: 400 });
  }

  // Auth
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: requestingDriver } = await supabase
    .from("drivers")
    .select("id, garage61_access_token, garage61_refresh_token")
    .eq("auth_user_id", user.id)
    .single();

  if (!requestingDriver?.garage61_access_token) {
    return NextResponse.json({ error: "not_linked" }, { status: 400 });
  }

  const token = requestingDriver.garage61_access_token;
  const refreshToken = requestingDriver.garage61_refresh_token;
  const driverId = requestingDriver.id;

  // For other drivers: use their own token (drivers=me) if they have one linked —
  // this returns all their personal laps, not just team sessions.
  // Fall back to team-filtered laps if they haven't linked their account.
  let targetToken = null;      // non-null → use target's own token with drivers=me
  let targetRefreshToken = null;
  let targetDriverDbId = null;
  let targetSlug = null;       // non-null → team approach, filter by slug

  if (targetDriverId && targetDriverId !== requestingDriver.id) {
    const { data: targetDriver } = await supabase
      .from("drivers")
      .select("id, garage61_slug, garage61_access_token, garage61_refresh_token")
      .eq("id", targetDriverId)
      .single();
    if (!targetDriver) {
      return NextResponse.json({ error: "target_driver_not_found" }, { status: 404 });
    }
    if (!targetDriver.garage61_slug && !targetDriver.garage61_access_token) {
      return NextResponse.json({ error: "not_linked" }, { status: 400 });
    }
    if (targetDriver.garage61_access_token) {
      targetToken = targetDriver.garage61_access_token;
      targetRefreshToken = targetDriver.garage61_refresh_token;
      targetDriverDbId = targetDriver.id;
    } else {
      targetSlug = targetDriver.garage61_slug;
    }
  }

  // ── Resolve iRacing track ID → Garage61 track ID ────────────────────────
  const tracksResult = await g61Fetch(
    `${GARAGE61_API}/tracks?limit=2000`,
    token, driverId, refreshToken,
    { next: { revalidate: 3600 } },
  );
  if (!tracksResult.ok) {
    if (tracksResult.status === 401) return NextResponse.json({ error: "token_expired" }, { status: 401 });
    return NextResponse.json({ error: "garage61_tracks_failed" }, { status: 502 });
  }

  const g61Track = (tracksResult.data?.items || []).find(
    (t) => t.platform === "iracing" && String(t.platform_id) === String(iracingTrackId),
  );
  if (!g61Track) {
    return NextResponse.json({ error: "track_not_found", iracingTrackId }, { status: 404 });
  }

  // ── Fetch laps ────────────────────────────────────────────────────────────
  let lapsItems;

  if (!targetSlug && !targetToken) {
    // Own laps — use requesting user's token with drivers=me
    const lapsResult = await g61Fetch(
      `${GARAGE61_API}/laps?drivers=me&tracks=${g61Track.id}&group=none&limit=500`,
      token, driverId, refreshToken,
    );
    if (!lapsResult.ok) {
      if (lapsResult.status === 401) return NextResponse.json({ error: "token_expired" }, { status: 401 });
      return NextResponse.json({ error: "garage61_laps_failed" }, { status: 502 });
    }
    lapsItems = lapsResult.data?.items || [];
  } else if (targetToken) {
    // Other driver with linked account — use their own token with drivers=me
    const lapsResult = await g61Fetch(
      `${GARAGE61_API}/laps?drivers=me&tracks=${g61Track.id}&group=none&limit=500`,
      targetToken, targetDriverDbId, targetRefreshToken,
    );
    if (!lapsResult.ok) {
      if (lapsResult.status === 401) return NextResponse.json({ error: "token_expired" }, { status: 401 });
      return NextResponse.json({ error: "garage61_laps_failed" }, { status: 502 });
    }
    lapsItems = lapsResult.data?.items || [];
  } else {
    // Other driver without linked account — fetch team laps and filter by slug.
    // The teams= parameter returns ALL laps from team members (personal + races),
    // not restricted to specific sessions. We paginate until total is exhausted.
    const meResult = await g61Fetch(
      `${GARAGE61_API}/me`, token, driverId, refreshToken,
      { next: { revalidate: 3600 } },
    );
    if (!meResult.ok) {
      if (meResult.status === 401) return NextResponse.json({ error: "token_expired" }, { status: 401 });
      return NextResponse.json({ error: "garage61_me_failed" }, { status: 502 });
    }
    const teams = meResult.data?.teams || [];
    if (teams.length === 0) return NextResponse.json({ laps: [], total: 0 });

    lapsItems = [];
    const PAGE = 1000;

    for (const t of teams) {
      const url = (offset) =>
        `${GARAGE61_API}/laps?teams=${encodeURIComponent(t.slug)}&tracks=${encodeURIComponent(g61Track.id)}&group=none&limit=${PAGE}&offset=${offset}`;

      // Team laps pages are team-global (not user-specific) so cache them for
      // 15 min — subsequent lookups for other drivers on the same team+track
      // reuse the cached pages and make zero additional API calls.
      const cacheOpts = { next: { revalidate: 900 } };

      // First page — establishes the total so we know how many more to fetch
      const first = await g61Fetch(url(0), token, driverId, refreshToken, cacheOpts);
      if (!first.ok) continue;
      const total = first.data?.total ?? 0;
      const extraPages = Math.max(0, Math.ceil(total / PAGE) - 1);

      // Remaining pages in parallel
      const rest = extraPages > 0
        ? await Promise.all(
            Array.from({ length: extraPages }, (_, i) =>
              g61Fetch(url((i + 1) * PAGE), token, driverId, refreshToken, cacheOpts)
            )
          )
        : [];

      const allItems = [
        ...(first.data?.items || []),
        ...rest.flatMap((r) => r.ok ? (r.data?.items || []) : []),
      ];
      lapsItems.push(...allItems.filter((l) => l.driver?.slug === targetSlug));
    }
  }

  const laps = lapsItems.map((lap) => ({
    id: lap.id,
    lapTime: lap.lapTime,
    startTime: lap.startTime,
    car: lap.car?.name ?? null,
    sessionType: lap.sessionType,
    trackWetness: lap.trackWetness ?? 0,
    precipitation: lap.precipitation ?? 0,
    fuelUsed: lap.fuelUsed ?? null,
    fuelLevel: lap.fuelLevel ?? null,
    trackTemp: lap.trackTemp ?? null,
  }));

  return NextResponse.json({
    track: { id: g61Track.id, name: g61Track.name, variant: g61Track.variant },
    laps,
    total: laps.length,
  });
}
