'use client'
import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../../../../lib/supabase'

const CREW_NAMES = [
  'Kronos White', 'Kronos Silver', 'Kronos Gold', 'Kronos Black',
  'NWS White',    'NWS Silver',    'NWS Gold',    'NWS Black',
  'Pulse White',  'Pulse Silver',  'Pulse Gold',  'Pulse Black',
  'Kronos Family',
]

const CLASSES = ['GTP', 'LMP2', 'GT3', 'GT4', 'CUP', 'TCR', 'Other']

const emptyForm = {
  crew_name:               '',
  car_id:                  '',
  class:                   '',
  irl_start_date:          '',
  irl_start_time:          '',
  sof:                     '',
  stream_url:              '',
  bop_percent:             '100',
  refuel_time_seconds:     '30',
  tyre_change_time_seconds:'0',
  ig_sunrise:              '',
  ig_sunset:               '',
}

export default function NouvelleVoiture({ params }) {
  const router     = useRouter()
  const { id }     = use(params)   // event id

  const [form, setForm]     = useState(emptyForm)
  const [cars, setCars]     = useState([])
  const [selectedCar, setSelectedCar] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState(null)
  const [eventName, setEventName] = useState('')

  // Load cars list + event name
  useEffect(() => {
    supabase.from('cars').select('*').order('class').order('name')
      .then(({ data }) => setCars(data || []))
    supabase.from('events').select('name').eq('id', id).single()
      .then(({ data }) => setEventName(data?.name || ''))
  }, [id])

  // Auto-fill class when car changes
  useEffect(() => {
    if (!form.car_id) { setSelectedCar(null); return }
    const car = cars.find(c => c.id === form.car_id)
    if (car) {
      setSelectedCar(car)
      setForm(prev => ({ ...prev, class: car.class }))
    }
  }, [form.car_id, cars])

  const set = (field) => (e) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.crew_name) { setError('Le nom d\'équipage est obligatoire.'); return }
    if (!form.car_id)    { setError('La voiture est obligatoire.'); return }

    setLoading(true)
    setError(null)

    let irl_start = null
    if (form.irl_start_date) {
      const t = form.irl_start_time || '00:00'
      irl_start = `${form.irl_start_date}T${t}:00`
    }

    const payload = {
      event_id:                id,
      crew_name:               form.crew_name,
      car_id:                  form.car_id,
      class:                   form.class    || null,
      irl_start,
      sof:                     form.sof      ? parseInt(form.sof)              : null,
      stream_url:              form.stream_url.trim() || null,
      bop_percent:             parseFloat(form.bop_percent)             || 100,
      refuel_time_seconds:     parseInt(form.refuel_time_seconds)       || 30,
      tyre_change_time_seconds:parseInt(form.tyre_change_time_seconds)  || 0,
      ig_sunrise:              form.ig_sunrise || null,
      ig_sunset:               form.ig_sunset  || null,
    }

    const { data, error: err } = await supabase
      .from('car_entries').insert([payload]).select().single()

    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      router.push(`/evenements/${id}/voitures/${data.id}`)
      router.refresh()
    }
  }

  // Group cars by class for the dropdown
  const carsByClass = cars.reduce((acc, car) => {
    if (!acc[car.class]) acc[car.class] = []
    acc[car.class].push(car)
    return acc
  }, {})

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Nouvelle voiture</h1>
          <div className="accent-line" />
          {eventName && (
            <div style={{ marginTop: '0.4rem', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
              {eventName}
            </div>
          )}
        </div>
        <Link href={`/evenements/${id}`} className="btn btn-secondary">← Retour</Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit}>

        {/* Section 1 — Équipage & voiture */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ marginBottom: '1.25rem', color: 'var(--text-dim)' }}>Équipage &amp; voiture</h3>
          <div className="form-grid">

            <div className="form-group">
              <label htmlFor="crew_name">Nom d&apos;équipage *</label>
              <select id="crew_name" value={form.crew_name} onChange={set('crew_name')} required>
                <option value="">— Sélectionner —</option>
                {CREW_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="car_id">Voiture *</label>
              <select id="car_id" value={form.car_id} onChange={set('car_id')} required>
                <option value="">— Sélectionner —</option>
                {Object.entries(carsByClass).map(([cls, carsInClass]) => (
                  <optgroup key={cls} label={cls}>
                    {carsInClass.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Auto-filled info */}
            {selectedCar && (
              <>
                <div className="form-group">
                  <label>Réservoir (auto-rempli)</label>
                  <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)',
                    borderRadius: '3px', padding: '0.55rem 0.75rem',
                    fontFamily: 'var(--font-mono), monospace', fontSize: '0.9rem', color: 'var(--accent)' }}>
                    {selectedCar.tank_size_litres}L
                  </div>
                </div>
              </>
            )}

            <div className="form-group">
              <label htmlFor="class">Classe</label>
              <select id="class" value={form.class} onChange={set('class')}>
                <option value="">— Sélectionner —</option>
                {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="sof">SOF</label>
              <input id="sof" type="number" value={form.sof} onChange={set('sof')}
                placeholder="ex : 2500" min="0" />
            </div>

            <div className="form-group">
              <label htmlFor="stream_url">Lien stream (Twitch)</label>
              <input id="stream_url" type="url" value={form.stream_url} onChange={set('stream_url')}
                placeholder="https://twitch.tv/..." />
            </div>
          </div>
        </div>

        {/* Section 2 — Horaires */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-dim)' }}>Horaires</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '1.25rem' }}>
            Si différent de l&apos;événement (ex : départ décalé pour une classe).
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
              <label htmlFor="ig_sunrise">Lever de soleil IG (HH:MM)</label>
              <input id="ig_sunrise" type="time" value={form.ig_sunrise} onChange={set('ig_sunrise')} />
            </div>
            <div className="form-group">
              <label htmlFor="ig_sunset">Coucher de soleil IG (HH:MM)</label>
              <input id="ig_sunset" type="time" value={form.ig_sunset} onChange={set('ig_sunset')} />
            </div>
          </div>
        </div>

        {/* Section 3 — Paramètres stratégie */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ marginBottom: '1.25rem', color: 'var(--text-dim)' }}>Paramètres stratégie</h3>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="bop_percent">BOP (%)</label>
              <input id="bop_percent" type="number" value={form.bop_percent} onChange={set('bop_percent')}
                min="50" max="150" step="0.1" />
            </div>
            <div className="form-group">
              <label htmlFor="refuel_time_seconds">Temps ravitaillement (sec)</label>
              <input id="refuel_time_seconds" type="number" value={form.refuel_time_seconds}
                onChange={set('refuel_time_seconds')} min="0" max="300" />
            </div>
            <div className="form-group">
              <label htmlFor="tyre_change_time_seconds">Temps changement pneus (sec)</label>
              <input id="tyre_change_time_seconds" type="number" value={form.tyre_change_time_seconds}
                onChange={set('tyre_change_time_seconds')} min="0" max="300" />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Enregistrement…' : '✓ Ajouter la voiture'}
          </button>
          <Link href={`/evenements/${id}`} className="btn btn-secondary">Annuler</Link>
        </div>
      </form>
    </div>
  )
}