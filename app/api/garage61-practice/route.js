import { NextResponse } from "next/server";
import { createClient } from "../../../lib/auth";
import { supabaseServer as supabase } from "../../../lib/supabase-server";

const GARAGE61_API = "https://garage61.net/api/v1";
const CLIENT_ID = "01KSEXK2MP3Q4T2219885XN17V";
const GARAGE61_TOKEN_URL = "https://garage61.net/api/oauth/token";

async function tryRefreshToken(driverId, storedRefreshToken) {
  if (!storedRefreshToken) return null;
  try {
    const res = await fetch(GARAGE61_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: storedRefreshToken,
        client_id: CLIENT_ID,
        client_secret: process.env.GARAGE61_CLIENT_SECRET,
      }),
    });
    if (!res.ok) return null;
    const { access_token, refresh_token: newRefreshToken } = await res.json();
    if (!access_token) return null;
    await supabase
      .from("drivers")
      .update({
        garage61_access_token: access_token,
        garage61_refresh_token: newRefreshToken ?? storedRefreshToken,
      })
      .eq("id", driverId);
    return access_token;
  } catch {
    return null;
  }
}

async function g61Fetch(url, token, driverId, refreshToken, fetchOptions = {}) {
  const res = await fetch(url, { ...fetchOptions, headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401 && refreshToken) {
    const newToken = await tryRefreshToken(driverId, refreshToken);
    if (!newToken) return { ok: false, status: 401, data: null };
    const retry = await fetch(url, { headers: { Authorization: `Bearer ${newToken}` } });
    return { ok: retry.ok, status: retry.status, data: retry.ok ? await retry.json() : null };
  }
  return { ok: res.ok, status: res.status, data: res.ok ? await res.json() : null };
}

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

  // Get requesting user's driver + token (they provide the token for team calls)
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

  // Get team slugs from /me
  const meResult = await g61Fetch(`${GARAGE61_API}/me`, token, driverId, refreshToken);
  if (!meResult.ok) {
    if (meResult.status === 401) return NextResponse.json({ error: "token_expired" }, { status: 401 });
    return NextResponse.json({ error: "garage61_me_failed" }, { status: 502 });
  }
  const teams = meResult.data?.teams || [];
  if (teams.length === 0) {
    return NextResponse.json({ circuits: [] });
  }

  // Fetch track catalogue and team statistics in parallel across all teams
  const [tracksResult, ...statsResults] = await Promise.all([
    g61Fetch(`${GARAGE61_API}/tracks?limit=2000`, token, driverId, refreshToken, { next: { revalidate: 3600 } }),
    ...teams.map((t) =>
      g61Fetch(`${GARAGE61_API}/teams/${t.slug}/statistics`, token, driverId, refreshToken)
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
