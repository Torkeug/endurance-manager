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

  // Flatten all package content_ids into sets of owned IDs
  const ownedCarIds = new Set(
    (memberData.car_packages || []).flatMap((pkg) => pkg.content_ids || []),
  );
  const ownedTrackIds = new Set(
    (memberData.track_packages || []).flatMap((pkg) => pkg.content_ids || []),
  );

  const now = new Date().toISOString();

  // Update iRating and sync timestamp on the driver record
  await supabase
    .from("drivers")
    .update({ irating, iracing_synced_at: now })
    .eq("id", driverId);

  // Replace car ownership: delete then reinsert for this driver
  await supabase
    .from("driver_car_ownership")
    .delete()
    .eq("driver_id", driverId);
  const carRows = [...ownedCarIds]
    .map((carId) => {
      const car = carLookup.get(carId);
      if (!car) return null;
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

  // Replace track ownership: delete then reinsert for this driver
  await supabase
    .from("driver_track_ownership")
    .delete()
    .eq("driver_id", driverId);
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
    await supabase.from("driver_track_ownership").insert(trackRows);
  }
}

// ─── Route handler ───────────────────────────────────────────────────────────

// iRacing OAuth callback — two modes:
// driver   → links iRacing account and syncs own iRating + car/track ownership
// syncall  → admin only: batch-updates iRating for all linked drivers (no car/track —
//            ownership can only be read for the authenticated user, not others)
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

  // State encodes PKCE verifier and mode separated by |
  const [verifier, mode = "driver"] = state.split("|");

  try {
    // Session-aware client for auth.getUser() only
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

    // ── Driver mode ──────────────────────────────────────────────────────────
    // Links the iRacing account and syncs own iRating + car/track ownership.
    // Car/track lookups are only needed here — ownership is per authenticated user.
    if (mode === "driver") {
      // Confirm iRacing identity of the person who just authenticated
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

      // Link the iRacing ID
      await supabase
        .from("drivers")
        .update({ iracing_id: iracingCustId })
        .eq("id", driver.id);

      // Build car/track catalogues then sync this driver's full data
      const [carLookup, trackLookup] = await Promise.all([
        buildCarLookup(accessToken),
        buildTrackLookup(accessToken),
      ]);
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

    // ── Syncall mode ─────────────────────────────────────────────────────────
    // Admin only. Batch-fetches iRating for all linked drivers using the public
    // /data/member/get endpoint — does NOT touch car/track ownership since
    // iRacing only exposes ownership data for the authenticated user.
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

      if (!linkedDrivers || linkedDrivers.length === 0) {
        return NextResponse.redirect(`${origin}/admin?iracing_synced=0`);
      }

      // Batch-fetch iRatings — /data/member/get accepts comma-separated cust_ids
      const custIds = linkedDrivers.map((d) => d.iracing_id).join(",");
      const memberData = await fetchIracingS3(
        `/data/member/get?cust_ids=${custIds}&include_licenses=true`,
        accessToken,
      );

      // Build a Map<iracing_cust_id → sports_car_irating> from the response
      // The response has a `members` array, each with cust_id and licenses
      const iRatingByCustId = new Map();
      for (const member of memberData.members || []) {
        const irating = member.licenses?.sports_car?.irating ?? null;
        iRatingByCustId.set(String(member.cust_id), irating);
      }

      // Update each driver's iRating and sync timestamp
      const now = new Date().toISOString();
      let syncCount = 0;
      for (const d of linkedDrivers) {
        const irating = iRatingByCustId.get(String(d.iracing_id));
        if (irating === undefined) continue; // driver not found in response
        const { error: updateErr } = await supabase
          .from("drivers")
          .update({ irating, iracing_synced_at: now })
          .eq("id", d.id);
        if (!updateErr) syncCount++;
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
