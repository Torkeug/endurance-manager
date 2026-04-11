'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

const emptyForm = { name: '', pit_lane_time_seconds: '' }

export default function CircuitsManager({ initialCircuits }) {
  const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  const router = useRouter()
  const [circuits, setCircuits]   = useState(initialCircuits)
  const [adding, setAdding]       = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm]           = useState(emptyForm)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState(null)

  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }))

  const validate = () => {
    if (!form.name.trim())           { setError('Le nom est obligatoire.'); return false }
    if (!form.pit_lane_time_seconds) { setError('Le temps pit lane est obligatoire.'); return false }
    return true
  }

  const reset = () => {
    setAdding(false); setEditingId(null)
    setForm(emptyForm); setError(null)
  }

  const handleAdd = async () => {
    if (!validate()) return
    setSaving(true)
    const { data, error: err } = await supabase.from('circuits')
      .insert([{ name: form.name.trim(), pit_lane_time_seconds: parseInt(form.pit_lane_time_seconds) }])
      .select().single()
    if (err) {
      if (err.code === '23505') {
        setError('Ce nom existe déjà.')
      } else {
        setError(err.message)
      } setSaving(false); return }
    setCircuits(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    reset(); setSaving(false); router.refresh()
  }

  const handleEdit = async () => {
    if (!validate()) return
    setSaving(true)
    const { data, error: err } = await supabase.from('circuits')
      .update({ name: form.name.trim(), pit_lane_time_seconds: parseInt(form.pit_lane_time_seconds) })
      .eq('id', editingId).select().single()
    if (err) {
      if (err.code === '23505') {
        setError('Ce nom existe déjà.')
      } else {
        setError(err.message)
      } setSaving(false); return }
    setCircuits(prev => prev.map(c => c.id === editingId ? data : c))
    reset(); setSaving(false); router.refresh()
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce circuit ?')) return
    const { error: err } = await supabase.from('circuits').delete().eq('id', id)
    if (err) { 
      if (err.code === '23503') {
        setError('Ce circuit est utilisé par un ou plusieurs événements et ne peut pas être supprimé.')
      } 
    return }
    setCircuits(prev => prev.filter(c => c.id !== id)); router.refresh()
  }

  const startEdit = (circuit) => {
    setEditingId(circuit.id)
    setForm({ name: circuit.name, pit_lane_time_seconds: String(circuit.pit_lane_time_seconds) })
    setAdding(false); setError(null)
  }

  const editForm = (
    <div style={{ padding: '1rem', background: 'var(--surface-2)' }}>
      <div className="form-grid" style={{ marginBottom: '1rem' }}>
        <div className="form-group">
          <label>Nom du circuit</label>
          <input type="text" value={form.name} onChange={set('name')}
            placeholder="ex : Spa-Francorchamps Endu" />
        </div>
        <div className="form-group">
          <label>Temps pit lane (secondes)</label>
          <input type="number" value={form.pit_lane_time_seconds} onChange={set('pit_lane_time_seconds')}
            placeholder="ex : 60" min="1" max="300" />
        </div>
      </div>
      {error && <div className="alert alert-error" style={{ marginBottom: '0.75rem' }}>{error}</div>}
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button onClick={editingId ? handleEdit : handleAdd} className="btn btn-primary" disabled={saving}>
          {saving ? '…' : editingId ? '✓ Enregistrer' : '✓ Ajouter'}
        </button>
        <button onClick={reset} className="btn btn-secondary">Annuler</button>
      </div>
    </div>
  )

  return (
    <div>
      {!adding && !editingId && error && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>
      )}

      {adding && (
        <div className="card" style={{ marginBottom: '0.75rem' }}>
          <h3 style={{ marginBottom: '1rem', color: 'var(--text-dim)' }}>Nouveau circuit</h3>
          {editForm}
        </div>
      )}

      {!adding && !editingId && (
        <button onClick={() => setAdding(true)} className="btn btn-primary" style={{ marginBottom: '0.75rem' }}>
          + Ajouter un circuit
        </button>
      )}

      <div className="table-wrap" style={{ marginBottom: '0.75rem' }}>
        <table>
          <thead>
            <tr>
              <th>Circuit</th>
              <th>Pit lane</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {circuits.map(circuit => (
              <React.Fragment key={circuit.id}>
                <tr>
                  <td style={{ fontWeight: 600 }}>{circuit.name}</td>
                  <td className="mono" style={{ color: 'var(--accent)' }}>
                    {circuit.pit_lane_time_seconds}s
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => startEdit(circuit)} className="btn btn-secondary btn-sm">Modifier</button>
                      <button onClick={() => handleDelete(circuit.id)} className="btn btn-danger btn-sm">Supprimer</button>
                    </div>
                  </td>
                </tr>
                {editingId === circuit.id && (
                  <tr><td colSpan={3}>{editForm}</td></tr>
                )}
              </React.Fragment>
            ))}
            {circuits.length === 0 && (
              <tr><td colSpan={3} className="empty">Aucun circuit.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}