import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/auth";
import { supabaseServer as supabase } from "../../../../lib/supabase-server";

const IRACING_TOKEN_URL = "https://oauth.iracing.com/oauth2/token";
const IRACING_PROFILE_URL = "https://oauth.iracing.com/oauth2/iracing/profile";
const IRACING_DATA_BASE = "https://members-ng.iracing.com";
const CLIENT_ID = "kronos-team";
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback/iracing`;

// ─── Helpers ────────────────────────────────────────────────────────────────

// iRacing data endpoints return a { link } pointing to S3 — two-step fetch.
async function fetchIracingS3(path, token) {
  const res = await fetch(`${IRACING_DATA_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`iRacing API ${path}: ${res.status}`);
  const { link } = await res.json();
  const s3Res = await fetch(link);
  if (!s3Res.ok) throw new Error(`S3 fetch for ${path}: ${s3Res.status}`);
  return s3Res.json();
}

// ─── Backfill iRating history ────────────────────────────────────────────────
// Fetches FULL historical iRating data for all 6 categories.
// Only runs once per driver — skipped if any history already exists.

async function backfillIratingHistory(token, driverId, iracingCustId) {
  const { count } = await supabase
    .from("irating_history")
    .select("id", { count: "exact", head: true })
    .eq("driver_id", driverId);

  if (count > 0) return;

  const categoryIds = [1, 2, 3, 4, 5, 6];
  await Promise.all(
    categoryIds.map(async (categoryId) => {
      try {
        const chartData = await fetchIracingS3(
          `/data/member/chart_data?cust_id=${iracingCustId}&category_id=${categoryId}&chart_type=1`,
          token,
        );

        if (!chartData?.success || !Array.isArray(chartData.data)) return;

        const rows = chartData.data
          .filter((p) => typeof p.value === "number" && p.when)
          .map((p) => ({
            driver_id: driverId,
            irating: p.value,
            category_id: categoryId,
            recorded_at: new Date(p.when).toISOString(),
          }));

        if (rows.length === 0) return;

        for (let i = 0; i < rows.length; i += 100) {
          await supabase.from("irating_history").insert(rows.slice(i, i + 100));
        }
      } catch (err) {
        console.error(
          `iRating history backfill failed for driver ${driverId} category ${categoryId}:`,
          err.message,
        );
      }
    }),
  );
}

// ─── Sync latest iRating for all categories ──────────────────────────────────
// Fetches the most recent iRating point for all 6 categories and inserts it.
// Called on every sync — both driver mode and syncall.

async function syncAllCategoryIratings(token, driverId, iracingCustId) {
  const categoryIds = [1, 2, 3, 4, 5, 6];
  await Promise.all(
    categoryIds.map(async (categoryId) => {
      try {
        const chartData = await fetchIracingS3(
          `/data/member/chart_data?cust_id=${iracingCustId}&category_id=${categoryId}&chart_type=1`,
          token,
        );

        if (
          !chartData?.success ||
          !Array.isArray(chartData.data) ||
          chartData.data.length === 0
        )
          return;

        // Only insert the most recent point
        const latest = chartData.data[chartData.data.length - 1];
        if (typeof latest.value !== "number") return;

        const recordedAt = new Date(latest.when).toISOString();

        // Skip if this exact point already exists — avoids duplicates on repeated syncs
        const { count } = await supabase
          .from("irating_history")
          .select("id", { count: "exact", head: true })
          .eq("driver_id", driverId)
          .eq("category_id", categoryId)
          .eq("recorded_at", recordedAt);

        if (count > 0) return;

        await supabase.from("irating_history").insert({
          driver_id: driverId,
          irating: latest.value,
          category_id: categoryId,
          recorded_at: recordedAt,
        });
      } catch (err) {
        console.error(
          `Category ${categoryId} iRating sync failed for driver ${driverId}:`,
          err.message,
        );
      }
    }),
  );
}

// Build Map<car_id → { car_name, car_category, car_types }> from /data/car/get.
// Also upserts the full iRacing car catalog into iracing_cars for admin use.
async function buildCarLookup(token) {
  const cars = await fetchIracingS3("/data/car/get", token);

  const carRows = cars.map((car) => ({
    iracing_car_id: car.car_id,
    car_name: car.car_name,
    car_categories: car.categories || [],
    car_types: (car.car_types || []).map((t) => t.car_type),
    free_with_subscription: car.free_with_subscription ?? false,
  }));
  for (let i = 0; i < carRows.length; i += 100) {
    await supabase
      .from("iracing_cars")
      .upsert(carRows.slice(i, i + 100), { onConflict: "iracing_car_id" });
  }

  const map = new Map();
  for (const car of cars) {
    map.set(car.car_id, {
      car_name: car.car_name,
      car_category: (car.categories || [])[0] || null,
      car_types: (car.car_types || []).map((t) => t.car_type),
    });
  }
  return map;
}

// Build Map<track_id → { track_name, track_config, track_category }> from /data/track/get.
// Also upserts the full iRacing track catalog into iracing_tracks for admin use.
async function buildTrackLookup(token) {
  const tracks = await fetchIracingS3("/data/track/get", token);

  const trackRows = tracks.map((track) => ({
    iracing_track_id: track.track_id,
    track_name: track.track_name,
    config_name: track.config_name || null,
    track_category: track.category || null,
    free_with_subscription: track.free_with_subscription ?? false,
  }));
  for (let i = 0; i < trackRows.length; i += 100) {
    await supabase
      .from("iracing_tracks")
      .upsert(trackRows.slice(i, i + 100), { onConflict: "iracing_track_id" });
  }

  const map = new Map();
  for (const track of tracks) {
    map.set(track.track_id, {
      track_name: track.track_name,
      track_config: track.config_name || null,
      track_category: track.category || null,
    });
  }
  return map;
}

// Sync one driver's iRating + car/track ownership from iRacing.
// Used in driver mode only — requires the driver's own access token.
async function syncOneDriver(
  token,
  driverId,
  iracingCustId,
  carLookup,
  trackLookup,
) {
  const memberData = await fetchIracingS3(
    `/data/member/info?cust_id=${iracingCustId}`,
    token,
  );

  // Sports car iRating — licenses is a keyed object, not an array
  const irating = memberData.licenses?.sports_car?.irating ?? null;

  const ownedCarIds = new Set(
    (memberData.car_packages || []).flatMap((pkg) => pkg.content_ids || []),
  );
  const ownedTrackIds = new Set(
    (memberData.track_packages || []).flatMap((pkg) => pkg.content_ids || []),
  );

  const now = new Date().toISOString();

  // Update iRating and both sync timestamps on the driver record.
  // last_driver_sync_at tracks driver-mode syncs only (inventory + iRating) —
  // used for staleness detection. iracing_synced_at is updated by both modes.
  await supabase
    .from("drivers")
    .update({ irating, iracing_synced_at: now, last_driver_sync_at: now })
    .eq("id", driverId);

  // Backfill full history on first sync, then record latest for all categories
  await backfillIratingHistory(token, driverId, iracingCustId);
  await syncAllCategoryIratings(token, driverId, iracingCustId);

  // Replace car ownership
  const carRows = [...ownedCarIds]
    .map((carId) => {
      const car = carLookup.get(carId);
      if (!car) return null;
      return {
        driver_id: driverId,
        iracing_car_id: carId,
        car_name: car.car_name,
        car_category: car.car_category,
        car_types: car.car_types,
        synced_at: now,
      };
    })
    .filter(Boolean);
  if (carRows.length > 0) {
    await supabase
      .from("driver_car_ownership")
      .delete()
      .eq("driver_id", driverId);
    await supabase.from("driver_car_ownership").insert(carRows);
  }

  // Replace track ownership
  const trackRows = [...ownedTrackIds]
    .map((trackId) => {
      const track = trackLookup.get(trackId);
      if (!track) return null;
      return {
        driver_id: driverId,
        iracing_track_id: trackId,
        track_name: track.track_name,
        track_config: track.track_config,
        track_category: track.track_category,
        synced_at: now,
      };
    })
    .filter(Boolean);
  if (trackRows.length > 0) {
    await supabase
      .from("driver_track_ownership")
      .delete()
      .eq("driver_id", driverId);
    await supabase.from("driver_track_ownership").insert(trackRows);
  }
}

// ─── Route handler ───────────────────────────────────────────────────────────

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=iracing_denied`);
  }
  if (!code || !state) {
    return NextResponse.redirect(`${origin}/login?error=iracing_no_code`);
  }

  const [verifier, mode = "driver", returnTo = "/pilotes"] = state.split("|");

  try {
    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.redirect(
        `${origin}/login?error=iracing_not_logged_in`,
      );
    }

    const tokenRes = await fetch(IRACING_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        code_verifier: verifier,
      }),
    });
    if (!tokenRes.ok) {
      console.error("iRacing token error:", await tokenRes.text());
      return NextResponse.redirect(`${origin}/pilotes?error=iracing_token`);
    }
    const { access_token: accessToken } = await tokenRes.json();

    // ── Driver mode ──────────────────────────────────────────────────────────
    if (mode === "driver") {
      const profileRes = await fetch(IRACING_PROFILE_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!profileRes.ok) {
        return NextResponse.redirect(`${origin}/pilotes?error=iracing_profile`);
      }
      const profile = await profileRes.json();
      const iracingCustId = String(profile.iracing_cust_id || "");
      if (!iracingCustId) {
        return NextResponse.redirect(`${origin}/pilotes?error=iracing_no_id`);
      }

      const { data: existing } = await supabase
        .from("drivers")
        .select("id, name")
        .eq("iracing_id", iracingCustId)
        .neq("auth_user_id", user.id)
        .single();
      if (existing) {
        return NextResponse.redirect(
          `${origin}/pilotes?error=iracing_already_linked`,
        );
      }

      const { data: driver } = await supabase
        .from("drivers")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();
      if (!driver) {
        return NextResponse.redirect(
          `${origin}/pilotes?error=iracing_no_driver`,
        );
      }

      await supabase
        .from("drivers")
        .update({ iracing_id: iracingCustId })
        .eq("id", driver.id);

      const [carLookup, trackLookup] = await Promise.all([
        buildCarLookup(accessToken),
        buildTrackLookup(accessToken),
      ]);

      const isFirstLink =
        !existing &&
        !(await supabase
          .from("driver_car_ownership")
          .select("driver_id", { count: "exact", head: true })
          .eq("driver_id", driver.id)
          .then(({ count }) => count > 0));

      try {
        await syncOneDriver(
          accessToken,
          driver.id,
          iracingCustId,
          carLookup,
          trackLookup,
        );
      } catch (syncErr) {
        console.error("syncOneDriver failed:", syncErr);
        return NextResponse.redirect(
          `${origin}${returnTo}?error=iracing_sync_failed`,
        );
      }

      const successParam = isFirstLink
        ? "iracing_linked=true"
        : "iracing_synced=true";
      return NextResponse.redirect(`${origin}${returnTo}?${successParam}`);
    }

    // ── Syncall mode ─────────────────────────────────────────────────────────
    if (mode === "syncall") {
      const { data: requestingDriver } = await supabase
        .from("drivers")
        .select("id, role")
        .eq("auth_user_id", user.id)
        .single();
      if (
        !requestingDriver ||
        !["admin", "super_admin"].includes(requestingDriver.role)
      ) {
        return NextResponse.redirect(
          `${origin}/admin?error=iracing_unauthorized`,
        );
      }

      const { data: linkedDrivers } = await supabase
        .from("drivers")
        .select("id, iracing_id")
        .not("iracing_id", "is", null);

      if (!linkedDrivers || linkedDrivers.length === 0) {
        return NextResponse.redirect(`${origin}/admin?iracing_synced=0`);
      }

      const now = new Date().toISOString();
      let syncCount = 0;

      for (const d of linkedDrivers) {
        try {
          const profileData = await fetchIracingS3(
            `/data/member/profile?cust_id=${d.iracing_id}`,
            accessToken,
          );
          const sportsCar = (profileData.member_info?.licenses || []).find(
            (l) => l.category_id === 5,
          );
          const irating = sportsCar?.irating;
          if (typeof irating !== "number") continue;

          const { error: updateErr } = await supabase
            .from("drivers")
            .update({ irating, iracing_synced_at: now })
            .eq("id", d.id);

          if (!updateErr) {
            syncCount++;
            // Backfill full history on first sync for this driver
            await backfillIratingHistory(accessToken, d.id, d.iracing_id);
            // Insert latest iRating for all categories
            await syncAllCategoryIratings(accessToken, d.id, d.iracing_id);
          }
        } catch (err) {
          console.error(`iRacing sync failed for driver ${d.id}:`, err.message);
        }
      }

      return NextResponse.redirect(
        `${origin}/admin?iracing_synced=${syncCount}`,
      );
    }

    return NextResponse.redirect(`${origin}/pilotes?error=iracing_error`);
  } catch (err) {
    console.error("iRacing OAuth error:", err);
    return NextResponse.redirect(`${origin}/pilotes?error=iracing_error`);
  }
}
