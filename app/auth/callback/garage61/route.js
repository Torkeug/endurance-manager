import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/auth";
import { supabaseServer as supabase } from "../../../../lib/supabase-server";

const GARAGE61_TOKEN_URL = "https://garage61.net/api/oauth/token";
const CLIENT_ID = "01KSEXK2MP3Q4T2219885XN17V";
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback/garage61`;

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${origin}/pilotes?error=garage61_denied`);
  }
  if (!code || !state) {
    return NextResponse.redirect(`${origin}/pilotes?error=garage61_no_code`);
  }

  const [verifier, returnTo = "/pilotes"] = state.split("|");

  try {
    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.redirect(
        `${origin}/login?error=garage61_not_logged_in`,
      );
    }

    // Exchange authorization code for tokens
    const tokenRes = await fetch(GARAGE61_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        client_secret: process.env.GARAGE61_CLIENT_SECRET,
        code_verifier: verifier,
      }),
    });

    if (!tokenRes.ok) {
      console.error("Garage61 token exchange error:", await tokenRes.text());
      return NextResponse.redirect(`${origin}/pilotes?error=garage61_token`);
    }

    const tokenData = await tokenRes.json();
    const { access_token, refresh_token } = tokenData;

    if (!access_token) {
      console.error("Garage61 token response missing access_token:", tokenData);
      return NextResponse.redirect(`${origin}/pilotes?error=garage61_token`);
    }

    // Find the driver record for the current user
    const { data: driver } = await supabase
      .from("drivers")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (!driver) {
      return NextResponse.redirect(
        `${origin}/pilotes?error=garage61_no_driver`,
      );
    }

    // Persist tokens — service role bypasses RLS
    const { error: updateErr } = await supabase
      .from("drivers")
      .update({
        garage61_access_token: access_token,
        garage61_refresh_token: refresh_token ?? null,
      })
      .eq("id", driver.id);

    if (updateErr) {
      console.error("Garage61 token save error:", updateErr.message);
      return NextResponse.redirect(`${origin}/pilotes?error=garage61_save`);
    }

    return NextResponse.redirect(`${origin}${returnTo}?garage61_linked=true`);
  } catch (err) {
    console.error("Garage61 OAuth error:", err);
    return NextResponse.redirect(`${origin}/pilotes?error=garage61_error`);
  }
}
