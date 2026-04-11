'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { localToUTC, utcToInputValues, formatInZone, utcToLocal } from '../../../lib/timezone'
import { DateTime } from 'luxon'

function generateLabel(date, time, tz) {
  const dt = DateTime.fromISO(`${date}T${time}:00`, { zone: tz }).setLocale('fr')
  const dayName = dt.toFormat('EEEE')
  const dayNum  = dt.toFormat('d')
  const month   = dt.toFormat('MMMM yyyy')
  const label   = `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${dayNum} ${month}`
  return label
}

export default function StartTimesManager({ eventId, initialStartTimes, timezone = 'Europe/Paris' }) {
  function formatDatetime(dtStr) {
    return formatInZone(dtStr, timezone)
  }
  const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  const router = useRouter()
  const [startTimes, setStartTimes] = useState(initialStartTimes)
  const [adding, setAdding]         = useState(false)
  const [editingId, setEditingId]   = useState(null)
  const [date, setDate]             = useState('')
  const [time, setTime]             = useState('')
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState(null)

  const resetForm = () => {
    setAdding(false); setEditingId(null)
    setDate(''); setTime('')
    setError(null)
  }

  const startEdit = (st) => {
    const { date: d, time: t } = utcToInputValues(st.irl_start, timezone)
    setEditingId(st.id)
    setDate(d)
    setTime(t)
    setAdding(false)
    setError(null)
  }

  const handleAdd = async () => {
    if (!label.trim()) { setError('Le libellé est obligatoire.'); return }
    if (!date)         { setError('La date est obligatoire.'); return }
    if (!time)         { setError("L'heure est obligatoire."); return }
    setSaving(true); setError(null)
    const { data, error: err } = await supabase
      .from('event_start_times')
      .insert([{ event_id: eventId, label: generateLabel(date, time, timezone), irl_start: localToUTC(date, time, timezone) }])
      .select().single()
    if (err) { setError(err.message); setSaving(false); return }
    setStartTimes(prev => [...prev, data])
    resetForm(); setSaving(false); router.refresh()
  }

  const handleSaveEdit = async () => {
    if (!label.trim()) { setError('Le libellé est obligatoire.'); return }
    if (!date)         { setError('La date est obligatoire.'); return }
    if (!time)         { setError("L'heure est obligatoire."); return }
    setSaving(true); setError(null)
    const { data, error: err } = await supabase
      .from('event_start_times')
      .update({ label: generateLabel(date, time, timezone), irl_start: localToUTC(date, time, timezone) })
      .eq('id', editingId).select().single()
    if (err) { setError(err.message); setSaving(false); return }
    setStartTimes(prev => prev.map(s => s.id === editingId ? data : s))
    resetForm(); setSaving(false); router.refresh()
  }

  const handleDelete = async (stId) => {
    if (!confirm('Supprimer ce créneau de départ ?')) return
    const { error: err } = await supabase.from('event_start_times').delete().eq('id', stId)
    if (err) {
      if (err.code === '23503') {
        setError('Ce créneau est utilisé par un ou plusieurs équipages et ne peut pas être supprimé.')
      } else {
        setError(err.message)
      }
      return
    }
    setStartTimes(prev => prev.filter(s => s.id !== stId))
    if (editingId === stId) resetForm()
    router.refresh()
  }

  const sorted = [...startTimes].sort((a, b) =>
    new Date(a.irl_start) - new Date(b.irl_start)
  )

  // Inline form — defined here to avoid re-mount on keystroke
  const inlineForm = (onSave, onCancel, saveLabel) => (
    <div style={{ padding: '1rem', background: 'var(--surface-2)' }}>
      <div className="form-grid" style={{ marginBottom: '1rem' }}>
        <div className="form-group">
          <label>Date IRL</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Heure IRL (24h)</label>
          <input type="time" value={time} onChange={e => setTime(e.target.value)} />
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
    {error && !adding && !editingId && (
      <div className="alert alert-error" style={{ marginBottom: '0.75rem' }}>{error}</div>
    )}
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
                        <button onClick={() => startEdit(st)} className="btn btn-secondary btn-sm">
                          Modifier
                        </button>
                        <button onClick={() => handleDelete(st.id)} className="btn btn-danger btn-sm">
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                  {editingId === st.id && (
                    <tr>
                      <td colSpan={3} style={{ padding: 0 }}>
                        {inlineForm(handleSaveEdit, resetForm, '✓ Enregistrer')}
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
          {inlineForm(handleAdd, resetForm, '✓ Ajouter')}
        </div>
      ) : !editingId && (
        <button onClick={() => { setEditingId(null); setLabel(''); setDate(''); setTime(''); setError(null); setAdding(true) }} className="btn btn-secondary">
          + Ajouter un créneau de départ
        </button>
      )}
    </div>
  )
}