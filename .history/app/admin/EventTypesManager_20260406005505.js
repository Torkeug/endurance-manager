'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function EventTypesManager({ initialEventTypes, initialEventTypeCars, cars, carClasses }) {
  const router = useRouter()
  const [eventTypes, setEventTypes]       = useState(initialEventTypes)
  const [eventTypeCars, setEventTypeCars] = useState(initialEventTypeCars)
  const [adding, setAdding]               = useState(false)
  const [editingId, setEditingId]         = useState(null)
  const [expandedId, setExpandedId]       = useState(null)
  const [newName, setNewName]             = useState('')
  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState(null)

  const reset = () => {
    setAdding(false); setEditingId(null)
    setNewName(''); setError(null)
  }

  const getAllowedCarIds = (eventTypeId) =>
    eventTypeCars.filter(etc => etc.event_type_id === eventTypeId).map(etc => etc.car_id)

  const handleAdd = async () => {
    if (!newName.trim()) { setError('Le nom est obligatoire.'); return }
    setSaving(true)
    const { data, error: err } = await supabase.from('event_types')
      .insert([{ name: newName.trim(), sort_order: (eventTypes.length + 1) * 10 }])
      .select().single()
    if (err) { setError(err.message); setSaving(false); return }
    setEventTypes(prev => [...prev, data])
    reset(); setSaving(false); router.refresh()
  }

  const handleEdit = async () => {
    if (!newName.trim()) { setError('Le nom est obligatoire.'); return }
    setSaving(true)
    const { data, error: err } = await supabase.from('event_types')
      .update({ name: newName.trim() }).eq('id', editingId).select().single()
    if (err) { setError(err.message); setSaving(false); return }
    setEventTypes(prev => prev.map(t => t.id === editingId ? data : t))
    reset(); setSaving(false); router.refresh()
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce type d\'événement ?')) return
    const { error: err } = await supabase.from('event_types').delete().eq('id', id)
    if (err) { setError(err.message); return }
    setEventTypes(prev => prev.filter(t => t.id !== id))
    setEventTypeCars(prev => prev.filter(etc => etc.event_type_id !== id))
    if (expandedId === id) setExpandedId(null)
    router.refresh()
  }

  const toggleCar = async (eventTypeId, carId, currentlyAllowed) => {
    if (currentlyAllowed) {
      const { error: err } = await supabase.from('event_type_cars')
        .delete().eq('event_type_id', eventTypeId).eq('car_id', carId)
      if (err) { setError(err.message); return }
      setEventTypeCars(prev => prev.filter(etc =>
        !(etc.event_type_id === eventTypeId && etc.car_id === carId)
      ))
    } else {
      const { error: err } = await supabase.from('event_type_cars')
        .insert([{ event_type_id: eventTypeId, car_id: carId }])
      if (err) { setError(err.message); return }
      setEventTypeCars(prev => [...prev, { event_type_id: eventTypeId, car_id: carId }])
    }
    router.refresh()
  }

  const startEdit = (et) => {
    setEditingId(et.id); setNewName(et.name)
    setAdding(false); setError(null)
  }

  // Group cars by class for display
  const carsByClass = cars.reduce((acc, car) => {
    if (!acc[car.class]) acc[car.class] = []
    acc[car.class].push(car)
    return acc
  }, {})

  return (
    <div>
      {error && !editingId && !adding && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '0.75rem' }}>
        {eventTypes.map(et => {
          const allowedCarIds = getAllowedCarIds(et.id)
          const isExpanded = expandedId === et.id
          const isEditing = editingId === et.id

          return (
            <div key={et.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* Header row */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                padding: '0.85rem 1rem', flexWrap: 'wrap',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>{et.name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                    {allowedCarIds.length === 0
                      ? 'Toutes les voitures autorisées'
                      : `${allowedCarIds.length} voiture${allowedCarIds.length > 1 ? 's' : ''} autorisée${allowedCarIds.length > 1 ? 's' : ''}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : et.id)}
                    className="btn btn-secondary btn-sm"
                  >
                    {isExpanded ? '▲ Voitures' : '▼ Voitures'}
                  </button>
                  <button onClick={() => startEdit(et)} className="btn btn-secondary btn-sm">Modifier</button>
                  <button onClick={() => handleDelete(et.id)} className="btn btn-danger btn-sm">Supprimer</button>
                </div>
              </div>

              {/* Edit name inline */}
              {isEditing && (
                <div style={{ padding: '1rem', background: 'var(--surface-2)', borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Nom</label>
                      <input type="text" value={newName} onChange={e => setNewName(e.target.value)} autoFocus />
                    </div>
                    <button onClick={handleEdit} className="btn btn-primary" disabled={saving}>
                      {saving ? '…' : '✓ Enregistrer'}
                    </button>
                    <button onClick={reset} className="btn btn-secondary">Annuler</button>
                  </div>
                  {error && <div className="alert alert-error" style={{ marginTop: '0.75rem' }}>{error}</div>}
                </div>
              )}

              {/* Car selector */}
              {isExpanded && (
                <div style={{ padding: '1rem', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '1rem' }}>
                    Cochez les voitures autorisées pour ce type. Si aucune voiture n&apos;est cochée, toutes sont autorisées.
                  </p>
                    {Object.entries(carsByClass).map(([cls, carsInClass]) => {
                    const allChecked = carsInClass.every(car => allowedCarIds.includes(car.id))
                    const someChecked = carsInClass.some(car => allowedCarIds.includes(car.id))

                    const toggleClass = async () => {
                        for (const car of carsInClass) {
                        const allowed = allowedCarIds.includes(car.id)
                        if (allChecked && allowed) await toggleCar(et.id, car.id, true)
                        if (!allChecked && !allowed) await toggleCar(et.id, car.id, false)
                        }
                    }

                    return (
                        <div key={cls} style={{ marginBottom: '1rem' }}>
                        <label style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em',
                            textTransform: 'uppercase', color: 'var(--text-dim)',
                            marginBottom: '0.5rem', cursor: 'pointer',
                        }}>
                            <input
                            type="checkbox"
                            checked={allChecked}
                            ref={el => { if (el) el.indeterminate = someChecked && !allChecked }}
                            onChange={toggleClass}
                            style={{ accentColor: 'var(--accent)' }}
                            />
                            {cls}
                        </label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', paddingLeft: '1.5rem' }}>
                            {carsInClass.map(car => {
                            const allowed = allowedCarIds.includes(car.id)
                            return (
                                <label key={car.id} style={{
                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                padding: '0.4rem 0.7rem',
                                background: allowed ? 'var(--accent-dim)' : 'var(--surface)',
                                border: '1px solid',
                                borderColor: allowed ? 'var(--accent)' : 'var(--border)',
                                borderRadius: '3px', cursor: 'pointer', transition: 'all 0.15s',
                                fontSize: '0.85rem', fontWeight: 600,
                                }}>
                                <input type="checkbox" checked={allowed}
                                    onChange={() => toggleCar(et.id, car.id, allowed)}
                                    style={{ accentColor: 'var(--accent)' }} />
                                {car.name}
                                </label>
                            )
                            })}
                        </div>
                        </div>
                    )
                    })}
                </div>
              )}
            </div>
          )
        })}

        {eventTypes.length === 0 && (
          <div className="card">
            <div className="empty">Aucun type d&apos;événement.</div>
          </div>
        )}
      </div>

      {adding ? (
        <div className="card">
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Nouveau type d&apos;événement</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="ex : Endurance Pro" autoFocus />
            </div>
            <button onClick={handleAdd} className="btn btn-primary" disabled={saving}>
              {saving ? '…' : '✓ Ajouter'}
            </button>
            <button onClick={reset} className="btn btn-secondary">Annuler</button>
          </div>
          {error && <div className="alert alert-error" style={{ marginTop: '0.75rem' }}>{error}</div>}
        </div>
      ) : (
        <button onClick={() => { setAdding(true); setEditingId(null) }} className="btn btn-secondary">
          + Ajouter un type d&apos;événement
        </button>
      )}
    </div>
  )
}