import { NextResponse } from "next/server";
import { supabaseServer as supabase } from "../../../../lib/supabase-server";

const STALE_THRESHOLD_MS = 100 * 24 * 60 * 60 * 1000;
const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const staleThresholdDate = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString();

  const { data: drivers, error } = await supabase
    .from("drivers")
    .select("id, name, email, last_driver_sync_at, stale_sync_notified_at")
    .eq("approved", true)
    .eq("active", true)
    .neq("role", "engineer")
    .eq("is_test_account", false)
    .or(`last_driver_sync_at.is.null,last_driver_sync_at.lt.${staleThresholdDate}`);

  if (error) {
    console.error("[cron/check-stale-syncs] fetch error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const now = new Date().toISOString();
  let notified = 0;

  for (const driver of drivers || []) {
    if (!driver.email) continue;

    const canNotify =
      !driver.stale_sync_notified_at ||
      Date.now() - new Date(driver.stale_sync_notified_at).getTime() > COOLDOWN_MS;

    if (!canNotify) continue;

    const profileUrl = `${process.env.NEXT_PUBLIC_APP_URL}/pilotes/${driver.id}`;

    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/notify-stale-sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        driver_name: driver.name,
        driver_email: driver.email,
        profile_url: profileUrl,
      }),
    }).catch((e) =>
      console.error(`[cron/check-stale-syncs] notify failed for ${driver.id}:`, e),
    );

    await supabase
      .from("drivers")
      .update({ stale_sync_notified_at: now })
      .eq("id", driver.id);

    notified++;
  }

  console.log(`[cron/check-stale-syncs] notified ${notified} driver(s)`);
  return NextResponse.json({ notified });
}
