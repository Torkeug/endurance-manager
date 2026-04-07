import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

// Get current session and matched driver record
export async function getSessionAndDriver() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, driver: null }

  const { data: driver } = await supabase
    .from('drivers')
    .select('id, name, role, approved, email, auth_user_id')
    .eq('auth_user_id', user.id)
    .single()

  return { user, driver }
}

export function isAdmin(driver) {
  return driver?.role === 'admin' || driver?.role === 'super_admin'
}

export function isSuperAdmin(driver) {
  return driver?.role === 'super_admin'
}