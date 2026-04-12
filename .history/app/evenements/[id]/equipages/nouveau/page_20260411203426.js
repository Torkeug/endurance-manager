'use client'
import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { formatInZone, formatTimeInZone } from '../../../../../lib/timezone'

const CLASSES_FALLBACK = ['GTP', 'LMP2', 'GT3', 'GT4', 'CUP', 'TCR', 'Other']

const emptyForm = {
  crew_name:                '',
  car_id:                   '',
  class:                    '',
  start_time_id:            '',
  stream_url:               '',
  bop_power_percent:        '100',
  bop_weight_kg:            '0',
  bop_tank_size_litres:     '',
  refuel_time_seconds:      '30',
  tyre_change_time_seconds: '0',
}

export default function NouvelEquipage({ params }) {
  const [eventTimezone, setEventTimezone] = useState('Europe/Paris')
  const router  = useRouter()
  const { id }  = use(params)

  const [form, setForm]             = useState(emptyForm)
  const [cars, setCars]             = useState([])
  const [startTimes, setStartTimes] = useState([])
  const [crewNames, setCrewNames]   = useState([])
  const [selectedCar, setSelectedCar] = useState(null)
  const [eventName, setEventName]   = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  
  useEffect(() => {
    Promise.all([
      supabase.from('cars').select('*').order('class').order('name'),
      supabase.from('event_start_times').select('*').eq('event_id', id).order('irl_start'),
      supabase.from('events').select('name, format, timezone').eq('id', id).single(),
      supabase.from('crew_names').select('name').order('sort_order'),
    ]).then(async ([{ data: carsData }, { data: stData }, { data: evData }, { data: crewData }]) => {
      setStartTimes(stData || [])
      setEventName(evData?.name || '')
      setEventTimezone(evData?.timezone || 'Europe/Paris')
      setCrewNames(crewData?.map(c => c.name).sort((a, b) => a.localeCompare(b)) || [])

      // Filter cars by event type
      let filteredCars = carsData || []
      if (evData?.format) {
        const { data: eventType } = await supabase
          .from('event_types').select('id').eq('name', evData.format).single()
        if (eventType) {
          const { data: allowedCars } = await supabase
            .from('event_type_cars').select('car_id').eq('event_type_id', eventType.id)
          if (allowedCars && allowedCars.length > 0) {
            const allowedIds = allowedCars.map(ac => ac.car_id)
            filteredCars = filteredCars.filter(c => allowedIds.includes(c.id))
          }
        }
      }
      setCars(filteredCars)
    })
  }, [id])

  useEffect(() => {
    if (!form?.car_id || cars.length === 0) {
      setSelectedCar(null)
      return
    }
    const car = cars.find(c => c.id === form.car_id)
    if (car) {
      setSelectedCar(car)
      setForm(prev => ({ ...prev, class: car.class || '' }))
    } else {
      setSelectedCar(null)
    }
  }, [form?.car_id, cars])

  const set = (field) => (e) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.crew_name)    { setError("Le nom d'équipage est obligatoire."); return }
    if (!form.class)        { setError('La classe est obligatoire.'); return }
    if (!form.start_time_id){ setError("L'horaire de départ est obligatoire."); return }

    setLoading(true); setError(null)

    const payload = {
      event_id:                 id,
      crew_name:                form.crew_name,
      car_id:                   form.car_id             || null,            
      class:                    form.class              || null,
      start_time_id:            form.start_time_id,
      stream_url:               form.stream_url.trim()  || null,
      bop_power_percent:        parseFloat(form.bop_power_percent)        || 100,
      bop_weight_kg:            parseFloat(form.bop_weight_kg)            || 0,
      bop_tank_size_litres:     form.bop_tank_size_litres ? parseFloat(form.bop_tank_size_litres) : null,
      refuel_time_seconds:      parseInt(form.refuel_time_seconds)        || 30,
      tyre_change_time_seconds: parseInt(form.tyre_change_time_seconds)   || 0,
    }

    const { data, error: err } = await supabase
      .from('team_entries').insert([payload]).select().single()

    if (err) {
      if (err.code === '23505') {
        setError("Cet équipage est déjà inscrit pour ce créneau de départ.")
      } else {
        setError(err.message)
      }
      setLoading(false)
    }
    else { router.push(`/evenements/${id}/equipages/${data.id}`); router.refresh() }
  }

  const carsByClass = cars.reduce((acc, car) => {
    if (!acc[car.class]) acc[car.class] = []
    acc[car.class].push(car)
    return acc
  }, {})

  // Available classes from filtered cars
  const availableClasses = [...new Set(cars.map(c => c.class))].filter(Boolean).sort()

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Nouvel équipage</h1>
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

      {startTimes.length === 0 && (
        <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
          Aucun horaire de départ configuré pour cet événement.{' '}
          <Link href={`/evenements/${id}`} style={{ color: 'inherit', fontWeight: 700 }}>
            Ajoutez-en un d&apos;abord →
          </Link>
        </div>
      )}

      <form onSubmit={handleSubmit}>

        {/* Équipage & voiture */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ marginBottom: '1.25rem', color: 'var(--text-dim)' }}>Équipage &amp; voiture</h3>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="crew_name">Nom d&apos;équipage *</label>
              <select id="crew_name" value={form.crew_name} onChange={set('crew_name')} required>
                <option value="">— Sélectionner —</option>
                {crewNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="car_id">Voiture *</label>
              <select id="car_id" value={form.car_id} onChange={set('car_id')}>
                <option value="">— Sélectionner —</option>
                {Object.entries(carsByClass).map(([cls, carsInClass]) => (
                  <optgroup key={cls} label={cls}>
                    {carsInClass.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>

            {selectedCar && (
              <div className="form-group">
                <label>Réservoir (auto-rempli)</label>
                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)',
                  borderRadius: '3px', padding: '0.55rem 0.75rem',
                  fontFamily: 'var(--font-mono), monospace', fontSize: '0.9rem', color: 'var(--accent)' }}>
                  {selectedCar.tank_size_litres}L
                </div>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="class">Classe *</label>
              {selectedCar ? (
                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)',
                  borderRadius: '3px', padding: '0.55rem 0.75rem',
                  fontFamily: 'var(--font-mono), monospace', fontSize: '0.9rem', color: 'var(--accent)' }}>
                  {form.class || '—'}
                </div>
              ) : (
                <select id="class" value={form.class} onChange={set('class')} required>
                  <option value="">— Sélectionner —</option>
                  {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="stream_url">Lien stream (Twitch)</label>
              <input id="stream_url" type="url" value={form.stream_url} onChange={set('stream_url')}
                placeholder="https://twitch.tv/..." />
            </div>
          </div>
        </div>

        {/* Horaire de départ */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ marginBottom: '1.25rem', color: 'var(--text-dim)' }}>Horaire de départ *</h3>
          {startTimes.length === 0 ? (
            <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
              Aucun créneau disponible — configurez les horaires depuis la page de l&apos;événement.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {startTimes.map(st => (
                <label key={st.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  background: form.start_time_id === st.id ? 'var(--accent-dim)' : 'var(--surface-2)',
                  border: '1px solid',
                  borderColor: form.start_time_id === st.id ? 'var(--accent)' : 'var(--border)',
                  borderRadius: '3px', cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  <input type="radio" name="start_time_id" value={st.id}
                    checked={form.start_time_id === st.id}
                    onChange={set('start_time_id')}
                    style={{ accentColor: 'var(--accent)' }} />
                  <div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{st.label}</div>
                  <div className="mono" style={{ fontSize: '0.8rem', color: 'var(--accent)', marginTop: '0.1rem' }}>
                    Départ à {formatTimeInZone(st.irl_start, eventTimezone)}
                  </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Stratégie */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ marginBottom: '1.25rem', color: 'var(--text-dim)' }}>Paramètres stratégie</h3>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="bop_power_percent">BOP Puissance (%)</label>
              <input id="bop_power_percent" type="number" value={form.bop_power_percent}
                onChange={set('bop_power_percent')} min="50" max="150" step="0.1" />
            </div>
            <div className="form-group">
              <label htmlFor="bop_weight_kg">BOP Poids (kg)</label>
              <input id="bop_weight_kg" type="number" value={form.bop_weight_kg}
                onChange={set('bop_weight_kg')} min="-100" max="200" step="0.5" />
            </div>
            <div className="form-group">
              <label htmlFor="bop_tank_size_percent">BOP Réservoir (%)</label>
              <input id="bop_tank_size_percent" type="number" value={form.bop_tank_size_percent}
                onChange={set('bop_tank_size_percent')} min="50" max="150" step="0.1"
                placeholder="100" />
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
          <button type="submit" className="btn btn-primary" disabled={loading || startTimes.length === 0}>
            {loading ? 'Enregistrement…' : "✓ Ajouter l'équipage"}
          </button>
          <Link href={`/evenements/${id}`} className="btn btn-secondary">Annuler</Link>
        </div>
      </form>
    </div>
  )
}