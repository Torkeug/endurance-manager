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
      <span>⚠️</span><span>{message}</span>
    </div>
  )
}

function Checkbox({ checked, onChange, label, sub }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: '0.6rem',
      padding: '0.6rem 0.85rem',
      background: checked ? 'var(--accent-dim)' : 'var(--surface-2)',
      border: '1px solid',
      borderColor: checked ? 'var(--accent)' : 'var(--border)',
      borderRadius: '3px', cursor: 'pointer', transition: 'all 0.15s',
    }}>
      <input type="checkbox" checked={checked} onChange={onChange}
        style={{ accentColor: 'var(--accent)', width: '15px', height: '15px' }} />
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{label}</div>
        {sub && <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{sub}</div>}
      </div>
    </label>
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

  const [driverId, setDriverId]               = useState('')
  const [preferredClasses, setPreferredClasses] = useState([])   // string[]
  const [preferredCarIds, setPreferredCarIds]   = useState([])   // uuid[]
  const [carEntryId, setCarEntryId]             = useState('')
  const [notes, setNotes]                       = useState('')

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
      const preselect = searchParams.get('driver')
      if (preselect) setDriverId(preselect)
    })
  }, [id, searchParams])

  useEffect(() => {
    if (!driverId) { setExisting(null); return }
    supabase.from('signups')
      .select('*, car_entries(id, crew_name, class, car_id, cars(name, class))')
      .eq('event_id', id).eq('driver_id', driverId).single()
      .then(({ data }) => {
        if (data) {
          setExisting(data)
          setPreferredClasses(data.preferred_class || [])
          setPreferredCarIds(data.preferred_car_ids || [])
          setCarEntryId(data.car_entry_id || '')
          setNotes(data.notes || '')
        } else {
          setExisting(null)
          setPreferredClasses([])
          setPreferredCarIds([])
          setCarEntryId('')
          setNotes('')
        }
      })
  }, [driverId, id])

  const toggleClass = (cls) => {
    setPreferredClasses(prev =>
      prev.includes(cls) ? prev.filter(c => c !== cls) : [...prev, cls]
    )
    // Clear car selections that don't match any selected class
    if (!preferredClasses.includes(cls)) return
    const remaining = preferredClasses.filter(c => c !== cls)
    if (remaining.length > 0) {
      setPreferredCarIds(prev =>
        prev.filter(cid => {
          const car = cars.find(c => c.id === cid)
          return remaining.includes(car?.class)
        })
      )
    }
  }

  const toggleCar = (carId) => {
    setPreferredCarIds(prev =>
      prev.includes(carId) ? prev.filter(id => id !== carId) : [...prev, carId]
    )
  }

  // Mismatch warning for selected team
  const getMismatchWarning = () => {
    if (!carEntryId) return null
    const entry = carEntries.find(e => e.id === carEntryId)
    if (!entry) return null
    const entryClass = entry.class || entry.cars?.class
    const entryCarId = entry.car_id

    if (preferredCarIds.length > 0 && entryCarId && !preferredCarIds.includes(entryCarId)) {
      const prefCarNames = preferredCarIds
        .map(cid => cars.find(c => c.id === cid)?.name).filter(Boolean).join(', ')
      return `Vos voitures préférées (${prefCarNames}) ne correspondent pas à celle de cette équipe (${entry.cars?.name || '?'}).`
    }
    if (preferredClasses.length > 0 && entryClass && !preferredClasses.includes(entryClass)) {
      return `Vos classes préférées (${preferredClasses.join(', ')}) ne correspondent pas à celle de cette équipe (${entryClass}).`
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
      event_id:          id,
      driver_id:         driverId,
      preferred_class:   preferredClasses.length > 0 ? preferredClasses : null,
      preferred_car_ids: preferredCarIds.length  > 0 ? preferredCarIds  : null,
      car_entry_id:      carEntryId || null,
      notes:             notes.trim() || null,
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
        .select('*, car_entries(id, crew_name, class, car_id, cars(name, class))')
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
    setPreferredClasses([])
    setPreferredCarIds([])
    setCarEntryId('')
    setNotes('')
    setSuccess(false)
    router.push(`/evenements/${id}`)
  }

  // Cars filtered by selected classes (show all if no class selected)
  const carsByClass = cars.reduce((acc, car) => {
    if (preferredClasses.length === 0 || preferredClasses.includes(car.class)) {
      if (!acc[car.class]) acc[car.class] = []
      acc[car.class].push(car)
    }
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
                          {entry.cars?.name || '—'}{entryClass && ` · ${entryClass}`}
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

        {/* Preferred classes */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-dim)' }}>Classes préférées</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '1.25rem' }}>
            Sélectionnez une ou plusieurs classes. Les voitures ci-dessous se filtreront en conséquence.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {CLASSES.map(cls => (
              <Checkbox
                key={cls}
                checked={preferredClasses.includes(cls)}
                onChange={() => toggleClass(cls)}
                label={cls}
              />
            ))}
          </div>
        </div>

        {/* Preferred cars */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-dim)' }}>Voitures préférées</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '1.25rem' }}>
            Optionnel — sélectionnez une ou plusieurs voitures spécifiques.
            {preferredClasses.length > 0 && ` Filtré sur : ${preferredClasses.join(', ')}.`}
          </p>
          {Object.keys(carsByClass).length === 0 ? (
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
              Sélectionnez une classe pour afficher les voitures.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {Object.entries(carsByClass).map(([cls, carsInClass]) => (
                <div key={cls}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em',
                    textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>
                    {cls}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {carsInClass.map(car => (
                      <Checkbox
                        key={car.id}
                        checked={preferredCarIds.includes(car.id)}
                        onChange={() => toggleCar(car.id)}
                        label={car.name}
                        sub={`${car.tank_size_litres}L`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ marginBottom: '1.25rem', color: 'var(--text-dim)' }}>Notes</h3>
          <div className="form-group">
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="ex : disponible uniquement le samedi soir…" />
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
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>
                La désinscription ne devrait être effectuée que par le pilote concerné ou un admin.
              </p>
              <button type="button" className="btn btn-danger" onClick={handleSignOff}>
                Se désinscrire
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  )
}