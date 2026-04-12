import { NextResponse } from 'next/server'
import { createClient } from '../../../lib/auth'

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && user) {
      // Check if driver record exists with this auth_user_id
      const { data: driver } = await supabase
        .from('drivers')
        .select('id, approved, auth_user_id')
        .eq('auth_user_id', user.id)
        .single()

      if (driver) {
        // Existing linked driver
        if (!driver.approved) {
          return NextResponse.redirect(`${origin}/pending`)
        }
        return NextResponse.redirect(`${origin}/`)
      }

      // Check if driver exists with matching email (not yet linked)
      const { data: driverByEmail } = await supabase
        .from('drivers')
        .select('id, approved')
        .eq('email', user.email)
        .single()

      if (driverByEmail) {
        // Link auth user to driver record
        await supabase
          .from('drivers')
          .update({ auth_user_id: user.id })
          .eq('id', driverByEmail.id)

        if (!driverByEmail.approved) {
          return NextResponse.redirect(`${origin}/pending`)
        }
        return NextResponse.redirect(`${origin}/`)
      }

      // No driver record found — redirect to register
      return NextResponse.redirect(`${origin}/register?email=${encodeURIComponent(user.email)}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}