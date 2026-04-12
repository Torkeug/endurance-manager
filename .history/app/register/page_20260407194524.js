'use client'
import { useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'

function RegisterForm() {
  const router = useRouter()

  const [form, setForm] = useState({
    name:       '',
    email:      '',
    password:   '',
    confirm:    '',
    iracing_id: '',
    discord:    '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [sent, setSent]       = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim())   { setError('Le nom est obligatoire.'); return }
    if (!form.email.trim())  { setError("L'email est obligatoire."); return }
    if (!form.password)      { setError('Le mot de passe est obligatoire.'); return }
    if (form.password.length < 8) { setError('Le mot de passe doit contenir au moins 8 caractères.'); return }
    if (form.password !== form.confirm) { setError('Les mots de passe ne correspondent pas.'); return }

    setLoading(true); setError(null)

    // 1. Create Supabase auth user
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email:    form.email.trim(),
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (authErr) {
    if (authErr.message.includes('already registered') || authErr.message.includes('User already registered')) {
        setError('Cette adresse email est déjà utilisée. Essayez de vous connecter.')
    } else if (authErr.message.includes('invalid email')) {
        setError('Adresse email invalide.')
    } else if (authErr.message.includes('Password should be')) {
        setError('Le mot de passe doit contenir au moins 8 caractères.')
    } else if (authErr.message.includes('rate limit')) {
        setError('Trop de tentatives. Attendez quelques minutes avant de réessayer.')
    } else {
        setError(`Erreur: ${authErr.message} (code: ${authErr.code})`)
    }
    setLoading(false)
    return
    }

    // 2. Create driver record
    const { error: driverErr } = await supabase.from('drivers').insert([{
      name:         form.name.trim(),
      email:        form.email.trim(),
      iracing_id:   form.iracing_id.trim() || null,
      discord:      form.discord.trim()    || null,
      auth_user_id: authData.user?.id,
      approved:     false,
      role:         'driver',
      active:       true,
    }])

    if (driverErr) {
    if (driverErr.code === '23505') {
        if (driverErr.message.includes('email')) {
        setError('Cette adresse email est déjà utilisée. Essayez de vous connecter.')
        } else if (driverErr.message.includes('iracing_id')) {
        setError('Cet iRacing ID est déjà associé à un autre compte.')
        } else {
        setError('Un compte avec ces informations existe déjà.')
        }
    } else if (driverErr.code === '23502') {
        setError('Un champ obligatoire est manquant.')
    } else {
        setError('Erreur lors de la création du profil. Réessayez ou contactez un administrateur.')
    }
    setLoading(false)
    return
    }

    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)', padding: '1.5rem',
      }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📧</div>
            <h2 style={{ marginBottom: '0.75rem' }}>Vérifiez votre email</h2>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', lineHeight: 1.6 }}>
              Un email de confirmation a été envoyé à <strong style={{ color: 'var(--text)' }}>{form.email}</strong>.
              Cliquez sur le lien pour confirmer votre adresse, puis contactez un administrateur pour activer votre compte.
            </p>
          </div>
        </div>
      </div>
    )
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
          <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Créer un compte</div>
        </div>

        <div className="card">
          <h2 style={{ marginBottom: '0.5rem' }}>Inscription</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            Votre compte sera activé par un administrateur après vérification.
          </p>

          {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-grid" style={{ marginBottom: '1rem' }}>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Nom complet *</label>
                <input type="text" value={form.name} onChange={set('name')}
                  placeholder="Prénom Nom" autoFocus required autoComplete="name" />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Email *</label>
                <input type="email" value={form.email} onChange={set('email')}
                  placeholder="votre@email.com" required autoComplete="email" />
              </div>
              <div className="form-group">
                <label>Mot de passe * (min. 8 caractères)</label>
                <input type="password" value={form.password} onChange={set('password')}
                  placeholder="••••••••" autoComplete="new-password" />
              </div>
              <div className="form-group">
                <label>Confirmer le mot de passe *</label>
                <input type="password" value={form.confirm} onChange={set('confirm')}
                  placeholder="••••••••" required autoComplete="new-password" />
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
              disabled={loading} style={{ width: '100%', marginBottom: '1rem' }}>
              {loading ? 'Création…' : 'Créer mon compte'}
            </button>
          </form>

          <div style={{ textAlign: 'center', fontSize: '0.82rem' }}>
            <Link href="/login" style={{ color: 'var(--text-dim)' }}>
              Déjà un compte ? Se connecter
            </Link>
          </div>
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