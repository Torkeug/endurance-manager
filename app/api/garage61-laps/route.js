import { NextResponse } from "next/server";
import { createClient } from "../../../lib/auth";
import { supabaseServer as supabase } from "../../../lib/supabase-server";
import { GARAGE61_API, g61Fetch } from "../../../lib/garage61";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const driverSlug = searchParams.get("driver_slug");
  const trackId = searchParams.get("track_id");

  if (!driverSlug || !trackId) {
    return NextResponse.json({ error: "driver_slug and track_id required" }, { status: 400 });
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

  const { garage61_access_token: token, garage61_refresh_token: refreshToken, id: driverId } = requestingDriver;

  // Get teams — cache 1h
  const meResult = await g61Fetch(`${GARAGE61_API}/me`, token, driverId, refreshToken, { next: { revalidate: 3600 } });
  if (!meResult.ok) {
    if (meResult.status === 401) return NextResponse.json({ error: "token_expired" }, { status: 401 });
    return NextResponse.json({ error: "garage61_me_failed" }, { status: 502 });
  }
  const teams = meResult.data?.teams || [];
  if (teams.length === 0) return NextResponse.json({ lap: null });

  // Fetch best lap per driver for this track across all teams — cache 15 min
  const lapsResults = await Promise.all(
    teams.map((t) =>
      g61Fetch(
        `${GARAGE61_API}/laps?teams=${encodeURIComponent(t.slug)}&tracks=${encodeURIComponent(trackId)}&group=driver&limit=200`,
        token, driverId, refreshToken,
        { next: { revalidate: 900 } }
      )
    )
  );

  // Find target driver's best lap across all teams
  let bestLap = null;
  for (const result of lapsResults) {
    if (!result.ok) continue;
    const lap = (result.data?.items || []).find((l) => l.driver?.slug === driverSlug);
    if (lap && (!bestLap || lap.lapTime < bestLap.lapTime)) {
      bestLap = lap;
    }
  }

  if (!bestLap) return NextResponse.json({ lap: null });

  return NextResponse.json({
    lap: {
      lapTime: bestLap.lapTime,
      car: bestLap.car?.name ?? null,
      sessionType: bestLap.sessionType,
      clean: bestLap.clean,
      wet: (bestLap.trackWetness ?? 0) > 0,
      date: bestLap.startTime,
    },
  });
}
