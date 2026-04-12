import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

const PUBLIC_ROUTES = ['/login', '/register', '/pending', '/refused', '/auth', '/reset-password', '/update-password', '/change-password', '/auth/reset' ]

export async function proxy(request) {
  const { pathname } = request.nextUrl

  // Allow public routes
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Check driver record
  const { data: driver } = await supabase
    .from('drivers')
    .select('approved, role')
    .eq('auth_user_id', user.id)
    .single()

  // No driver record — redirect to register
  if (!driver) {
    return NextResponse.redirect(new URL('/register', request.url))
  }

    // Approved driver on pending page — redirect home
    if (driver.approved && pathname === '/pending') {
    return NextResponse.redirect(new URL('/', request.url))
    }  

  // Not approved — redirect to pending
  if (!driver.approved) {
    return NextResponse.redirect(new URL('/pending', request.url))
  }

  if (driver.refused) {
    return NextResponse.redirect(new URL('/refused', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}