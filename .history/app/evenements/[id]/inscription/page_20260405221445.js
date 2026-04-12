'use client'
import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../../../lib/supabase'

const CLASSES = ['GTP', 'LMP2', 'GT3', 'GT4', 'CUP', 'TCR']

export default function Inscription({ params }) {
  const router  = useRouter()
  const { id }  = use(params)

  const [drivers, setDrivers]       = useState([])
  const [cars, setCars]             = useState([])
  const [eventName, setEventName]   = useState('')
  const [existing, setExisting]     = useState(null)  // existing signup if any
  const [fetching, setFetching]     = useState(true)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)
  const [success, setSuccess]       = useState(false)

  const [driverId, setDriverId]         = useState('')
  const [preferredClass, setPreferredClass] = useState('')
  const [preferredCarId, setPreferredCarId] = useState('')
  const [notes, setNotes]               = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('drivers').select('id, name').eq('active', true).order('name'),
      supabase.from('cars').select('*').order('class').order('name'),
      supabase.from('events').select('name').eq('id', id).single(),
    ]).then(([{ data: driversData }, { data: carsData }, { data: evData }]) => {
      setDrivers(driversData || [])
      setCars(carsData || [])
      setEventName(evData?.name || '')
      setFetching(false)
    })
  }, [id])

  // When driver changes, check if they already have a signup
  useEffect(() => {
    if (!driverId) { setExisting(null); return }
    supabase.from('signups').select('*, cars(name)')
      .eq('event_id', id).eq('driver_id', driverId).single()
      .then(({ data }) => {
        if (data) {
          setExisting(data)
          setPreferredClass(data.preferred_class || '')
          setPreferredCarId(data.preferred_car_id || '')
          setNotes(data.notes || '')
        } else {
          setExisting(null)
          setPreferredClass('')
          setPreferredCarId('')
          setNotes('')
        }
      })
  }, [driverId, id])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!driverId) { setError('Sélectionnez votre nom.'); return }

    setLoading(true)
    setError(null)
    setSuccess(false)

    const payload = {
      event_id:         id,
      driver_id:        driverId,
      preferred_class:  preferredClass  || null,
      preferred_car_id: preferredCarId  || null,
      notes:            notes.trim()    || null,
    }

    let err
    if (existing) {
      // Update existing signup
      ({ error: err } = await supabase.from('signups')
        .update(payload).eq('id', existing.id))
    } else {
      // New signup
      ({ error: err } = await supabase.from('signups').insert([payload]))
    }

    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
      // Refresh existing signup
      const { data } = await supabase.from('signups').select('*, cars(name)')
        .eq('event_id', id).eq('driver_id', driverId).single()
      setExisting(data)
    }
  }

  const handleCancel = async () => {
    if (!existing) return
    if (!confirm('Annuler votre inscription à cet événement ?')) return
    const { error: err } = await supabase.from('signups').delete().eq('id', existing.id)
    if (err) { setError(err.message); return }
    setExisting(null)
    setPreferredClass('')
    setPreferredCarId('')
    setNotes('')
    setSuccess(false)
  }

  const carsByClass = cars.reduce((acc, car) => {
    if (!acc[car.class]) acc[car.class] = []
    acc[car.class].push(car)
    return acc
  }, {})

  if (fetching) return <div className="page"><p style={{ color: 'var(--text-dim)' }}>Chargement…</p></div>

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Inscription</h1>
          <div className="accent-line" />
          {eventName && (
            <div style={{ marginTop: '0.4rem', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
              {eventName}
            </div>
          )}
        </div>
        <Link href={`/evenements/${id}`} className="btn btn-secondary">← Retour</Link>
      </div>

      {error   && <div className="alert alert-error">{error}</div>}
      {success && (
        <div className="alert alert-success">
          {existing ? 'Inscription mise à jour ✓' : 'Inscription enregistrée ✓'}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Step 1 — Who are you? */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ marginBottom: '1.25rem', color: 'var(--text-dim)' }}>Qui êtes-vous ?</h3>
          <div className="form-group">
            <label htmlFor="driver_id">Votre nom *</label>
            <select id="driver_id" value={driverId}
              onChange={e => setDriverId(e.target.value)} required>
              <option value="">— Sélectionnez votre nom —</option>
              {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          {existing && (
            <div style={{
              marginTop: '1rem', padding: '0.75rem 1rem',
              background: 'var(--surface-2)', border: '1px solid var(--accent-dim)',
              borderRadius: '3px', fontSize: '0.85rem', color: 'var(--accent)',
            }}>
              ✓ Vous êtes déjà inscrit(e) à cet événement — vous pouvez modifier votre inscription ci-dessous.
            </div>
          )}
        </div>

        {/* Step 2 — Preferences */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-dim)' }}>Préférences</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '1.25rem' }}>
            Indiquez une classe ou une voiture spécifique. Ces préférences sont indicatives — l&apos;assignation finale se fait en équipe.
          </p>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="preferred_class">Classe préférée</label>
              <select id="preferred_class" value={preferredClass}
                onChange={e => { setPreferredClass(e.target.value); setPreferredCarId('') }}>
                <option value="">— Pas de préférence —</option>
                {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="preferred_car_id">Voiture spécifique (optionnel)</label>
              <select id="preferred_car_id" value={preferredCarId}
                onChange={e => setPreferredCarId(e.target.value)}>
                <option value="">— Pas de préférence —</option>
                {Object.entries(carsByClass)
                  .filter(([cls]) => !preferredClass || cls === preferredClass)
                  .map(([cls, carsInClass]) => (
                    <optgroup key={cls} label={cls}>
                      {carsInClass.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </optgroup>
                  ))}
              </select>
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="notes">Notes (disponibilités particulières, commentaires…)</label>
              <textarea id="notes" value={notes}
                onChange={e => setNotes(e.target.value)} rows={3}
                placeholder="ex : disponible uniquement le samedi soir…" />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="submit" className="btn btn-primary" disabled={loading || !driverId}>
              {loading ? 'Enregistrement…' : existing ? '✓ Mettre à jour' : "✓ M'inscrire"}
            </button>
            <Link href={`/evenements/${id}`} className="btn btn-secondary">Annuler</Link>
          </div>
          {existing && (
            <button type="button" className="btn btn-danger" onClick={handleCancel}>
              Se désinscrire
            </button>
          )}
        </div>
      </form>
    </div>
  )
}