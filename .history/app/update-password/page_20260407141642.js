'use client'
import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function UpdatePasswordPage() {
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [success, setSuccess]     = useState(false)
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!password)          { setError('Le mot de passe est obligatoire.'); return }
    if (password.length < 8){ setError('Le mot de passe doit contenir au moins 8 caractères.'); return }
    if (password !== confirm){ setError('Les mots de passe ne correspondent pas.'); return }

    setLoading(true); setError(null)

    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) { setError(err.message); setLoading(false); return }

    setSuccess(true)
    setTimeout(() => router.push('/'), 2000)
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
          {success ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>✅</div>
              <h2 style={{ marginBottom: '0.75rem' }}>Mot de passe mis à jour</h2>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
                Redirection en cours…
              </p>
            </div>
          ) : (
            <>
              <h2 style={{ marginBottom: '0.5rem' }}>Nouveau mot de passe</h2>
              {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
              <form onSubmit={handleSubmit}>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label>Nouveau mot de passe (min. 8 caractères)</label>
                  <input type="password" value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" autoFocus required />
                </div>
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label>Confirmer le mot de passe</label>
                  <input type="password" value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="••••••••" required />
                </div>
                <button type="submit" className="btn btn-primary"
                  disabled={loading} style={{ width: '100%' }}>
                  {loading ? 'Mise à jour…' : 'Mettre à jour le mot de passe'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}