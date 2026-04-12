'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import React from 'react'

function formatDuration(minutes) {
  if (!minutes) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

export default function SettingsManager({ initialPresets, initialDefaultDuration, initialSpecialStartTimes }) {
  const router = useRouter()
  const [presets, setPresets]   = useState(initialPresets || [])
  const [saving, setSaving]     = useState(null)
  const [error, setError]       = useState(null)
  const [newH, setNewH]         = useState('')
  const [newM, setNewM]         = useState('')
  const [adding, setAdding]     = useState(false)
  const [specialTimes, setSpecialTimes]   = useState(initialSpecialStartTimes || [])
  const [addingSpecial, setAddingSpecial] = useState(false)
  const [newStH, setNewStH]               = useState('')
  const [newStM, setNewStM]               = useState('')
  const [newStDay, setNewStDay]     = useState('vendredi')
  const [savingSpecial, setSavingSpecial] = useState(null)
  const [successSpecial, setSuccessSpecial] = useState(false)
  const [editingSpecialId, setEditingSpecialId] = useState(null)
  const [editStH, setEditStH]                   = useState('')
  const [editStM, setEditStM]                   = useState('')
  const [editStDay, setEditStDay]   = useState('vendredi')

  // Default duration state
  const [defaultDuration, setDefaultDuration] = useState(initialDefaultDuration || 160)
  const [savingDefault, setSavingDefault]       = useState(false)
  const [successDefault, setSuccessDefault]     = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const sorted = [...presets].sort((a, b) => a.minutes - b.minutes)

  const handleAdd = async () => {
    const h = parseInt(newH) || 0
    const m = parseInt(newM) || 0
    const total = h * 60 + m
    if (total <= 0) { setError('Durée invalide.'); return }
    if (presets.find(p => p.minutes === total)) { setError('Cette durée existe déjà.'); return }

    setSaving('new'); setError(null)
    const { data, error: err } = await supabase
      .from('event_duration_presets')
      .insert([{ minutes: total }])
      .select().single()
    if (err) {
      if (err.code === '23505') setError('Cette durée existe déjà.')
      else setError(err.message)
      setSaving(null); return
    }
    setPresets(prev => [...prev, data])
    setNewH(''); setNewM(''); setAdding(false)
    setSaving(null); router.refresh()
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette durée ?')) return
    setSaving(id); setError(null)
    const { error: err } = await supabase
      .from('event_duration_presets').delete().eq('id', id)
    if (err) { setError(err.message); setSaving(null); return }
    setPresets(prev => prev.filter(p => p.id !== id))
    setSaving(null); router.refresh()
  }

  const handleSaveDefault = async () => {
    setSavingDefault(true); setError(null)
    const { error: err } = await supabase.from('settings')
      .upsert({ key: 'default_event_duration_minutes', value: String(defaultDuration) })
    if (err) { setError(err.message); setSavingDefault(false); return }
    setSuccessDefault(true)
    setSavingDefault(false)
    setTimeout(() => setSuccessDefault(false), 3000)
    router.refresh()
  }

    const handleAddSpecialTime = async () => {
    const h = parseInt(newStH)
    const m = parseInt(newStM) || 0
    if (isNaN(h) || h < 0 || h > 23) { setError('Heure invalide.'); return }
    if (m < 0 || m > 59) { setError('Minutes invalides.'); return }
    setSavingSpecial('new'); setError(null)
    const label = `${newStDay.charAt(0).toUpperCase() + newStDay.slice(1)} à ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
    const { data, error: err } = await supabase
        .from('special_event_start_times')
        .insert([{ label, hour: h, minute: m, day_of_week: newStDay }])
        .select().single()
    if (err) { setError(err.message); setSavingSpecial(null); return }
    setSpecialTimes(prev => [...prev, data].sort((a, b) => 
        a.day_of_week.localeCompare(b.day_of_week) || a.hour * 60 + a.minute - (b.hour * 60 + b.minute)))
    setNewStH(''); setNewStM(''); setNewStDay('vendredi'); setAddingSpecial(false)
    setSavingSpecial(null); router.refresh()
    }

    const handleEditSpecialTime = async () => {
    const h = parseInt(editStH)
    const m = parseInt(editStM) || 0
    if (isNaN(h) || h < 0 || h > 23) { setError('Heure invalide.'); return }
    setSavingSpecial(editingSpecialId); setError(null)
    const label = `${editStDay.charAt(0).toUpperCase() + editStDay.slice(1)} à ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
    const { data, error: err } = await supabase
        .from('special_event_start_times')
        .update({ label, hour: h, minute: m, day_of_week: editStDay })
        .eq('id', editingSpecialId).select().single()
    if (err) { setError(err.message); setSavingSpecial(null); return }
    setSpecialTimes(prev => prev.map(s => s.id === editingSpecialId ? data : s)
        .sort((a, b) => a.day_of_week.localeCompare(b.day_of_week) || a.hour * 60 + a.minute - (b.hour * 60 + b.minute)))
    setEditingSpecialId(null); setSavingSpecial(null); router.refresh()
    }

    const handleDeleteSpecialTime = async (id) => {
    if (!confirm('Supprimer cet horaire ?')) return
    setSavingSpecial(id); setError(null)
    const { error: err } = await supabase.from('special_event_start_times').delete().eq('id', id)
    if (err) { setError(err.message); setSavingSpecial(null); return }
    setSpecialTimes(prev => prev.filter(s => s.id !== id))
    setSavingSpecial(null); router.refresh()
    }

  const newTotal = (parseInt(newH) || 0) * 60 + (parseInt(newM) || 0)

  return (
    <div>
      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* Duration presets */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1.25rem', color: 'var(--text-dim)' }}>Durées disponibles à la création d&apos;événement</h3>

        {adding && (
          <div style={{ background: 'var(--surface-2)', padding: '1rem', borderRadius: '3px', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              <input type="number" min="0" max="99" value={newH}
                onChange={e => setNewH(e.target.value)}
                placeholder="h" autoFocus
                style={{ width: '70px', padding: '0.45rem 0.5rem', background: 'var(--surface)',
                  border: '1px solid var(--border)', borderRadius: '3px',
                  color: 'var(--text)', fontFamily: 'var(--font-mono), monospace', fontSize: '0.9rem' }} />
              <span style={{ color: 'var(--text-dim)' }}>h</span>
              <input type="number" min="0" max="59" value={newM}
                onChange={e => setNewM(e.target.value)}
                placeholder="min"
                style={{ width: '70px', padding: '0.45rem 0.5rem', background: 'var(--surface)',
                  border: '1px solid var(--border)', borderRadius: '3px',
                  color: 'var(--text)', fontFamily: 'var(--font-mono), monospace', fontSize: '0.9rem' }} />
              <span style={{ color: 'var(--text-dim)' }}>min</span>
              {newTotal > 0 && (
                <span className="mono" style={{ color: 'var(--accent)', fontSize: '0.85rem' }}>
                  = {formatDuration(newTotal)}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={handleAdd} className="btn btn-primary" disabled={saving === 'new'}>
                {saving === 'new' ? '…' : '✓ Ajouter'}
              </button>
              <button onClick={() => { setAdding(false); setNewH(''); setNewM(''); setError(null) }}
                className="btn btn-secondary">Annuler</button>
            </div>
          </div>
        )}

        {!adding && (
          <button onClick={() => setAdding(true)} className="btn btn-primary" style={{ marginBottom: '0.75rem' }}>
            + Ajouter une durée
          </button>
        )}

        <div className="table-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TH}>Durée</th>
                <th style={TH}>Minutes</th>
                <th style={TH}></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(p => (
                <tr key={p.id} style={{ opacity: saving === p.id ? 0.5 : 1 }}>
                  <td style={TD}><span className="mono" style={{ fontWeight: 600, color: 'var(--accent)' }}>{formatDuration(p.minutes)}</span></td>
                  <td style={TD} className="mono">{p.minutes} min</td>
                  <td style={{ ...TD, textAlign: 'right' }}>
                    <button onClick={() => handleDelete(p.id)}
                      className="btn btn-danger btn-sm" disabled={saving === p.id}>
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Default duration */}
      <div className="card">
        <h3 style={{ marginBottom: '1.25rem', color: 'var(--text-dim)' }}>Durée par défaut</h3>
        {successDefault && (
          <div className="alert alert-success" style={{ marginBottom: '1rem' }}>✓ Durée par défaut enregistrée.</div>
        )}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          {sorted.map(p => (
            <button key={p.id} type="button"
              onClick={() => setDefaultDuration(p.minutes)}
              style={{
                padding: '0.45rem 1rem', borderRadius: '3px', border: '1px solid',
                borderColor: defaultDuration === p.minutes ? 'var(--accent)' : 'var(--border)',
                background: defaultDuration === p.minutes ? 'var(--accent-dim)' : 'var(--surface-2)',
                color: defaultDuration === p.minutes ? 'var(--accent)' : 'var(--text-dim)',
                fontFamily: 'var(--font-mono), monospace', fontWeight: 600, cursor: 'pointer',
                fontSize: '0.9rem',
              }}>
              {formatDuration(p.minutes)}
            </button>
          ))}
        </div>
        <button onClick={handleSaveDefault} className="btn btn-primary" disabled={savingDefault}>
          {savingDefault ? 'Enregistrement…' : '✓ Enregistrer'}
        </button>
      </div>
        {/* Special event start times */}
        <div className="card" style={{ marginTop: '1.5rem' }}>
        <h3 style={{ marginBottom: '1.25rem', color: 'var(--text-dim)' }}>
            Horaires prédéfinis (événements spéciaux)
        </h3>

        {addingSpecial && (
        <div style={{ background: 'var(--surface-2)', padding: '1rem', borderRadius: '3px', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            <select value={newStDay} onChange={e => setNewStDay(e.target.value)}
                style={{ padding: '0.45rem 0.5rem', background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: '3px',
                color: 'var(--text)', fontSize: '0.9rem' }}>
                <option value="vendredi">Vendredi</option>
                <option value="samedi">Samedi</option>
                <option value="dimanche">Dimanche</option>
            </select>
            <span style={{ color: 'var(--text-dim)' }}>à</span>
            <input type="number" min="0" max="23" value={newStH}
                onChange={e => setNewStH(e.target.value)}
                placeholder="HH" autoFocus
                style={{ width: '60px', padding: '0.45rem 0.5rem', background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: '3px',
                color: 'var(--text)', fontFamily: 'var(--font-mono), monospace', fontSize: '0.9rem' }} />
            <span style={{ color: 'var(--text-dim)' }}>:</span>
            <input type="number" min="0" max="59" value={newStM}
                onChange={e => setNewStM(e.target.value)}
                placeholder="MM"
                style={{ width: '60px', padding: '0.45rem 0.5rem', background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: '3px',
                color: 'var(--text)', fontFamily: 'var(--font-mono), monospace', fontSize: '0.9rem' }} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={handleAddSpecialTime} className="btn btn-primary" disabled={savingSpecial === 'new'}>
                {savingSpecial === 'new' ? '…' : '✓ Ajouter'}
            </button>
            <button onClick={() => { setAddingSpecial(false); setNewStH(''); setNewStM(''); setNewStDay('vendredi'); setError(null) }}
                className="btn btn-secondary">Annuler</button>
            </div>
        </div>
        )}

        {!addingSpecial && (
            <button onClick={() => setAddingSpecial(true)} className="btn btn-primary" style={{ marginBottom: '0.75rem' }}>
            + Ajouter un horaire
            </button>
        )}

        {specialTimes.length > 0 && (
            <div className="table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                <tr>
                    <th style={TH}>Horaire</th>
                    <th style={TH}></th>
                </tr>
                </thead>
                <tbody>
                    {specialTimes.map(st => (
                    <React.Fragment key={st.id}>
                        <tr style={{ opacity: savingSpecial === st.id ? 0.5 : 1 }}>
                        <td style={{ ...TD, fontWeight: 600, color: 'var(--accent)' }} className="mono">
                            {st.day_of_week?.charAt(0).toUpperCase() + st.day_of_week?.slice(1)} à {String(st.hour).padStart(2,'0')}:{String(st.minute).padStart(2,'0')}
                        </td>
                        <td style={{ ...TD, textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button onClick={() => { setEditingSpecialId(st.id); setEditStH(String(st.hour)); setEditStM(String(st.minute)); setEditStDay(st.day_of_week || 'vendredi') }}
                                className="btn btn-secondary btn-sm">Modifier</button>
                            <button onClick={() => handleDeleteSpecialTime(st.id)}
                                className="btn btn-danger btn-sm" disabled={savingSpecial === st.id}>Supprimer</button>
                            </div>
                        </td>
                        </tr>
                        {editingSpecialId === st.id && (
                        <tr>
                            <td colSpan={2} style={{ padding: 0 }}>
                            <div style={{ background: 'var(--surface-2)', padding: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                                <select value={editStDay} onChange={e => setEditStDay(e.target.value)}
                                    style={{ padding: '0.45rem 0.5rem', background: 'var(--surface)',
                                    border: '1px solid var(--border)', borderRadius: '3px',
                                    color: 'var(--text)', fontSize: '0.9rem' }}>
                                    <option value="vendredi">Vendredi</option>
                                    <option value="samedi">Samedi</option>
                                    <option value="dimanche">Dimanche</option>
                                </select>
                                <span style={{ color: 'var(--text-dim)' }}>à</span>
                                <input type="number" min="0" max="23" value={editStH}
                                    onChange={e => setEditStH(e.target.value)} placeholder="HH"
                                    style={{ width: '60px', padding: '0.45rem 0.5rem', background: 'var(--surface)',
                                    border: '1px solid var(--border)', borderRadius: '3px',
                                    color: 'var(--text)', fontFamily: 'var(--font-mono), monospace', fontSize: '0.9rem' }} />
                                <span style={{ color: 'var(--text-dim)' }}>:</span>
                                <input type="number" min="0" max="59" value={editStM}
                                    onChange={e => setEditStM(e.target.value)} placeholder="MM"
                                    style={{ width: '60px', padding: '0.45rem 0.5rem', background: 'var(--surface)',
                                    border: '1px solid var(--border)', borderRadius: '3px',
                                    color: 'var(--text)', fontFamily: 'var(--font-mono), monospace', fontSize: '0.9rem' }} />
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button onClick={handleEditSpecialTime} className="btn btn-primary" disabled={savingSpecial === st.id}>
                                    {savingSpecial === st.id ? '…' : '✓ Enregistrer'}
                                </button>
                                <button onClick={() => setEditingSpecialId(null)} className="btn btn-secondary">Annuler</button>
                                </div>
                            </div>
                            </td>
                        </tr>
                        )}
                    </React.Fragment>
                    ))}
                </tbody>
            </table>
            </div>
        )}

        {specialTimes.length === 0 && !addingSpecial && (
            <div className="empty">Aucun horaire prédéfini configuré.</div>
        )}
        </div>
    </div>
  )
}

const TH = {
  background: 'var(--surface-2)', color: 'var(--text-dim)',
  fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em',
  textTransform: 'uppercase', padding: '0.6rem 1rem',
  textAlign: 'left', borderBottom: '1px solid var(--border)',
}
const TD = {
  padding: '0.6rem 1rem', borderBottom: '1px solid var(--border)',
  verticalAlign: 'middle',
}