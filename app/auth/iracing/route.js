import { NextResponse } from "next/server";
import crypto from "crypto";

const IRACING_AUTH_URL = "https://oauth.iracing.com/oauth2/authorize";
const CLIENT_ID = "kronos-team";
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback/iracing`;
// iracing.profile grants access to /oauth2/iracing/profile (identity)
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

  const { verifier, challenge } = generatePKCE();

  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
    code_challenge: challenge,
    code_challenge_method: "S256",
    // State encodes both the PKCE verifier and the mode, separated by |
    // The callback splits on | to recover both. Verifier must not contain |.
    state: `${verifier}|${mode}`,
  });

  return NextResponse.redirect(`${IRACING_AUTH_URL}?${params}`);
}
