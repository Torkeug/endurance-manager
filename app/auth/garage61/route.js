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
  // returnTo — path to redirect back to after linking (e.g. /pilotes/123)
  // Pipe character sanitized because state uses | as separator.
  const returnTo = (searchParams.get("returnTo") || "/pilotes").replace(
    /\|/g,
    "",
  );

  const { verifier, challenge } = generatePKCE();

  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
    code_challenge: challenge,
    code_challenge_method: "S256",
    // State carries PKCE verifier and return path — pipe-separated.
    // Verifier is base64url (no pipes), returnTo is sanitized above.
    state: `${verifier}|${returnTo}`,
  });

  return NextResponse.redirect(`${GARAGE61_AUTH_URL}?${params}`);
}
