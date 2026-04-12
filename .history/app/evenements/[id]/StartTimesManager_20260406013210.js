'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import React from 'react'

function formatDatetime(dtStr) {
  if (!dtStr) return '—'
  return new Date(dtStr).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export default function StartTimesManager({ eventId, initialStartTimes }) {
  const router = useRouter()
  const [startTimes, setStartTimes] = useState(initialStartTimes)
  const [adding, setAdding]         = useState(false)
  const [editingId, setEditingId]   = useState(null)  // id of row being edited
  const [newLabel, setNewLabel]     = useState('')
  const [newDate, setNewDate]       = useState('')
  const [newTime, setNewTime]       = useState('')
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState(null)

  // ── ADD ────────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!newLabel.trim()) { setError('Le libellé est obligatoire.'); return }
    if (!newDate)         { setError('La date est obligatoire.'); return }
    if (!newTime)         { setError("L'heure est obligatoire."); return }

    setSaving(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('event_start_times')
      .insert([{ event_id: eventId, label: newLabel.trim(), irl_start: `${newDate}T${newTime}:00` }])
      .select().single()

    if (err) { setError(err.message); setSaving(false); return }

    setStartTimes(prev => [...prev, data])
    setNewLabel(''); setNewDate(''); setNewTime('')
    setAdding(false)
    setSaving(false)
    router.refresh()
  }

  // ── EDIT ───────────────────────────────────────────────────
  const startEdit = (st) => {
    const dt = new Date(st.irl_start)
    setEditingId(st.id)
    setNewLabel(st.label)
    setNewDate(dt.toISOString().slice(0, 10))
    setNewTime(dt.toISOString().slice(11, 16))
    setAdding(false)
    setError(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setNewLabel(''); setNewDate(''); setNewTime('')
    setError(null)
  }

  const handleSaveEdit = async () => {
    if (!newLabel.trim()) { setError('Le libellé est obligatoire.'); return }
    if (!newDate)         { setError('La date est obligatoire.'); return }
    if (!newTime)         { setError("L'heure est obligatoire."); return }

    setSaving(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('event_start_times')
      .update({ label: newLabel.trim(), irl_start: `${newDate}T${newTime}:00` })
      .eq('id', editingId)
      .select().single()

    if (err) { setError(err.message); setSaving(false); return }

    setStartTimes(prev => prev.map(s => s.id === editingId ? data : s))
    cancelEdit()
    setSaving(false)
    router.refresh()
  }

  // ── DELETE ─────────────────────────────────────────────────
  const handleDelete = async (stId) => {
    if (!confirm('Supprimer ce créneau de départ ?')) return
    const { error: err } = await supabase
      .from('event_start_times').delete().eq('id', stId)
    if (err) { setError(err.message); return }
    setStartTimes(prev => prev.filter(s => s.id !== stId))
    if (editingId === stId) cancelEdit()
    router.refresh()
  }

  const sorted = [...startTimes].sort((a, b) =>
    new Date(a.irl_start) - new Date(b.irl_start)
  )

  // Shared form fields
  const EditForm = ({ onSave, onCancel, saveLabel }) => (
    <div>
      <div className="form-grid" style={{ marginBottom: '1rem' }}>
        <div className="form-group">
          <label>Libellé</label>
          <input type="text" value={newLabel} onChange={e => setNewLabel(e.target.value)}
            placeholder="ex : Départ 1, 14h00 CET" />
        </div>
        <div className="form-group">
          <label>Date IRL</label>
          <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Heure IRL (24h)</label>
          <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} />
        </div>
      </div>
      {error && <div className="alert alert-error" style={{ marginBottom: '0.75rem' }}>{error}</div>}
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button onClick={onSave} className="btn btn-primary" disabled={saving}>
          {saving ? 'Enregistrement…' : saveLabel}
        </button>
        <button onClick={onCancel} className="btn btn-secondary">Annuler</button>
      </div>
    </div>
  )

  return (
    <div>
      {sorted.length === 0 && !adding && (
        <div className="card" style={{ marginBottom: '0.75rem' }}>
          <div className="empty" style={{ padding: '1.5rem' }}>
            Aucun horaire de départ configuré.
          </div>
        </div>
      )}

      {sorted.length > 0 && (
        <div className="table-wrap" style={{ marginBottom: '0.75rem' }}>
          <table>
            <thead>
              <tr>
                <th>Libellé</th>
                <th>Date et heure IRL</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((st) => (
                <React.Fragment key={st.id}>
                  <tr>
                    <td style={{ fontWeight: 600 }}>{st.label}</td>
                    <td className="mono" style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                      {formatDatetime(st.irl_start)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => startEdit(st)}
                          className="btn btn-secondary btn-sm">
                          Modifier
                        </button>
                        <button onClick={() => handleDelete(st.id)}
                          className="btn btn-danger btn-sm">
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                  {editingId === st.id && (
                    <tr>
                      <td colSpan={3} style={{ background: 'var(--surface-2)', padding: '1rem' }}>
                        <EditForm
                          onSave={handleSaveEdit}
                          onCancel={cancelEdit}
                          saveLabel="✓ Enregistrer"
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding ? (
        <div className="card">
          <h3 style={{ marginBottom: '1rem', color: 'var(--text-dim)' }}>Nouveau créneau</h3>
          <EditForm
            onSave={handleAdd}
            onCancel={() => { setAdding(false); setError(null) }}
            saveLabel="✓ Ajouter"
          />
        </div>
      ) : !editingId && (
        <button onClick={() => { setAdding(true); cancelEdit() }} className="btn btn-secondary">
          + Ajouter un créneau de départ
        </button>
      )}
    </div>
  )
}