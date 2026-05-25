import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/auth";
import { supabaseServer as supabase } from "../../../../lib/supabase-server";
import { GARAGE61_API, g61Fetch } from "../../../../lib/garage61";

export async function GET() {
  // Admin only
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: requestingDriver } = await supabase
    .from("drivers")
    .select("id, role")
    .eq("auth_user_id", user.id)
    .single();

  if (!["admin", "super_admin"].includes(requestingDriver?.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Use the configured detection account if set, otherwise fall back to the requesting driver.
  // The detection account should belong to someone who is a member of all Garage61 teams.
  const { data: configRow } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "garage61_detection_driver_id")
    .maybeSingle();

  const detectionDriverId = configRow?.value || requestingDriver.id;

  const { data: detectionDriver } = await supabase
    .from("drivers")
    .select("id, name, garage61_access_token, garage61_refresh_token")
    .eq("id", detectionDriverId)
    .single();

  if (!detectionDriver?.garage61_access_token) {
    return NextResponse.json({ error: "not_linked" }, { status: 400 });
  }

  const token = detectionDriver.garage61_access_token;
  const refreshToken = detectionDriver.garage61_refresh_token;
  const driverId = detectionDriver.id;

  // Get teams the detection account belongs to
  const meResult = await g61Fetch(`${GARAGE61_API}/me`, token, driverId, refreshToken, { next: { revalidate: 3600 } });
  if (!meResult.ok) {
    if (meResult.status === 401) return NextResponse.json({ error: "token_expired" }, { status: 401 });
    return NextResponse.json({ error: "garage61_me_failed" }, { status: 502 });
  }
  const teamSlugs = (meResult.data?.teams || []).map((t) => t.slug);
  if (teamSlugs.length === 0) return NextResponse.json({ drivers: [] });

  // For each team: fetch statistics to find the top tracks by laps, then
  // fetch /laps?group=driver per top track to get slug + display name.
  // /laps?group=driver requires a tracks param — statistics gives us valid track IDs.
  const seen = new Set();
  const g61Drivers = [];

  for (const slug of teamSlugs) {
    const statsResult = await g61Fetch(
      `${GARAGE61_API}/teams/${slug}/statistics`,
      token, driverId, refreshToken,
      { next: { revalidate: 900 } },
    );
    if (!statsResult.ok) continue;

    // Aggregate total laps per track across all drivers
    const lapsByTrack = new Map();
    for (const row of statsResult.data?.drivingStatistics || []) {
      lapsByTrack.set(row.track, (lapsByTrack.get(row.track) || 0) + (row.lapsDriven || 0));
    }
    if (lapsByTrack.size === 0) continue;

    // Pick top 3 tracks — enough to cover all team members in practice
    const topTracks = [...lapsByTrack.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([trackId]) => trackId);

    // Fetch best lap per driver for each top track — gives slug + display name
    const lapsResults = await Promise.all(
      topTracks.map((trackId) =>
        g61Fetch(
          `${GARAGE61_API}/laps?teams=${encodeURIComponent(slug)}&tracks=${encodeURIComponent(trackId)}&group=driver&limit=200`,
          token, driverId, refreshToken,
          { next: { revalidate: 900 } },
        )
      )
    );

    for (const result of lapsResults) {
      if (!result.ok) continue;
      for (const item of result.data?.items || []) {
        const driverSlug = item.driver?.slug;
        if (driverSlug && !seen.has(driverSlug)) {
          seen.add(driverSlug);
          const d = item.driver;
          const name = [d?.firstName, d?.lastName].filter(Boolean).join(" ") || driverSlug;
          g61Drivers.push({ slug: driverSlug, name });
        }
      }
    }
  }

  return NextResponse.json({ drivers: g61Drivers });
}
