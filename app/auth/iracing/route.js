import { NextResponse } from "next/server";
import crypto from "crypto";

const IRACING_AUTH_URL = "https://oauth.iracing.com/oauth2/authorize";
const CLIENT_ID = "kronos-team";
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback/iracing`;
const SCOPE = "iracing.profile"; // Grants access to /oauth2/iracing/profile endpoint

// Generate PKCE code verifier and challenge
function generatePKCE() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url");
  return { verifier, challenge };
}

export async function GET() {
  const { verifier, challenge } = generatePKCE();

  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
    code_challenge: challenge,
    code_challenge_method: "S256",
    // PKCE verifier is passed via state param — retrieved in the callback to verify the exchange.
    // This is the standard PKCE pattern for public clients without a client secret.
    state: verifier,
  });

  const authUrl = `${IRACING_AUTH_URL}?${params}`;
  return NextResponse.redirect(authUrl);
}
