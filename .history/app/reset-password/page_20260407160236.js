'use client'
import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const [email, setEmail]   = useState('')
  const [sent, setSent]     = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim()) { setError('Entrez votre email.'); return }
    setLoading(true); setError(null)

    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
    })

    console.log('reset result:', err)

    if (err) {
    if (err.message.includes('rate limit') || err.message.includes('Email rate limit')) {
        setError('Trop d\'emails envoyés. Attendez quelques minutes avant de réessayer.')
    } else {
        setError(err.message)
    }
    setLoading(false)
    return
    }
    setSent(true)
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: '1.5rem',
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ background: 'var(--accent)', color: '#000', fontWeight: 700,
              fontSize: '1.5rem', padding: '0.15rem 0.5rem' }}>K</span>
            <span style={{ fontWeight: 700, fontSize: '1.5rem', letterSpacing: '0.12em',
              textTransform: 'uppercase', color: 'var(--text)' }}>KRONOS</span>
          </div>
        </div>

        <div className="card">
          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📧</div>
              <h2 style={{ marginBottom: '0.75rem' }}>Email envoyé</h2>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                Un lien de réinitialisation a été envoyé à <strong style={{ color: 'var(--text)' }}>{email}</strong>.
              </p>
              <Link href="/login" className="btn btn-secondary" style={{ marginTop: '1.5rem', display: 'inline-block' }}>
                Retour à la connexion
              </Link>
            </div>
          ) : (
            <>
              <h2 style={{ marginBottom: '0.5rem' }}>Mot de passe oublié</h2>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                Entrez votre email pour recevoir un lien de réinitialisation.
              </p>
              {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
              <form onSubmit={handleSubmit}>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="votre@email.com" autoFocus required autoComplete="email" />
                </div>
                <button type="submit" className="btn btn-primary"
                  disabled={loading} style={{ width: '100%', marginBottom: '1rem' }}>
                  {loading ? 'Envoi…' : 'Envoyer le lien'}
                </button>
              </form>
              <div style={{ textAlign: 'center', fontSize: '0.82rem' }}>
                <Link href="/login" style={{ color: 'var(--text-dim)' }}>← Retour à la connexion</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}