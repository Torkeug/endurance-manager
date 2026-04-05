'use client'
import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../../../lib/supabase'

const FORMATS = ['NEC', 'IMSA', 'GT World Challenge', 'Fanatec', 'VCO', 'Libre']

const DURATIONS = [
  { label: '2h30', value: 2.5 },
  { label: '3h',   value: 3 },
  { label: '6h',   value: 6 },
  { label: '8h',   value: 8 },
  { label: '12h',  value: 12 },
  { label: '24h',  value: 24 },
]

export default function ModifierEvenement({ params }) {
  const router  = useRouter()
  const { id }  = use(params)

  const [form, setForm]         = useState(null)
  const [circuits, setCircuits] = useState([])
  const [pitTime, setPitTime]   = useState(null)
  const [loading, setLoading]   = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => {
    Promise.all([
      supabase.from('circuits').select('id, name, pit_lane_time_seconds').order('name'),
      supabase.from('events').select('*').eq('id', id).single(),
    ]).then(([{ data: circuitsData }, { data: event, error: eventError }]) => {
      setCircuits(circuitsData || [])
      if (eventError || !event) { setError('Événement introuvable.'); setFetching(false); return }

      let irl_start_date = ''
      let irl_start_time = ''
      if (event.irl_start) {
        const dt = new Date(event.irl_start)
        irl_start_date = dt.toISOString().slice(0, 10)
        irl_start_time = dt.toISOString().slice(11, 16)
      }

      setForm({
        name:           event.name          || '',
        date:           event.date          || '',
        irl_start_date,
        irl_start_time,
        duration_hours: event.duration_hours ?? '',
        circuit_id:     event.circuit_id    || '',
        format:         event.format        || '',
        ig_start_time:  event.ig_start_time || '',
        notes:          event.notes         || '',
      })
      setFetching(false)
    })
  }, [id])

  useEffect(() => {
    if (!form?.circuit_id) { setPitTime(null); return }
    const c = circuits.find(c => c.id === form.circuit_id)
    setPitTime(c ? c.pit_lane_time_seconds : null)
  }, [form?.circuit_id, circuits])

  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const setDuration = (value) =>
    setForm((prev) => ({ ...prev, duration_hours: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim())    { setError('Le nom est obligatoire.'); return }
    if (!form.date)           { setError('La date est obligatoire.'); return }
    if (!form.duration_hours) { setError('La durée est obligatoire.'); return }
    if (!form.circuit_id)     { setError('Le circuit est obligatoire.'); return }

    setLoading(true)
    setError(null)

    let irl_start = null
    if (form.irl_start_date) {
      const t = form.irl_start_time || '00:00'
      irl_start = `${form.irl_start_date}T${t}:00`
    }

    const payload = {
      name:           form.name.trim(),
      date:           form.date,
      duration_hours: parseFloat(form.duration_hours),
      circuit_id:     form.circuit_id,
      format:         form.format        || null,
      irl_start,
      ig_start_time:  form.ig_start_time || null,
      notes:          form.notes.trim()  || null,
    }

    const { error: err } = await supabase.from('events').update(payload).eq('id', id)

    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      router.push(`/evenements/${id}`)
      router.refresh()
    }
  }

  const handleDelete = async () => {
    if (!confirm('Supprimer cet événement ? Toutes les données associées seront supprimées.')) return
    const { error: err } = await supabase.from('events').delete().eq('id', id)
    if (err) { setError(err.message); return }
    router.push('/evenements')
    router.refresh()
  }

  const durationButtonStyle = (value) => ({
    padding: '0.45rem 1rem', borderRadius: '3px', border: '1px solid',
    borderColor: form.duration_hours === value ? 'var(--accent)' : 'var(--border)',
    background: form.duration_hours === value ? 'var(--accent-dim)' : 'var(--surface-2)',
    color: form.duration_hours === value ? 'var(--accent)' : 'var(--text-dim)',
    fontFamily: 'var(--font-mono), monospace', fontWeight: 600, cursor: 'pointer',
    fontSize: '0.9rem', transition: 'all 0.15s',
  })

  if (fetching) return <div className="page"><p style={{ color: 'var(--text-dim)' }}>Chargement…</p></div>
  if (!form) return (
    <div className="page">
      <div className="alert alert-error">{error}</div>
      <Link href="/evenements" className="btn btn-secondary">← Retour</Link>
    </div>
  )

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Modifier l&apos;événement</h1>
          <div className="accent-line" />
        </div>
        <Link href={`/evenements/${id}`} className="btn btn-secondary">← Retour</Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ marginBottom: '1.25rem', color: 'var(--text-dim)' }}>Informations générales</h3>
          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="name">Nom *</label>
              <input id="name" type="text" value={form.name} onChange={set('name')} required />
            </div>
            <div className="form-group">
              <label htmlFor="date">Date de l&apos;événement *</label>
              <input id="date" type="date" value={form.date} onChange={set('date')} required />
            </div>
            <div className="form-group">
              <label htmlFor="format">Format</label>
              <select id="format" value={form.format} onChange={set('format')}>
                <option value="">— Sélectionner —</option>
                {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Durée *</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {DURATIONS.map(({ label, value }) => (
                  <button key={value} type="button" onClick={() => setDuration(value)} style={durationButtonStyle(value)}>
                    {label}
                  </button>
                ))}
                <input type="number" min="0.5" max="48" step="0.5"
                  value={DURATIONS.some(d => d.value === form.duration_hours) ? '' : form.duration_hours}
                  onChange={set('duration_hours')} placeholder="Autre (h)"
                  style={{ width: '120px', padding: '0.45rem 0.75rem', background: 'var(--surface-2)',
                    border: '1px solid var(--border)', borderRadius: '3px', color: 'var(--text)',
                    fontFamily: 'var(--font-mono), monospace', fontSize: '0.9rem' }} />
              </div>
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="notes">Notes</label>
              <textarea id="notes" value={form.notes} onChange={set('notes')} rows={2} />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ marginBottom: '1.25rem', color: 'var(--text-dim)' }}>Circuit</h3>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="circuit_id">Circuit *</label>
              <select id="circuit_id" value={form.circuit_id} onChange={set('circuit_id')} required>
                <option value="">— Sélectionner —</option>
                {circuits.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Temps pit lane (auto-rempli)</label>
              <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: '3px', padding: '0.55rem 0.75rem',
                fontFamily: 'var(--font-mono), monospace', fontSize: '0.9rem',
                color: pitTime ? 'var(--accent)' : 'var(--text-dim)' }}>
                {pitTime ? `${pitTime}s` : '— sélectionnez un circuit'}
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-dim)' }}>Horaires</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '1.25rem' }}>
            IRL = heure réelle. IG = heure dans iRacing au moment du départ. Heures en format 24h.
          </p>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="irl_start_date">Date de départ IRL</label>
              <input id="irl_start_date" type="date" value={form.irl_start_date} onChange={set('irl_start_date')} />
            </div>
            <div className="form-group">
              <label htmlFor="irl_start_time">Heure de départ IRL (24h)</label>
              <input id="irl_start_time" type="time" value={form.irl_start_time} onChange={set('irl_start_time')} />
            </div>
            <div className="form-group">
              <label htmlFor="ig_start_time">Heure de départ IG (24h)</label>
              <input id="ig_start_time" type="time" value={form.ig_start_time} onChange={set('ig_start_time')} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Enregistrement…' : '✓ Enregistrer'}
            </button>
            <Link href={`/evenements/${id}`} className="btn btn-secondary">Annuler</Link>
          </div>
          <button type="button" className="btn btn-danger" onClick={handleDelete}>
            Supprimer l&apos;événement
          </button>
        </div>
      </form>
    </div>
  )
}