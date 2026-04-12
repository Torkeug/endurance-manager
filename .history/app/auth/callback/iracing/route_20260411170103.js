import { NextResponse } from 'next/server'
import { createClient } from '../../../../../../lib/auth'

// iRacing OAuth configuration
const IRACING_TOKEN_URL = 'https://members-ng.iracing.com/oauth2/token'
const IRACING_PROFILE_URL = 'https://members-ng.iracing.com/data/member/profile'
const CLIENT_ID = 'kronos-team'
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback/iracing`

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=iracing_denied`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=iracing_no_code`)
  }

  try {
    // Exchange code for access token
    const tokenRes = await fetch(IRACING_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'authorization_code',
        code,
        redirect_uri:  REDIRECT_URI,
        client_id:     CLIENT_ID,
        code_verifier: state, // PKCE verifier stored in state param
      }),
    })

    if (!tokenRes.ok) {
      console.error('iRacing token error:', await tokenRes.text())
      return NextResponse.redirect(`${origin}/login?error=iracing_token`)
    }

    const tokens = await tokenRes.json()
    const accessToken = tokens.access_token

    // Fetch iRacing profile
    const profileRes = await fetch(IRACING_PROFILE_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!profileRes.ok) {
      return NextResponse.redirect(`${origin}/login?error=iracing_profile`)
    }

    const profile = await profileRes.json()
    const iracingId = String(profile.cust_id || profile.custid || '')
    const iracingName = profile.display_name || profile.name || ''
    const irating = profile.irating || null

    if (!iracingId) {
      return NextResponse.redirect(`${origin}/login?error=iracing_no_id`)
    }

    // Look up driver by iRacing ID
    const supabase = await createClient()
    const { data: driver } = await supabase
      .from('drivers')
      .select('id, approved, refused, auth_user_id, email')
      .eq('iracing_id', iracingId)
      .single()

    if (!driver) {
      // No driver found — redirect to register with iRacing info pre-filled
      const params = new URLSearchParams({
        iracing_id:   iracingId,
        iracing_name: iracingName,
      })
      return NextResponse.redirect(`${origin}/register?${params}`)
    }

    if (driver.refused) {
      return NextResponse.redirect(`${origin}/refused`)
    }

    // Sign in the driver via Supabase auth
    if (driver.auth_user_id) {
      // Already linked — sign them in using admin API
      const { data: sessionData, error: sessionErr } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: driver.email,
      })

      if (!sessionErr && sessionData?.properties?.action_link) {
        // Update iRating while we're at it
        if (irating) {
          await supabase.from('drivers').update({ irating }).eq('id', driver.id)
        }
      }
    }

    if (!driver.approved) {
      return NextResponse.redirect(`${origin}/pending`)
    }

    return NextResponse.redirect(`${origin}/`)

  } catch (err) {
    console.error('iRacing OAuth error:', err)
    return NextResponse.redirect(`${origin}/login?error=iracing_error`)
  }
}