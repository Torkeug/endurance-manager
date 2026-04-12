'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const links = [
  { href: '/',           label: 'Accueil' },
  { href: '/pilotes',    label: 'Pilotes' },
  { href: '/evenements', label: 'Événements' },
  { href: '/admin',      label: 'Admin' },
]

export default function Nav() {
  const pathname = usePathname()
  const router   = useRouter()
  const [theme, setTheme]   = useState('dark')
  const [driver, setDriver] = useState(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  useEffect(() => {
    const saved = localStorage.getItem('theme') || 'dark'
    setTheme(saved)
    document.documentElement.setAttribute('data-theme', saved)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase
        .from('drivers')
        .select('id, name, role')
        .eq('auth_user_id', user.id)
        .single()
      if (data) setDriver(data)
    })
  }, [])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const isAdmin = driver?.role === 'admin' || driver?.role === 'super_admin'

  return (
    <nav style={{
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      position: 'sticky', top: 0, zIndex: 100,
    }}>
      <div style={{
        maxWidth: '1200px', margin: '0 auto', padding: '0 1.5rem',
        display: 'flex', alignItems: 'center', gap: '1.5rem', height: '56px',
      }}>
        {/* Brand */}
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexShrink: 0 }}>
          <span style={{ background: 'var(--accent)', color: '#000', fontWeight: 700, fontSize: '1rem', padding: '0.1rem 0.4rem', letterSpacing: '0.05em' }}>K</span>
          <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1rem', letterSpacing: '0.12em', textTransform: 'uppercase' }}>KRONOS</span>
          <span style={{ color: 'var(--text-dim)', fontWeight: 500, fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>ENDURANCE</span>
        </Link>

        {/* Links */}
        <div style={{ display: 'flex', gap: '0.25rem', flex: 1 }}>
          {links
            .filter(l => l.href !== '/admin' || isAdmin)
            .map(({ href, label }) => {
              const active = pathname === href || (href !== '/' && pathname.startsWith(href))
              return (
                <Link key={href} href={href} style={{
                  textDecoration: 'none', padding: '0.4rem 0.85rem', borderRadius: '3px',
                  fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: active ? 'var(--accent)' : 'var(--text-dim)',
                  background: active ? 'var(--surface-2)' : 'transparent',
                  borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                  transition: 'color 0.15s', whiteSpace: 'nowrap',
                }}>
                  {label}
                </Link>
              )
            })}
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
          {/* Driver name */}
          {driver && (
            <Link href={`/pilotes/${driver.id}`} style={{
              textDecoration: 'none', fontSize: '0.82rem', fontWeight: 600,
              color: 'var(--text-dim)', whiteSpace: 'nowrap',
            }}>
              {driver.name}
              {driver.role !== 'driver' && (
                <span style={{ marginLeft: '0.4rem', fontSize: '0.65rem', color: 'var(--accent)',
                  fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {driver.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                </span>
              )}
            </Link>
          )}

          {/* Theme toggle */}
          <button onClick={toggleTheme} className="theme-toggle"
            title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          {/* Logout */}
          {driver && (
            <button onClick={handleLogout} className="btn btn-secondary btn-sm">
              Déconnexion
            </button>
          )}
        </div>
      </div>
    </nav>
  )
}