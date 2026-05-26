import { NextResponse } from "next/server";
import { supabaseServer as supabase } from "../../../../lib/supabase-server";

const API_KEY = process.env.IRACING_BRIDGE_API_KEY;

export async function POST(request) {
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

  const { event_type, iracing_cust_id, track_id, payload, recorded_at } = body;

  if (!event_type || !track_id || !recorded_at) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data: driver } = await supabase
    .from("drivers")
    .select("id")
    .eq("iracing_id", String(iracing_cust_id))
    .single();

  const { error } = await supabase.from("iracing_events").insert({
    event_type,
    iracing_cust_id,
    driver_id: driver?.id ?? null,
    track_id,
    payload: payload ?? {},
    recorded_at,
  });

  if (error) {
    console.error("[iracing/event] insert error:", error.message);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
