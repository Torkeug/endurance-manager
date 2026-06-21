import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient, isAdmin } from "../../../lib/auth";
import { supabaseServer as supabase } from "../../../lib/supabase-server";

const IRACING_AUTH_URL = "https://oauth.iracing.com/oauth2/authorize";
const CLIENT_ID = process.env.NEXT_PUBLIC_IRACING_CLIENT_ID;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback/iracing`;
const SCOPE = "iracing.profile iracing.auth";

// Generate PKCE code verifier and challenge
function generatePKCE() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url");
  return { verifier, challenge };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  // mode=driver  → link/update own iRacing account (default, all roles)
  // mode=syncall → admin syncs all linked drivers in one OAuth flow
  const mode = searchParams.get("mode") || "driver";

  // syncall requires an active admin session — gate at initiation, not just callback
  if (mode === "syncall") {
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login`);
    const { data: driver } = await supabase.from("drivers").select("role").eq("auth_user_id", user.id).single();
    if (!isAdmin(driver)) return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/`);
  }
  // returnTo — path to redirect back to after sync. Must be an absolute-path (no //host).
  const rawReturnTo = searchParams.get("returnTo") || "/pilotes";
  const returnTo = /^\/[^/]/.test(rawReturnTo) ? rawReturnTo : "/pilotes";

  const { verifier, challenge } = generatePKCE();
  // Random nonce binds state to the cookie — prevents OAuth CSRF.
  const nonce = crypto.randomBytes(16).toString("hex");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: nonce,
  });

  const response = NextResponse.redirect(`${IRACING_AUTH_URL}?${params}`);
  // Store verifier + metadata in an httpOnly cookie; only the nonce goes in the URL.
  // SameSite=Lax: required so the cookie is sent on the cross-site redirect back from iRacing.
  response.cookies.set(
    "pkce_iracing_state",
    JSON.stringify({ nonce, verifier, mode, returnTo }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 600,
      path: "/",
    },
  );
  return response;
}
