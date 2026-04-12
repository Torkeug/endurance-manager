'use client'
import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'

export default function ModifierChampionnat({ params }) {
  const router = useRouter()
  const { id } = use(params)
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const [form, setForm]         = useState({ name: '', season: '' })
  const [loading, setLoading]   = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError]       = useState(null)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      const { data: driver } = await supabase
        .from('drivers').select('role').eq('auth_user_id', user.id).single()
      if (!driver || (driver.role !== 'admin' && driver.role !== 'super_admin')) {
        router.push('/'); return
      }
      setAuthChecked(true)
    })
  }, [])

  useEffect(() => {
    supabase.from('championships').select('*').eq('id', id).single()
      .then(({ data, error: err }) => {
        if (err || !data) { setError('Championnat introuvable.'); setFetching(false); return }
        setForm({ name: data.name || '', season: data.season || '', archived: data.archived || false })
        setFetching(false)
      })
  }, [id])

  const set = field => e => setForm(prev => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Le nom est obligatoire.'); return }
    setLoading(true); setError(null)

    const { error: err } = await supabase
      .from('championships')
      .update({ name: form.name.trim(), season: form.season.trim() || null })
      .eq('id', id)

    if (err) { setError(err.message); setLoading(false); return }
    router.push('/evenements')
    router.refresh()
  }

    const handleArchiveToggle = async () => {
    const isArchived = form.archived
    const msg = isArchived ? 'Désarchiver ce championnat ?' : 'Archiver ce championnat ?'
    if (!confirm(msg)) return
    const { error: err } = await supabase
        .from('championships').update({ archived: !isArchived }).eq('id', id)
    if (err) { setError(err.message); return }
    router.push('/evenements')
    router.refresh()
    }

  const handleDelete = async () => {
    if (!confirm('Supprimer définitivement ce championnat ? Les manches ne seront pas supprimées mais seront détachées du championnat.')) return
    const { error: err } = await supabase.from('championships').delete().eq('id', id)
    if (err) { setError(err.message); return }
    router.push('/evenements')
    router.refresh()
  }

  if (fetching) return <div className="page"><p style={{ color: 'var(--text-dim)' }}>Chargement…</p></div>
  if (!authChecked) return <div className="page"><p style={{ color: 'var(--text-dim)' }}>Vérification des droits…</p></div>

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Modifier le championnat</h1>
          <div className="accent-line" />
        </div>
        <Link href="/evenements" className="btn btn-secondary">← Retour</Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ marginBottom: '1.25rem', color: 'var(--text-dim)' }}>Informations</h3>
          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="name">Nom du championnat *</label>
              <input id="name" type="text" value={form.name} onChange={set('name')} required />
            </div>
            <div className="form-group">
              <label htmlFor="season">Saison</label>
              <input id="season" type="text" value={form.season} onChange={set('season')}
                placeholder="ex : 2026 Saison 1" />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Enregistrement…' : '✓ Enregistrer'}
            </button>
            <Link href="/evenements" className="btn btn-secondary">Annuler</Link>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="button" className="btn btn-secondary" onClick={handleArchiveToggle}>
                {form.archived ? '↩ Désarchiver' : '📦 Archiver'}
            </button>
            <button type="button" className="btn btn-danger" onClick={handleDelete}>
              Supprimer
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}