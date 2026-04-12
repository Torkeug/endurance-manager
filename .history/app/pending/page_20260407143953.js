'use client'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function PendingPage() {
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

    useEffect(() => {
    const check = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: driver } = await supabase
        .from('drivers')
        .select('approved')
        .eq('auth_user_id', user.id)
        .single()
        if (driver?.approved) {
        router.push('/')
        router.refresh()
        }
    }

    // Check immediately and then every 10 seconds
    check()
    const interval = setInterval(check, 10000)
    return () => clearInterval(interval)
    }, [])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: '1.5rem',
    }}>
      <div style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '2rem' }}>
          <span style={{ background: 'var(--accent)', color: '#000', fontWeight: 700,
            fontSize: '1.5rem', padding: '0.15rem 0.5rem' }}>K</span>
          <span style={{ fontWeight: 700, fontSize: '1.5rem', letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'var(--text)' }}>KRONOS</span>
        </div>

        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⏳</div>
          <h2 style={{ marginBottom: '0.75rem' }}>En attente d&apos;approbation</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            Votre profil a été créé et est en attente de validation par un administrateur.
            Contactez un administrateur pour activer votre compte.
          </p>
          <button onClick={handleLogout} className="btn btn-secondary">
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  )
}