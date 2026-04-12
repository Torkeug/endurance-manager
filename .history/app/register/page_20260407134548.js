'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

function RegisterForm() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const email        = searchParams.get('email') || ''

  const [form, setForm] = useState({
    name:       '',
    iracing_id: '',
    discord:    '',
    email:      email,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Le nom est obligatoire.'); return }
    if (!form.email.trim()) { setError("L'email est obligatoire."); return }

    setLoading(true); setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Create driver record
    const { error: err } = await supabase.from('drivers').insert([{
      name:        form.name.trim(),
      email:       form.email.trim(),
      iracing_id:  form.iracing_id.trim() || null,
      discord:     form.discord.trim() || null,
      auth_user_id: user.id,
      approved:    false,
      role:        'driver',
      active:      true,
    }])

    if (err) {
      if (err.code === '23505') {
        setError('Cette adresse email est déjà utilisée.')
      } else {
        setError(err.message)
      }
      setLoading(false)
      return
    }

    router.push('/pending')
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: '1.5rem',
    }}>
      <div style={{ width: '100%', maxWidth: '480px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span style={{ background: 'var(--accent)', color: '#000', fontWeight: 700,
              fontSize: '1.5rem', padding: '0.15rem 0.5rem' }}>K</span>
            <span style={{ fontWeight: 700, fontSize: '1.5rem', letterSpacing: '0.12em',
              textTransform: 'uppercase', color: 'var(--text)' }}>KRONOS</span>
          </div>
          <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Première connexion — créez votre profil</div>
        </div>

        <div className="card">
          <h2 style={{ marginBottom: '0.5rem' }}>Créer votre profil</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            Votre compte sera activé par un admin avant que vous puissiez accéder à l&apos;application.
          </p>

          {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-grid" style={{ marginBottom: '1rem' }}>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Nom complet *</label>
                <input type="text" value={form.name} onChange={set('name')}
                  placeholder="Prénom Nom" autoFocus required />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Email *</label>
                <input type="email" value={form.email} onChange={set('email')}
                  placeholder="votre@email.com" required />
              </div>
              <div className="form-group">
                <label>iRacing ID</label>
                <input type="text" value={form.iracing_id} onChange={set('iracing_id')}
                  placeholder="ex : 123456" />
              </div>
              <div className="form-group">
                <label>Discord</label>
                <input type="text" value={form.discord} onChange={set('discord')}
                  placeholder="ex : username" />
              </div>
            </div>
            <button type="submit" className="btn btn-primary"
              disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Enregistrement…' : 'Créer mon profil'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  )
}