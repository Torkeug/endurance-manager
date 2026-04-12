'use client'
import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../../../lib/supabase'

export default function ModifierPilote({ params }) {
  const router = useRouter()
  const { id } = use(params)

  const [form, setForm]         = useState(null)
  const [loading, setLoading]   = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => {
    supabase
      .from('drivers')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { setError('Pilote introuvable.'); setFetching(false); return }
        setForm({
          name:       data.name       || '',
          iracing_id: data.iracing_id || '',
          irating:    data.irating    ?? '',
          discord:    data.discord    || '',
          twitch:     data.twitch     || '',
          instagram:  data.instagram  || '',
          role:       data.role       || 'driver',
        })
        setFetching(false)
      })
  }, [id])

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
      role:       form.role,
    }

    const { error: err } = await supabase
      .from('drivers').update(payload).eq('id', id)

    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      router.push('/pilotes')
      router.refresh()
    }
  }

  const handleDelete = async () => {
    if (!confirm('Supprimer ce pilote ? Cette action est irréversible.')) return
    const { error: err } = await supabase.from('drivers').delete().eq('id', id)
    if (err) { setError(err.message); return }
    router.push('/pilotes')
    router.refresh()
  }

  if (fetching) return (
    <div className="page">
      <p style={{ color: 'var(--text-dim)' }}>Chargement…</p>
    </div>
  )

  if (!form) return (
    <div className="page">
      <div className="alert alert-error">{error || 'Pilote introuvable.'}</div>
      <Link href="/pilotes" className="btn btn-secondary">← Retour</Link>
    </div>
  )

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Modifier le pilote</h1>
          <div className="accent-line" />
        </div>
        <Link href="/pilotes" className="btn btn-secondary">← Retour</Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.25rem', color: 'var(--text-dim)' }}>Informations générales</h3>
          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="name">Nom *</label>
              <input id="name" type="text" value={form.name} onChange={set('name')} required />
            </div>
            <div className="form-group">
              <label htmlFor="iracing_id">iRacing ID</label>
              <input id="iracing_id" type="text" value={form.iracing_id} onChange={set('iracing_id')} />
            </div>
            <div className="form-group">
              <label htmlFor="irating">iRating</label>
              <input id="irating" type="number" value={form.irating} onChange={set('irating')} min="0" max="9999" />
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
          <h3 style={{ marginBottom: '1.25rem', color: 'var(--text-dim)' }}>Réseaux sociaux</h3>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="discord">Discord</label>
              <input id="discord" type="text" value={form.discord} onChange={set('discord')} />
            </div>
            <div className="form-group">
              <label htmlFor="twitch">Twitch</label>
              <input id="twitch" type="text" value={form.twitch} onChange={set('twitch')} />
            </div>
            <div className="form-group">
              <label htmlFor="instagram">Instagram</label>
              <input id="instagram" type="text" value={form.instagram} onChange={set('instagram')} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Enregistrement…' : '✓ Enregistrer'}
            </button>
            <Link href="/pilotes" className="btn btn-secondary">Annuler</Link>
          </div>
          <button type="button" className="btn btn-danger" onClick={handleDelete}>Supprimer</button>
        </div>
      </form>
    </div>
  )
}