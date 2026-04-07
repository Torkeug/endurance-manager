'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase'

const emptyForm = {
  name:       '',
  iracing_id: '',
  irating:    '',
  discord:    '',
  twitch:     '',
  instagram:  '',
}

export default function NouveauPilote() {
  const router = useRouter()
  const [form, setForm]       = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Le nom est obligatoire.'); return }

    setLoading(true)
    setError(null)

    const payload = {
      name:       form.name.trim(),
      iracing_id: form.iracing_id.trim() || null,
      irating:    form.irating ? parseInt(form.irating) : null,
      discord:    form.discord.trim()    || null,
      twitch:     form.twitch.trim()     || null,
      instagram:  form.instagram.trim()  || null,
    }

    const { error: err } = await supabase.from('drivers').insert([payload])

    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      router.push('/pilotes')
      router.refresh()
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Nouveau pilote</h1>
          <div className="accent-line" />
        </div>
        <Link href="/pilotes" className="btn btn-secondary">← Retour</Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.25rem', color: 'var(--text-dim)' }}>
            Informations générales
          </h3>
          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="name">Nom *</label>
              <input
                id="name"
                type="text"
                value={form.name}
                onChange={set('name')}
                placeholder="Prénom Nom"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="iracing_id">iRacing ID</label>
              <input
                id="iracing_id"
                type="text"
                value={form.iracing_id}
                onChange={set('iracing_id')}
                placeholder="ex : 123456"
              />
            </div>

            <div className="form-group">
              <label htmlFor="irating">iRating</label>
              <input
                id="irating"
                type="number"
                value={form.irating}
                onChange={set('irating')}
                placeholder="ex : 2450"
                min="0"
                max="9999"
              />
            </div>

            <div className="form-group">
              <label htmlFor="role">Rôle</label>
              <select id="role" value={form.role} onChange={set('role')}>
                <option value="driver">Pilote</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.25rem', color: 'var(--text-dim)' }}>
            Réseaux sociaux
          </h3>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="discord">Discord</label>
              <input
                id="discord"
                type="text"
                value={form.discord}
                onChange={set('discord')}
                placeholder="ex : pilote#1234"
              />
            </div>

            <div className="form-group">
              <label htmlFor="twitch">Twitch</label>
              <input
                id="twitch"
                type="text"
                value={form.twitch}
                onChange={set('twitch')}
                placeholder="nom d'utilisateur Twitch"
              />
            </div>

            <div className="form-group">
              <label htmlFor="instagram">Instagram</label>
              <input
                id="instagram"
                type="text"
                value={form.instagram}
                onChange={set('instagram')}
                placeholder="@compte"
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Enregistrement…' : '✓ Enregistrer le pilote'}
          </button>
          <Link href="/pilotes" className="btn btn-secondary">
            Annuler
          </Link>
        </div>
      </form>
    </div>
  )
}