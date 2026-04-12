'use client'
import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export default function LoginPage() {
  const [email, setEmail]     = useState('')
  const [sent, setSent]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim()) { setError('Entrez votre adresse email.'); return }
    setLoading(true); setError(null)

    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (err) { setError(err.message); setLoading(false); return }
    setSent(true)
    setLoading(false)
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
          {sent ? (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📧</div>
              <h2 style={{ marginBottom: '0.75rem' }}>Vérifiez votre email</h2>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                Un lien de connexion a été envoyé à <strong style={{ color: 'var(--text)' }}>{email}</strong>.
                Cliquez sur le lien pour accéder à l&apos;application.
              </p>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginTop: '1rem' }}>
                Le lien expire dans 1 heure. Vérifiez vos spams si vous ne le recevez pas.
              </p>
              <button onClick={() => setSent(false)}
                className="btn btn-secondary" style={{ marginTop: '1.5rem' }}>
                Renvoyer
              </button>
            </div>
          ) : (
            <>
              <h2 style={{ marginBottom: '0.5rem' }}>Connexion</h2>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                Entrez votre email pour recevoir un lien de connexion.
              </p>

              {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

              <form onSubmit={handleSubmit}>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label htmlFor="email">Adresse email</label>
                  <input
                    id="email" type="email" value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="votre@email.com" autoFocus required
                  />
                </div>
                <button type="submit" className="btn btn-primary"
                  disabled={loading} style={{ width: '100%' }}>
                  {loading ? 'Envoi…' : 'Envoyer le lien de connexion'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}