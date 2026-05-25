import { NextResponse } from "next/server";
import { createClient } from "../../../lib/auth";
import { supabaseServer as supabase } from "../../../lib/supabase-server";
import { GARAGE61_API, g61Fetch } from "../../../lib/garage61";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const driverSlug = searchParams.get("driver_slug");

  if (!driverSlug) {
    return NextResponse.json({ error: "driver_slug_required" }, { status: 400 });
  }

  // Auth
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Get requesting user's driver + token
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

  // Get team slugs from /me — cache 1h (team membership rarely changes)
  const meResult = await g61Fetch(`${GARAGE61_API}/me`, token, driverId, refreshToken, { next: { revalidate: 3600 } });
  if (!meResult.ok) {
    if (meResult.status === 401) return NextResponse.json({ error: "token_expired" }, { status: 401 });
    return NextResponse.json({ error: "garage61_me_failed" }, { status: 502 });
  }
  const teams = meResult.data?.teams || [];
  if (teams.length === 0) {
    return NextResponse.json({ circuits: [] });
  }

  // Fetch track catalogue (1h cache) and team statistics (15 min cache) in parallel
  const [tracksResult, ...statsResults] = await Promise.all([
    g61Fetch(`${GARAGE61_API}/tracks?limit=2000`, token, driverId, refreshToken, { next: { revalidate: 3600 } }),
    ...teams.map((t) =>
      g61Fetch(`${GARAGE61_API}/teams/${t.slug}/statistics`, token, driverId, refreshToken, { next: { revalidate: 900 } })
    ),
  ]);

  if (!tracksResult.ok) {
    return NextResponse.json({ error: "garage61_tracks_failed" }, { status: 502 });
  }

  // Build track ID → track info map
  const trackMap = {};
  for (const t of tracksResult.data?.items || []) {
    trackMap[t.id] = t;
  }

  // Merge stats from all teams, filter to target driver slug, aggregate by track
  const circuitMap = {};
  for (const statsResult of statsResults) {
    if (!statsResult.ok) continue;
    for (const row of statsResult.data?.drivingStatistics || []) {
      if (row.user !== driverSlug) continue;
      const key = row.track;
      if (!circuitMap[key]) {
        circuitMap[key] = { trackId: row.track, totalLaps: 0, cleanLaps: 0, timeOnTrack: 0, sessionTypes: new Set() };
      }
      circuitMap[key].totalLaps += row.lapsDriven ?? 0;
      circuitMap[key].cleanLaps += row.cleanLapsDriven ?? 0;
      circuitMap[key].timeOnTrack += row.timeOnTrack ?? 0;
      if (row.sessionType) circuitMap[key].sessionTypes.add(row.sessionType);
    }
  }

  // Collect iRacing track IDs to look up categories
  const iracingTrackIds = Object.values(circuitMap)
    .map((c) => trackMap[c.trackId])
    .filter((t) => t?.platform === "iracing")
    .map((t) => String(t.platform_id));

  const { data: iracingTracksData } = iracingTrackIds.length > 0
    ? await supabase
        .from("iracing_tracks")
        .select("iracing_track_id, track_category")
        .in("iracing_track_id", iracingTrackIds)
    : { data: [] };

  const iracingCategoryMap = {};
  for (const t of iracingTracksData || []) {
    iracingCategoryMap[String(t.iracing_track_id)] = t.track_category;
  }

  // Resolve track names, categories, and sort by total laps descending
  const circuits = Object.values(circuitMap)
    .map((c) => {
      const track = trackMap[c.trackId];
      const iracingTrackId = track?.platform === "iracing" ? track.platform_id : null;
      return {
        trackId: c.trackId,
        name: track?.name ?? `Track ${c.trackId}`,
        variant: track?.variant ?? null,
        iracingTrackId,
        category: iracingTrackId ? (iracingCategoryMap[String(iracingTrackId)] ?? null) : null,
        totalLaps: c.totalLaps,
        cleanLaps: c.cleanLaps,
        timeOnTrack: Math.round(c.timeOnTrack),
        cleanPct: c.totalLaps > 0 ? Math.round((c.cleanLaps / c.totalLaps) * 100) : 0,
        sessionTypes: [...c.sessionTypes].sort(),
      };
    })
    .filter((c) => c.totalLaps > 0)
    .sort((a, b) => b.totalLaps - a.totalLaps);

  return NextResponse.json({ circuits });
}
