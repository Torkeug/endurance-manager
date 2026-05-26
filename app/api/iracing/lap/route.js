import { NextResponse } from "next/server";
import { supabaseServer as supabase } from "../../../../lib/supabase-server";

const API_KEY = process.env.IRACING_BRIDGE_API_KEY;

export async function POST(request) {
  // Authenticate bridge request
  const authHeader = request.headers.get("authorization");
  if (API_KEY && authHeader !== `Bearer ${API_KEY}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    iracing_cust_id,
    track_id,
    car_id,
    session_type,
    lap_time,
    fuel_level,
    fuel_used,
    track_wetness_raw,
    weather_declared_wet,
    track_temp,
    air_temp,
    precipitation,
    solar_altitude,
    session_time_of_day,
    is_night,
    on_pit_road,
    under_caution,
    recorded_at,
  } = body;

  // Validate required fields
  if (!iracing_cust_id || !track_id || !lap_time || !recorded_at) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Resolve driver_id from iracing_cust_id
  const { data: driver } = await supabase
    .from("drivers")
    .select("id")
    .eq("iracing_id", String(iracing_cust_id))
    .single();

  const { error } = await supabase.from("iracing_laps").insert({
    driver_id: driver?.id ?? null,
    iracing_cust_id,
    track_id,
    car_id,
    session_type,
    lap_time,
    fuel_level,
    fuel_used,
    track_wetness_raw,
    weather_declared_wet,
    track_temp,
    air_temp,
    precipitation,
    solar_altitude,
    session_time_of_day,
    is_night,
    on_pit_road: on_pit_road ?? false,
    under_caution: under_caution ?? false,
    recorded_at,
  });

  if (error) {
    console.error("[iracing/lap] insert error:", error.message);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
