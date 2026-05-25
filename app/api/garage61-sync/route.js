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

  // For other drivers: resolve their garage61_slug — the requesting user's token
  // is used to fetch team laps, then filtered by the target driver's slug.
  // This works even if the target driver's own token has expired or been revoked.
  let targetSlug = null; // null means "self" — use drivers=me
  if (targetDriverId && targetDriverId !== requestingDriver.id) {
    const { data: targetDriver } = await supabase
      .from("drivers")
      .select("id, garage61_slug")
      .eq("id", targetDriverId)
      .single();
    if (!targetDriver) {
      return NextResponse.json({ error: "target_driver_not_found" }, { status: 404 });
    }
    if (!targetDriver.garage61_slug) {
      return NextResponse.json({ error: "not_linked" }, { status: 400 });
    }
    targetSlug = targetDriver.garage61_slug;
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

  if (!targetSlug) {
    // Own data — drivers=me returns only the requesting user's laps directly
    const lapsResult = await g61Fetch(
      `${GARAGE61_API}/laps?drivers=me&tracks=${g61Track.id}&group=none&limit=200`,
      token, driverId, refreshToken,
    );
    if (!lapsResult.ok) {
      if (lapsResult.status === 401) return NextResponse.json({ error: "token_expired" }, { status: 401 });
      return NextResponse.json({ error: "garage61_laps_failed" }, { status: 502 });
    }
    lapsItems = lapsResult.data?.items || [];
  } else {
    // Other driver — fetch team laps and filter by their slug.
    // drivers= filter only accepts "me"; slug filtering must be done server-side.
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

    const teamResults = await Promise.all(
      teams.map((t) =>
        g61Fetch(
          `${GARAGE61_API}/laps?teams=${encodeURIComponent(t.slug)}&tracks=${encodeURIComponent(g61Track.id)}&group=none&limit=200`,
          token, driverId, refreshToken,
        )
      )
    );

    lapsItems = teamResults
      .filter((r) => r.ok)
      .flatMap((r) => (r.data?.items || []).filter((l) => l.driver?.slug === targetSlug));
  }

  const laps = lapsItems.map((lap) => ({
    id: lap.id,
    lapTime: lap.lapTime,
    startTime: lap.startTime,
    car: lap.car?.name ?? null,
    sessionType: lap.sessionType,
    trackWetness: lap.trackWetness ?? 0,
    precipitation: lap.precipitation ?? 0,
    clean: lap.clean ?? false,
    fuelUsed: lap.fuelUsed ?? null,
    isDaylight: lap.isDaylight ?? null,
  }));

  return NextResponse.json({
    track: { id: g61Track.id, name: g61Track.name, variant: g61Track.variant },
    laps,
    total: laps.length,
  });
}
