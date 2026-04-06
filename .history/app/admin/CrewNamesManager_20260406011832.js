'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function CrewNamesManager({ initialCrewNames }) {
  const router = useRouter()
  const [items, setItems]     = useState(initialCrewNames)
  const [adding, setAdding]   = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [newName, setNewName] = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(null)

  const reset = () => {
    setAdding(false)
    setEditingId(null)
    setNewName('')
    setError(null)
  }

  const handleAdd = async () => {
    if (!newName.trim()) { setError('Le nom est obligatoire.'); return }
    setSaving(true)
    const { data, error: err } = await supabase
      .from('crew_names')
      .insert([{ name: newName.trim(), sort_order: (items.length + 1) * 10 }])
      .select().single()
    if (err) { setError(err.message); setSaving(false); return }
    setItems(prev => [...prev, data])
    reset()
    setSaving(false)
    router.refresh()
  }

  const handleEdit = async () => {
    if (!newName.trim()) { setError('Le nom est obligatoire.'); return }
    setSaving(true)
    const { data, error: err } = await supabase
      .from('crew_names').update({ name: newName.trim() }).eq('id', editingId).select().single()
    if (err) { setError(err.message); setSaving(false); return }
    setItems(prev => prev.map(i => i.id === editingId ? data : i))
    reset()
    setSaving(false)
    router.refresh()
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce nom d\'équipage ?')) return
    const { error: err } = await supabase.from('crew_names').delete().eq('id', id)
    if (err) { setError(err.message); return }
    setItems(prev => prev.filter(i => i.id !== id))
    router.refresh()
  }

  const startEdit = (item) => {
    setEditingId(item.id)
    setNewName(item.name)
    setAdding(false)
    setError(null)
  }

  return (
    <div>
      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      <div className="table-wrap" style={{ marginBottom: '0.75rem' }}>
        <table>
          <thead>
            <tr>
              <th>Nom d&apos;équipage</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <React.Fragment key={item.id}>
                <tr>
                  <td style={{ fontWeight: 600 }}>{item.name}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => startEdit(item)} className="btn btn-secondary btn-sm">
                        Modifier
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="btn btn-danger btn-sm">
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
                {editingId === item.id && (
                  <tr key={`edit-${item.id}`}>
                    <td colSpan={2} style={{ background: 'var(--surface-2)', padding: '1rem' }}>
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label>Nom</label>
                          <input type="text" value={newName} onChange={e => setNewName(e.target.value)} />
                        </div>
                        <button onClick={handleEdit} className="btn btn-primary" disabled={saving}>
                          {saving ? '…' : '✓ Enregistrer'}
                        </button>
                        <button onClick={reset} className="btn btn-secondary">Annuler</button>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={2} className="empty">Aucun nom d&apos;équipage.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {adding ? (
        <div className="card">
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Nouveau nom d&apos;équipage</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="ex : Kronos Platinum" autoFocus />
            </div>
            <button onClick={handleAdd} className="btn btn-primary" disabled={saving}>
              {saving ? '…' : '✓ Ajouter'}
            </button>
            <button onClick={reset} className="btn btn-secondary">Annuler</button>
          </div>
        </div>
      ) : (
        <button onClick={() => { setAdding(true); setEditingId(null) }} className="btn btn-secondary">
          + Ajouter un nom d&apos;équipage
        </button>
      )}
    </div>
  )
}