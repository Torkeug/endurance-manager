'use client'
import { useState, useEffect, use } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'

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

function CarCheckbox({ car, checked, onChange }) {

  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      padding: '0.6rem 0.85rem',
      background: checked ? 'var(--accent-dim)' : 'var(--surface-2)',
      border: '1px solid',
      borderColor: checked ? 'var(--accent)' : 'var(--border)',
      borderRadius: '3px', cursor: 'pointer', transition: 'all 0.15s',
      minWidth: '200px',
    }}>
      <input type="checkbox" checked={checked} onChange={onChange}
        style={{ accentColor: 'var(--accent)', width: '15px', height: '15px', flexShrink: 0 }} />
      <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{car.name}</span>
    </label>
  )
}

function ClassCheckbox({ cls, checked, onChange }) {
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
      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{cls}</span>
    </label>
  )
}

export default function Inscription({ params }) {
  const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
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
  const [preferredClasses, setPreferredClasses] = useState([])
  const [preferredCarIds, setPreferredCarIds]   = useState([])
  const [carEntryId, setCarEntryId]             = useState('')
  const [notes, setNotes]                       = useState('')

  const [preferredStartTimeIds, setPreferredStartTimeIds] = useState([])
  const [startTimes, setStartTimes]                       = useState([])

    useEffect(() => {
    Promise.all([
        supabase.from('drivers').select('id, name').eq('active', true).order('name'),
        supabase.from('cars').select('id, name, class').order('class').order('name'),
        supabase.from('events').select('name, format').eq('id', id).single(),
        supabase.from('team_entries')
        .select('id, crew_name, class, car_id, cars(id, name, class)')
        .eq('event_id', id).order('crew_name'),
        supabase.from('event_start_times').select('*').eq('event_id', id).order('irl_start'),
    ]).then(async ([{ data: driversData }, { data: carsData }, { data: evData }, { data: entriesData }, { data: stData }]) => {
        setDrivers(driversData || [])
        setEventName(evData?.name || '')
        setCarEntries(entriesData || [])
        setStartTimes(stData || [])

        // Filter cars by event type if format is set
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
        setFetching(false)
        const preselect = searchParams.get('driver')
        if (preselect) {
          setDriverId(preselect)
        } else {
          // Default to logged-in user
          supabase.auth.getUser().then(async ({ data: { user } }) => {
            if (!user) return
            const { data: driver } = await supabase
              .from('drivers').select('id').eq('auth_user_id', user.id).single()
            if (driver) setDriverId(driver.id)
          })
        }
    })
    }, [id, searchParams])

  useEffect(() => {
    if (!driverId) { setExisting(null); return }
    supabase.from('signups')
      .select('*, team_entries(id, crew_name, class, car_id, cars(name, class))')
      .eq('event_id', id).eq('driver_id', driverId).single()
      .then(({ data }) => {
        if (data) {
          setExisting(data)
          setPreferredClasses(data.preferred_class || [])
          setPreferredCarIds(data.preferred_car_ids || [])
          setPreferredStartTimeIds(data.preferred_start_time_ids || [])
          setCarEntryId(data.team_entry_id || '')
          setNotes(data.notes || '')
        } else {
          setExisting(null)
          setPreferredClasses([])
          setPreferredCarIds([])
          setPreferredStartTimeIds([])
          setCarEntryId('')
          setNotes('')
        }
      })
  }, [driverId, id])

  const toggleClass = (cls) => {
    setPreferredClasses(prev =>
      prev.includes(cls) ? prev.filter(c => c !== cls) : [...prev, cls]
    )
  }

  const toggleCar = (carId) => {
    setPreferredCarIds(prev =>
      prev.includes(carId) ? prev.filter(id => id !== carId) : [...prev, carId]
    )
  }

  const toggleStartTime = (id) => {
    setPreferredStartTimeIds(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

    const getMismatchWarning = () => {
    if (!carEntryId) return null
    const entry = carEntries.find(e => e.id === carEntryId)
    if (!entry) return null
    const entryClass = entry.class || entry.cars?.class
    const entryCarId = entry.car_id

    if (preferredCarIds.length === 0 && preferredClasses.length === 0) return null

    if (preferredCarIds.length > 0) {
        // Specific cars selected — team car must be in that list
        if (!preferredCarIds.includes(entryCarId)) {
        const names = preferredCarIds.map(cid => cars.find(c => c.id === cid)?.name).filter(Boolean).join(', ')
        return `La voiture de cette équipe (${entry.cars?.name || '?'}) ne fait pas partie de vos voitures préférées (${names}).`
        }
    } else {
        // Only classes selected — team car's class must match
        if (!preferredClasses.includes(entryClass)) {
        return `La voiture de cette équipe (${entry.cars?.name || '?'} — ${entryClass}) ne correspond pas à vos classes préférées (${preferredClasses.join(', ')}).`
        }
    }
    return null
    }

  const mismatchWarning = getMismatchWarning()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!driverId) { setError('Sélectionnez votre nom.'); return }

    setLoading(true); setError(null); setSuccess(false)

    const payload = {
      event_id:          id,
      driver_id:         driverId,
      preferred_class:   preferredClasses.length > 0 ? preferredClasses : null,
      preferred_car_ids: preferredCarIds.length  > 0 ? preferredCarIds  : null,
      team_entry_id:     carEntryId || null,
      preferred_start_time_ids: preferredStartTimeIds.length > 0 ? preferredStartTimeIds : null,
      notes:             notes.trim() || null,
    }

    let err
    if (existing) {
      ({ error: err } = await supabase.from('signups').update(payload).eq('id', existing.id))
    } else {
      ({ error: err } = await supabase.from('signups').insert([payload]))
    }

    if (err) { setError(err.message); setLoading(false); return }

    setLoading(false)
    router.push(`/evenements/${id}`)
    router.refresh()
  }

  const handleSignOff = async () => {
    if (!existing) return
    if (!confirm('Se désinscrire de cet événement ?')) return
    const { error: err } = await supabase.from('signups').delete().eq('id', existing.id)
    if (err) { setError(err.message); return }
    setExisting(null); setPreferredClasses([]); setPreferredCarIds([])
    setCarEntryId(''); setNotes(''); setSuccess(false)
    router.push(`/evenements/${id}`)
  }

  // Cars class selection
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
        
        {/* Preferred start time */}
        {startTimes.length > 0 && (
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-dim)' }}>Créneaux de départ préférés</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '1rem' }}>
              Optionnel — cochez les créneaux auxquels vous souhaitez participer.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {startTimes.map(st => (
                <label key={st.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  background: preferredStartTimeIds.includes(st.id) ? 'var(--accent-dim)' : 'var(--surface-2)',
                  border: '1px solid',
                  borderColor: preferredStartTimeIds.includes(st.id) ? 'var(--accent)' : 'var(--border)',
                  borderRadius: '3px', cursor: 'pointer',
                }}>
                  <input type="checkbox"
                    checked={preferredStartTimeIds.includes(st.id)}
                    onChange={() => toggleStartTime(st.id)}
                    style={{ accentColor: 'var(--accent)' }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{st.label}</div>
                    <div className="mono" style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                      {new Date(st.irl_start).toLocaleString('fr-FR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit', hour12: false,
                      })}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

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
                  <input type="radio" name="team_entry_id" value=""
                    checked={carEntryId === ''}
                    onChange={() => setCarEntryId('')}
                    style={{ accentColor: 'var(--accent)' }} />
                  <span style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Pas de préférence</span>
                </label>

                  {carEntries
                    .map(entry => {
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
                      <input type="radio" name="team_entry_id" value={entry.id}
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
            Sélectionnez une ou plusieurs classes si vous souhaitez conduire dans cette catégorie, quelle que soit la voiture.
          </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {[...new Set(cars.map(c => c.class))].filter(Boolean).sort().map(cls => (
                <ClassCheckbox key={cls} cls={cls}
                checked={preferredClasses.includes(cls)}
                onChange={() => toggleClass(cls)} />
            ))}
            </div>
        </div>

        {/* Preferred cars */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-dim)' }}>Voitures préférées</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '1.25rem' }}>
            Optionnel — sélectionnez une ou plusieurs voitures spécifiques.
            {cars.length > 0 && ` (Voitures disponibles pour ce format d'événement)`}
            </p>
          {Object.keys(carsByClass).length === 0 ? (
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
              Sélectionnez une classe pour afficher les voitures.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {Object.entries(carsByClass).map(([cls, carsInClass]) => (
                <div key={cls}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em',
                    textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>
                    {cls}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {carsInClass.map(car => (
                      <CarCheckbox key={car.id} car={car}
                        checked={preferredCarIds.includes(car.id)}
                        onChange={() => toggleCar(car.id)} />
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