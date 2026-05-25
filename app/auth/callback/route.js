import { NextResponse } from "next/server";
import { createClient } from "../../../lib/auth";
import { supabaseServer } from "../../../lib/supabase-server";

export const dynamic = "force-dynamic";

// Central auth callback handler — processes three types of redirects:
// 1. Error redirects from Supabase (expired links etc.)
// 2. Token hash from password reset emails (type=recovery)
// 3. Auth code from email confirmation and OAuth flows
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  const next = searchParams.get("next") || "/";
  const type = searchParams.get("type");

  // Handle error from Supabase (e.g. expired link)
  const error = searchParams.get("error");
  const errorCode = searchParams.get("error_code");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    if (errorCode === "otp_expired") {
      return NextResponse.redirect(`${origin}/login?error=link_expired`);
    }
    return NextResponse.redirect(`${origin}/login?error=${error}`);
  }

  // Handle token_hash (password reset, email confirmation)
  const token_hash = searchParams.get("token_hash");
  if (token_hash && type === "recovery") {
    const supabase = await createClient();
    const { data, error: verifyErr } =
      await supabase.auth.exchangeCodeForSession(token_hash);
    if (verifyErr) {
      return NextResponse.redirect(`${origin}/login?error=link_expired`);
    }
    return NextResponse.redirect(`${origin}/update-password`);
  }

  if (code) {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && next === "/update-password") {
      return NextResponse.redirect(`${origin}/update-password`);
    }

    if (!error && user) {
      // Check if driver record exists with this auth_user_id
      const { data: driver } = await supabase
        .from("drivers")
        .select("id, approved, auth_user_id")
        .eq("auth_user_id", user.id)
        .single();

      if (driver) {
        // Existing linked driver
        if (!driver.approved) {
          return NextResponse.redirect(`${origin}/pending`);
        }
        return NextResponse.redirect(`${origin}/`);
      }

      // Check if driver exists with matching email (not yet linked)
      const { data: driverByEmail } = await supabase
        .from("drivers")
        .select("id, approved")
        .eq("email", user.email)
        .single();

      if (driverByEmail) {
        // Link auth user to existing driver record by email —
        // handles the case where an admin created the driver before the user registered.
        // Must use service role: RLS blocks updates on rows where auth_user_id is still null.
        await supabaseServer
          .from("drivers")
          .update({ auth_user_id: user.id })
          .eq("id", driverByEmail.id);

        if (!driverByEmail.approved) {
          return NextResponse.redirect(`${origin}/pending`);
        }
        return NextResponse.redirect(`${origin}/`);
      }

      // No driver record found — redirect to register
      return NextResponse.redirect(
        `${origin}/register?email=${encodeURIComponent(user.email)}`,
      );
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
