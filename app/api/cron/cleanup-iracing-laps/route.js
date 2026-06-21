import { NextResponse } from "next/server";
import { supabaseServer as supabase } from "../../../../lib/supabase-server";

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  const CRON_SECRET = process.env.CRON_SECRET;
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);

  const { error, count } = await supabase
    .from("iracing_laps")
    .delete({ count: "exact" })
    .lt("recorded_at", cutoff.toISOString());

  if (error) {
    console.error("[cron/cleanup-iracing-laps]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log(`[cron/cleanup-iracing-laps] deleted ${count} rows`);
  return NextResponse.json({ deleted: count });
}
