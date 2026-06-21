import { NextResponse } from "next/server";
import crypto from "crypto";

const GARAGE61_AUTH_URL = "https://garage61.net/app/account/oauth";
const CLIENT_ID = process.env.NEXT_PUBLIC_GARAGE61_CLIENT_ID;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback/garage61`;
const SCOPE = "driving_data analyses";

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
  // returnTo — path to redirect back to after linking. Must be an absolute-path (no //host).
  const rawReturnTo = searchParams.get("returnTo") || "/pilotes";
  const returnTo = /^\/[^/]/.test(rawReturnTo) ? rawReturnTo : "/pilotes";

  const { verifier, challenge } = generatePKCE();
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

  const response = NextResponse.redirect(`${GARAGE61_AUTH_URL}?${params}`);
  response.cookies.set(
    "pkce_garage61_state",
    JSON.stringify({ nonce, verifier, returnTo }),
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
