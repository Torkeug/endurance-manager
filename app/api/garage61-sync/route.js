import { NextResponse } from "next/server";
import { createClient } from "../../../lib/auth";
import { supabaseServer as supabase } from "../../../lib/supabase-server";

const GARAGE61_API = "https://garage61.net/api/v1";
const CLIENT_ID = "01KSEXK2MP3Q4T2219885XN17V";
const GARAGE61_TOKEN_URL = "https://garage61.net/api/oauth/token";

// Attempt to refresh an expired Garage61 access token.
// On success: updates the DB and returns the new access token string.
// On failure: returns null.
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

// Fetch with automatic token refresh on 401.
// Returns { ok, status, data } — data is the parsed JSON or null on error.
async function garage61Fetch(url, token, driverId, refreshTokenValue) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401 && refreshTokenValue) {
    const newToken = await tryRefreshToken(driverId, refreshTokenValue);
    if (!newToken) return { ok: false, status: 401, data: null };
    const retry = await fetch(url, {
      headers: { Authorization: `Bearer ${newToken}` },
    });
    return {
      ok: retry.ok,
      status: retry.status,
      data: retry.ok ? await retry.json() : null,
    };
  }
  return {
    ok: res.ok,
    status: res.status,
    data: res.ok ? await res.json() : null,
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const iracingTrackId = searchParams.get("iracing_track_id");
  const targetDriverId = searchParams.get("driver_id"); // optional — admin use

  if (!iracingTrackId) {
    return NextResponse.json(
      { error: "iracing_track_id_required" },
      { status: 400 },
    );
  }

  // Auth — must be logged in
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Fetch the requesting user's driver record (needed for role check)
  const { data: requestingDriver } = await supabase
    .from("drivers")
    .select("id, role, garage61_access_token, garage61_refresh_token")
    .eq("auth_user_id", user.id)
    .single();

  if (!requestingDriver) {
    return NextResponse.json({ error: "driver_not_found" }, { status: 404 });
  }

  // Resolve which driver's laps to fetch.
  // Any authenticated team member can pull laps for any other driver —
  // the target driver consented when they linked their Garage61 account.
  let targetDriver = requestingDriver;
  if (targetDriverId && targetDriverId !== requestingDriver.id) {
    const { data: other } = await supabase
      .from("drivers")
      .select("id, garage61_access_token, garage61_refresh_token")
      .eq("id", targetDriverId)
      .single();
    if (!other) {
      return NextResponse.json(
        { error: "target_driver_not_found" },
        { status: 404 },
      );
    }
    targetDriver = other;
  }

  if (!targetDriver.garage61_access_token) {
    return NextResponse.json({ error: "not_linked" }, { status: 400 });
  }

  const token = targetDriver.garage61_access_token;
  const refreshToken = targetDriver.garage61_refresh_token;
  const driverId = targetDriver.id;

  // ── Resolve iRacing track ID → Garage61 track ID ────────────────────────
  const tracksResult = await garage61Fetch(
    `${GARAGE61_API}/tracks?limit=2000`,
    token,
    driverId,
    refreshToken,
  );
  if (!tracksResult.ok) {
    if (tracksResult.status === 401) {
      return NextResponse.json({ error: "token_expired" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "garage61_tracks_failed" },
      { status: 502 },
    );
  }

  const g61Track = (tracksResult.data?.items || []).find(
    (t) =>
      t.platform === "iracing" &&
      String(t.platform_id) === String(iracingTrackId),
  );
  if (!g61Track) {
    return NextResponse.json(
      { error: "track_not_found", iracingTrackId },
      { status: 404 },
    );
  }

  // ── Fetch laps ────────────────────────────────────────────────────────────
  const lapsResult = await garage61Fetch(
    `${GARAGE61_API}/laps?drivers=me&tracks=${g61Track.id}&group=none&limit=200`,
    token,
    driverId,
    refreshToken,
  );
  if (!lapsResult.ok) {
    if (lapsResult.status === 401) {
      return NextResponse.json({ error: "token_expired" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "garage61_laps_failed" },
      { status: 502 },
    );
  }

  // Return only the fields needed by the UI — tokens never leave the server
  const laps = (lapsResult.data?.items || []).map((lap) => ({
    id: lap.id,
    lapTime: lap.lapTime, // seconds (float)
    startTime: lap.startTime, // ISO date-time
    car: lap.car?.name ?? null,
    sessionType: lap.sessionType, // 1=Practice 2=Qualifying 3=Race
    trackWetness: lap.trackWetness ?? 0,
    precipitation: lap.precipitation ?? 0,
    clean: lap.clean ?? false,
    fuelUsed: lap.fuelUsed ?? null, // litres per lap — null if Garage61 doesn't provide it
    isDaylight: lap.isDaylight ?? null, // true=day false=night null=unknown
  }));

  return NextResponse.json({
    track: {
      id: g61Track.id,
      name: g61Track.name,
      variant: g61Track.variant,
    },
    laps,
    total: lapsResult.data?.total ?? laps.length,
  });
}
