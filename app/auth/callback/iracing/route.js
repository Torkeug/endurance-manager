import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/auth";
import { supabaseServer as supabase } from "../../../../lib/supabase-server";

const IRACING_TOKEN_URL = "https://oauth.iracing.com/oauth2/token";
const IRACING_PROFILE_URL = "https://oauth.iracing.com/oauth2/iracing/profile";
const IRACING_DATA_BASE = "https://members-ng.iracing.com";
const CLIENT_ID = "kronos-team";
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback/iracing`;

// ─── Helpers ────────────────────────────────────────────────────────────────

// iRacing data endpoints return an S3 link — this does the two-step fetch.
async function fetchIracingS3(path, token) {
  const res = await fetch(`${IRACING_DATA_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`iRacing API ${path}: ${res.status}`);
  const { link } = await res.json();
  const s3Res = await fetch(link);
  if (!s3Res.ok) throw new Error(`S3 fetch: ${s3Res.status}`);
  return s3Res.json();
}

// Build Map<car_id → { car_name, car_category }> from /data/car/get
async function buildCarLookup(token) {
  const cars = await fetchIracingS3("/data/car/get", token);
  const map = new Map();
  for (const car of cars) {
    map.set(car.car_id, {
      car_name: car.car_name,
      // categories is an array e.g. ["sports_car"] — take the first entry
      car_category: (car.categories || [])[0] || null,
    });
  }
  return map;
}

// Build Map<track_id → { track_name, track_config, track_category }> from /data/track/get
async function buildTrackLookup(token) {
  const tracks = await fetchIracingS3("/data/track/get", token);
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
// carLookup and trackLookup are built once and reused across all drivers.
async function syncOneDriver(
  token,
  driverId,
  iracingCustId,
  carLookup,
  trackLookup,
) {
  // Fetch member info — S3-linked response
  const memberData = await fetchIracingS3(
    `/data/member/info?cust_id=${iracingCustId}`,
    token,
  );

  // Sports car iRating — licenses is a keyed object, not an array
  const irating = memberData.licenses?.sports_car?.irating ?? null;

  // Flatten all package content_ids to get owned car IDs
  const ownedCarIds = new Set(
    (memberData.car_packages || []).flatMap((pkg) => pkg.content_ids || []),
  );

  // Flatten all package content_ids to get owned track IDs
  const ownedTrackIds = new Set(
    (memberData.track_packages || []).flatMap((pkg) => pkg.content_ids || []),
  );

  const now = new Date().toISOString();

  // Update driver iRating and sync timestamp
  await supabase
    .from("drivers")
    .update({ irating, iracing_synced_at: now })
    .eq("id", driverId);

  // Replace car ownership: delete all rows for this driver, then reinsert
  await supabase
    .from("driver_car_ownership")
    .delete()
    .eq("driver_id", driverId);
  const carRows = [...ownedCarIds]
    .map((carId) => {
      const car = carLookup.get(carId);
      if (!car) return null; // unknown car ID — skip
      return {
        driver_id: driverId,
        iracing_car_id: carId,
        car_name: car.car_name,
        car_category: car.car_category,
        synced_at: now,
      };
    })
    .filter(Boolean);
  if (carRows.length > 0) {
    await supabase.from("driver_car_ownership").insert(carRows);
  }

  // Replace track ownership: delete all rows for this driver, then reinsert
  await supabase
    .from("driver_track_ownership")
    .delete()
    .eq("driver_id", driverId);
  const trackRows = [...ownedTrackIds]
    .map((trackId) => {
      const track = trackLookup.get(trackId);
      if (!track) return null; // unknown track ID — skip
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
    await supabase.from("driver_track_ownership").insert(trackRows);
  }
}

// ─── Route handler ───────────────────────────────────────────────────────────

// iRacing OAuth callback — handles two modes:
// driver   → links iRacing account to the logged-in driver and syncs their data
// syncall  → admin-only: syncs all drivers who have a linked iracing_id
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

  // Split state into PKCE verifier and mode
  const [verifier, mode = "driver"] = state.split("|");

  try {
    // Use the session-aware client only for auth.getUser()
    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.redirect(
        `${origin}/login?error=iracing_not_logged_in`,
      );
    }

    // Exchange authorization code for access token
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

    // Fetch the global car and track catalogues once — reused for all drivers
    const [carLookup, trackLookup] = await Promise.all([
      buildCarLookup(accessToken),
      buildTrackLookup(accessToken),
    ]);

    // ── Driver mode: link own account and sync own data ──────────────────────
    if (mode === "driver") {
      // Get the iRacing identity of the person who just authenticated
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

      // Check this iRacing ID isn't already linked to a different Kronos account
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

      // Find the Kronos driver record for the logged-in user
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

      // Link the iRacing ID on the driver record
      await supabase
        .from("drivers")
        .update({ iracing_id: iracingCustId })
        .eq("id", driver.id);

      // Sync iRating + owned cars + owned tracks
      await syncOneDriver(
        accessToken,
        driver.id,
        iracingCustId,
        carLookup,
        trackLookup,
      );

      return NextResponse.redirect(
        `${origin}/pilotes/${driver.id}?iracing_linked=true`,
      );
    }

    // ── Syncall mode: admin syncs all linked drivers ──────────────────────────
    if (mode === "syncall") {
      // Server-side role check — admins and super_admins only
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

      // Fetch all drivers who have a linked iRacing account
      const { data: linkedDrivers } = await supabase
        .from("drivers")
        .select("id, iracing_id")
        .not("iracing_id", "is", null);

      let syncCount = 0;
      // Sync sequentially to respect iRacing rate limits
      for (const d of linkedDrivers || []) {
        try {
          await syncOneDriver(
            accessToken,
            d.id,
            d.iracing_id,
            carLookup,
            trackLookup,
          );
          syncCount++;
        } catch (err) {
          // Log per-driver errors but continue syncing remaining drivers
          console.error(`iRacing sync failed for driver ${d.id}:`, err.message);
        }
      }

      return NextResponse.redirect(
        `${origin}/admin?iracing_synced=${syncCount}`,
      );
    }

    // Unknown mode
    return NextResponse.redirect(`${origin}/pilotes?error=iracing_error`);
  } catch (err) {
    console.error("iRacing OAuth error:", err);
    return NextResponse.redirect(`${origin}/pilotes?error=iracing_error`);
  }
}
