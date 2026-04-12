'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import React from 'react'

const emptyForm = { name: '', tank_size_litres: '' }

export default function CarsManager({ initialCars }) {
  const router = useRouter()
  const [cars, setCars]           = useState(initialCars)
  const [adding, setAdding]       = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm]           = useState(emptyForm)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState(null)

  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }))

  const validate = () => {
    if (!form.name.trim())      { setError('Le nom est obligatoire.'); return false }
    if (!form.tank_size_litres) { setError('La taille du réservoir est obligatoire.'); return false }
    return true
  }

  const reset = () => {
    setAdding(false); setEditingId(null)
    setForm(emptyForm); setError(null)
  }

  const handleAdd = async () => {
    if (!validate()) return
    setSaving(true)
    const { data, error: err } = await supabase.from('cars')
      .insert([{ name: form.name.trim(), tank_size_litres: parseFloat(form.tank_size_litres) }])
      .select().single()
    if (err) { setError(err.message); setSaving(false); return }
    setCars(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    reset(); setSaving(false); router.refresh()
  }

  const handleEdit = async () => {
    if (!validate()) return
    setSaving(true)
    const { data, error: err } = await supabase.from('cars')
      .update({ name: form.name.trim(), tank_size_litres: parseFloat(form.tank_size_litres) })
      .eq('id', editingId).select().single()
    if (err) { setError(err.message); setSaving(false); return }
    setCars(prev => prev.map(c => c.id === editingId ? data : c))
    reset(); setSaving(false); router.refresh()
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette voiture ?')) return
    const { error: err } = await supabase.from('cars').delete().eq('id', id)
    if (err) { setError(err.message); return }
    setCars(prev => prev.filter(c => c.id !== id)); router.refresh()
  }

  const startEdit = (car) => {
    setEditingId(car.id)
    setForm({ name: car.name, tank_size_litres: String(car.tank_size_litres) })
    setAdding(false); setError(null)
  }

  const FormFields = ({ onSave, onCancel, saveLabel }) => (
    <div style={{ padding: '1rem', background: 'var(--surface-2)' }}>
      <div className="form-grid" style={{ marginBottom: '1rem' }}>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label>Nom</label>
          <input type="text" value={form.name} onChange={set('name')}
            placeholder="ex : Porsche 911 GT3 R (992)" autoFocus />
        </div>
        <div className="form-group">
          <label>Réservoir (litres)</label>
          <input type="number" value={form.tank_size_litres} onChange={set('tank_size_litres')}
            placeholder="ex : 99" min="0" max="999" step="0.1" />
        </div>
      </div>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '1rem' }}>
        💡 La classe s&apos;assigne depuis l&apos;onglet <strong>Classes</strong>.
      </p>
      {error && <div className="alert alert-error" style={{ marginBottom: '0.75rem' }}>{error}</div>}
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button onClick={onSave} className="btn btn-primary" disabled={saving}>
          {saving ? '…' : saveLabel}
        </button>
        <button onClick={onCancel} className="btn btn-secondary">Annuler</button>
      </div>
    </div>
  )

  // Group by class, unclassed at bottom
  const withClass    = cars.filter(c => c.class)
  const withoutClass = cars.filter(c => !c.class)

  const carsByClass = withClass.reduce((acc, car) => {
    if (!acc[car.class]) acc[car.class] = []
    acc[car.class].push(car)
    return acc
  }, {})

  const renderCarRow = (car) => (
    <React.Fragment key={car.id}>
      <tr>
        <td style={{ fontWeight: 600 }}>{car.name}</td>
        <td>
          {car.class
            ? <span className="badge badge-driver">{car.class}</span>
            : <span style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>Non classée</span>}
        </td>
        <td className="mono" style={{ color: 'var(--accent)' }}>{car.tank_size_litres}L</td>
        <td>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => startEdit(car)} className="btn btn-secondary btn-sm">Modifier</button>
            <button onClick={() => handleDelete(car.id)} className="btn btn-danger btn-sm">Supprimer</button>
          </div>
        </td>
      </tr>
      {editingId === car.id && (
        <tr>
          <td colSpan={4}>
            <FormFields onSave={handleEdit} onCancel={reset} saveLabel="✓ Enregistrer" />
          </td>
        </tr>
      )}
    </React.Fragment>
  )

  return (
    <div>
      {!adding && !editingId && error && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>
      )}

      <div className="table-wrap" style={{ marginBottom: '0.75rem' }}>
        <table>
          <thead>
            <tr>
              <th>Voiture</th>
              <th>Classe</th>
              <th>Réservoir</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(carsByClass).map(([cls, carsInClass]) => (
              <>
                <tr key={`class-${cls}`} style={{ background: 'var(--surface-2)' }}>
                  <td colSpan={4} style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em',
                    textTransform: 'uppercase', color: 'var(--text-dim)', padding: '0.4rem 1rem' }}>
                    {cls}
                  </td>
                </tr>
                {carsInClass.map(car => renderCarRow(car))}
              </>
            ))}
            {withoutClass.length > 0 && (
              <>
                <tr style={{ background: 'var(--surface-2)' }}>
                  <td colSpan={4} style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em',
                    textTransform: 'uppercase', color: 'var(--danger)', padding: '0.4rem 1rem' }}>
                    ⚠️ Non classées
                  </td>
                </tr>
                {withoutClass.map(car => renderCarRow(car))}
              </>
            )}
            {cars.length === 0 && (
              <tr><td colSpan={4} className="empty">Aucune voiture.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {adding ? (
        <div className="card">
          <h3 style={{ marginBottom: '1rem', color: 'var(--text-dim)' }}>Nouvelle voiture</h3>
          <FormFields onSave={handleAdd} onCancel={reset} saveLabel="✓ Ajouter" />
        </div>
      ) : (
        <button onClick={() => { setAdding(true); setEditingId(null) }} className="btn btn-secondary">
          + Ajouter une voiture
        </button>
      )}
    </div>
  )
}