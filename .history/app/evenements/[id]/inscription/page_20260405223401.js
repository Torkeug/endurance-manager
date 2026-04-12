'use client'
import { useState, useEffect, use } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../../../lib/supabase'

const CLASSES = ['GTP', 'LMP2', 'GT3', 'GT4', 'CUP', 'TCR']

function MismatchWarning({ message }) {
  return (
    <div style={{
      marginTop: '0.75rem', padding: '0.65rem 0.9rem',
      background: '#2a1a00', border: '1px solid #a06020',
      borderRadius: '3px', fontSize: '0.82rem', color: '#d4904a',
      display: 'flex', gap: '0.5rem', alignItems: 'flex-start',
    }}>
      <span>⚠️</span>
      <span>{message}</span>
    </div>
  )
}

export default function Inscription({ params }) {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const { id }       = use(params)

  const [drivers, setDrivers]       = useState([])
  const [cars, setCars]             = useState([])
  const [carEntries, setCarEntries] = useState([])
  const [eventName, setEventName]   = useState('')
  const [existing, setExisting]     = useState(null)
  const [fetching, setFetching]     = useState(true)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)
  const [success, setSuccess]       = useState(false)

  const [driverId, setDriverId]             = useState('')
  const [preferredClass, setPreferredClass] = useState('')
  const [preferredCarId, setPreferredCarId] = useState('')
  const [carEntryId, setCarEntryId]         = useState('')
  const [notes, setNotes]                   = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('drivers').select('id, name').eq('active', true).order('name'),
      supabase.from('cars').select('*').order('class').order('name'),
      supabase.from('events').select('name').eq('id', id).single(),
      supabase.from('car_entries')
        .select('id, crew_name, class, car_id, cars(id, name, class)')
        .eq('event_id', id).order('crew_name'),
    ]).then(([{ data: driversData }, { data: carsData }, { data: evData }, { data: entriesData }]) => {
      setDrivers(driversData || [])
      setCars(carsData || [])
      setEventName(evData?.name || '')
      setCarEntries(entriesData || [])
      setFetching(false)

      // Pre-select driver from URL param ?driver=id
      const preselect = searchParams.get('driver')
      if (preselect) setDriverId(preselect)
    })
  }, [id, searchParams])

  // Load existing signup when driver changes
  useEffect(() => {
    if (!driverId) { setExisting(null); return }
    supabase.from('signups')
      .select('*, cars(id, name, class), car_entries(id, crew_name, class, car_id, cars(name, class))')
      .eq('event_id', id).eq('driver_id', driverId).single()
      .then(({ data }) => {
        if (data) {
          setExisting(data)
          setPreferredClass(data.preferred_class || '')
          setPreferredCarId(data.preferred_car_id || '')
          setCarEntryId(data.car_entry_id || '')
          setNotes(data.notes || '')
        } else {
          setExisting(null)
          setPreferredClass('')
          setPreferredCarId('')
          setCarEntryId('')
          setNotes('')
        }
      })
  }, [driverId, id])

  // Compute mismatch warning
  const getMismatchWarning = () => {
    if (!carEntryId) return null
    const entry = carEntries.find(e => e.id === carEntryId)
    if (!entry) return null

    const entryClass = entry.class || entry.cars?.class
    const entryCarId = entry.car_id

    if (preferredCarId && entryCarId && preferredCarId !== entryCarId) {
      const prefCar = cars.find(c => c.id === preferredCarId)
      return `Votre voiture préférée (${prefCar?.name || '?'}) est différente de celle de cette équipe (${entry.cars?.name || '?'}).`
    }
    if (preferredClass && entryClass && preferredClass !== entryClass) {
      return `Votre classe préférée (${preferredClass}) est différente de celle de cette équipe (${entryClass}).`
    }
    return null
  }

  const mismatchWarning = getMismatchWarning()

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
      car_entry_id:     carEntryId      || null,
      notes:            notes.trim()    || null,
    }

    let err
    if (existing) {
      ({ error: err } = await supabase.from('signups').update(payload).eq('id', existing.id))
    } else {
      ({ error: err } = await supabase.from('signups').insert([payload]))
    }

    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
      const { data } = await supabase.from('signups')
        .select('*, cars(id, name, class), car_entries(id, crew_name, class, car_id, cars(name, class))')
        .eq('event_id', id).eq('driver_id', driverId).single()
      setExisting(data)
    }
  }

  const handleSignOff = async () => {
    if (!existing) return
    if (!confirm('Se désinscrire de cet événement ? Cette action retirera également votre assignation à une équipe.')) return
    const { error: err } = await supabase.from('signups').delete().eq('id', existing.id)
    if (err) { setError(err.message); return }
    setExisting(null)
    setPreferredClass('')
    setPreferredCarId('')
    setCarEntryId('')
    setNotes('')
    setSuccess(false)
    router.push(`/evenements/${id}`)
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
      {success && <div className="alert alert-success">Inscription enregistrée ✓</div>}

      <form onSubmit={handleSubmit}>

        {/* Who are you */}
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
              ✓ Vous êtes déjà inscrit(e) — vous pouvez modifier votre inscription ci-dessous.
            </div>
          )}
        </div>

        {/* Team */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-dim)' }}>Équipe</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '1.25rem' }}>
            Sélectionnez l&apos;équipe que vous souhaitez rejoindre.
          </p>
          {carEntries.length === 0 ? (
            <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
              Aucune équipe engagée pour cet événement.
            </p>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  background: carEntryId === '' ? 'var(--accent-dim)' : 'var(--surface-2)',
                  border: '1px solid',
                  borderColor: carEntryId === '' ? 'var(--accent)' : 'var(--border)',
                  borderRadius: '3px', cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  <input type="radio" name="car_entry_id" value=""
                    checked={carEntryId === ''}
                    onChange={() => setCarEntryId('')}
                    style={{ accentColor: 'var(--accent)' }} />
                  <span style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Pas de préférence</span>
                </label>

                {carEntries.map(entry => {
                  const entryClass = entry.class || entry.cars?.class
                  const isSelected = carEntryId === entry.id
                  return (
                    <label key={entry.id} style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.75rem 1rem',
                      background: isSelected ? 'var(--accent-dim)' : 'var(--surface-2)',
                      border: '1px solid',
                      borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                      borderRadius: '3px', cursor: 'pointer', transition: 'all 0.15s',
                    }}>
                      <input type="radio" name="car_entry_id" value={entry.id}
                        checked={isSelected}
                        onChange={() => setCarEntryId(entry.id)}
                        style={{ accentColor: 'var(--accent)' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{entry.crew_name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                          {entry.cars?.name || '—'}
                          {entryClass && ` · ${entryClass}`}
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>
              {mismatchWarning && <MismatchWarning message={mismatchWarning} />}
            </>
          )}
        </div>

        {/* Preferences */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-dim)' }}>Préférences</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '1.25rem' }}>
            Optionnel — classe ou voiture souhaitée.
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
              <label htmlFor="preferred_car_id">Voiture spécifique</label>
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
              <label htmlFor="notes">Notes</label>
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
            <button type="button" className="btn btn-danger" onClick={handleSignOff}>
              Se désinscrire
            </button>
          )}
        </div>
      </form>
    </div>
  )
}