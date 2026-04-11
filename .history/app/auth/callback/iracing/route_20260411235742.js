import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/auth'

const IRACING_TOKEN_URL = 'https://members-ng.iracing.com/oauth2/token'
const IRACING_PROFILE_URL = 'https://members-ng.iracing.com/data/member/profile'
const CLIENT_ID   = 'kronos-team'
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
    const supabase = await createClient()

    // Check for existing session
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.redirect(`${origin}/login?error=iracing_not_logged_in`)
    }

    // Exchange code for access token
    const tokenRes = await fetch(IRACING_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'authorization_code',
        code,
        redirect_uri:  REDIRECT_URI,
        client_id:     CLIENT_ID,
        code_verifier: state,
      }),
    })

    if (!tokenRes.ok) {
      console.error('iRacing token error:', await tokenRes.text())
      return NextResponse.redirect(`${origin}/pilotes?error=iracing_token`)
    }

    const tokens = await tokenRes.json()
    const accessToken = tokens.access_token

    // Fetch iRacing profile
    const profileRes = await fetch(IRACING_PROFILE_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!profileRes.ok) {
      return NextResponse.redirect(`${origin}/pilotes?error=iracing_profile`)
    }

    const profile = await profileRes.json()
    const iracingId = String(profile.cust_id || profile.custid || '')
    const irating   = profile.irating || null

    if (!iracingId) {
      return NextResponse.redirect(`${origin}/pilotes?error=iracing_no_id`)
    }

    // Check if this iRacing ID is already linked to another account
    const { data: existing } = await supabase
      .from('drivers')
      .select('id, name')
      .eq('iracing_id', iracingId)
      .neq('auth_user_id', user.id)
      .single()

    if (existing) {
      return NextResponse.redirect(`${origin}/pilotes?error=iracing_already_linked`)
    }

    // Link iRacing account to current driver
    const { data: driver } = await supabase
      .from('drivers')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (!driver) {
      return NextResponse.redirect(`${origin}/pilotes?error=iracing_no_driver`)
    }

    await supabase.from('drivers').update({
      iracing_id: iracingId,
      ...(irating ? { irating } : {}),
    }).eq('id', driver.id)

    return NextResponse.redirect(`${origin}/pilotes/${driver.id}?iracing_linked=true`)

  } catch (err) {
    console.error('iRacing OAuth error:', err)
    return NextResponse.redirect(`${origin}/pilotes?error=iracing_error`)
  }
}