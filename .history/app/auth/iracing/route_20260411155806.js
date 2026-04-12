import { NextResponse } from 'next/server'
import crypto from 'crypto'

const IRACING_AUTH_URL = 'https://members-ng.iracing.com/oauth2/authorize'
const CLIENT_ID   = 'kronos-team'
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback/iracing`
const SCOPE = 'openid profile'

// Generate PKCE code verifier and challenge
function generatePKCE() {
  const verifier  = crypto.randomBytes(32).toString('base64url')
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

export async function GET() {
  const { verifier, challenge } = generatePKCE()

  const params = new URLSearchParams({
    response_type:         'code',
    client_id:             CLIENT_ID,
    redirect_uri:          REDIRECT_URI,
    scope:                 SCOPE,
    code_challenge:        challenge,
    code_challenge_method: 'S256',
    state:                 verifier, // pass verifier in state for retrieval in callback
  })

  const authUrl = `${IRACING_AUTH_URL}?${params}`
  return NextResponse.redirect(authUrl)
}