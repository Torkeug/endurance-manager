'use client'
import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlError = searchParams.get('error')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim() || !password) { setError('Email et mot de passe requis.'); return }
    setLoading(true); setError(null)

    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (err) {
      if (err.message.includes('Invalid login credentials')) {
        setError('Email ou mot de passe incorrect.')
      } else if (err.message.includes('Email not confirmed')) {
        setError('Vérifiez votre email — un lien de confirmation vous a été envoyé.')
      } else {
        setError(err.message)
      }
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: '1.5rem',
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span style={{ background: 'var(--accent)', color: '#000', fontWeight: 700,
              fontSize: '1.5rem', padding: '0.15rem 0.5rem' }}>K</span>
            <span style={{ fontWeight: 700, fontSize: '1.5rem', letterSpacing: '0.12em',
              textTransform: 'uppercase', color: 'var(--text)' }}>KRONOS</span>
          </div>
          <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem', letterSpacing: '0.1em',
            textTransform: 'uppercase' }}>Endurance Planner</div>
        </div>

        <div className="card">
          <h2 style={{ marginBottom: '0.5rem' }}>Connexion</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            Connectez-vous avec votre email et mot de passe.
          </p>

          {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label htmlFor="email">Email</label>
              <input id="email" type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="votre@email.com" autoFocus required autoComplete="email" />
            </div>
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="password">Mot de passe</label>
              <input id="password" type="password" value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required autoComplete="current-password" />
            </div>
            <button type="submit" className="btn btn-primary"
              disabled={loading} style={{ width: '100%', marginBottom: '1rem' }}>
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
            <Link href="/register" style={{ color: 'var(--text-dim)' }}>
              Créer un compte
            </Link>
            <Link href="/reset-password" style={{ color: 'var(--text-dim)' }}>
              Mot de passe oublié ?
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}