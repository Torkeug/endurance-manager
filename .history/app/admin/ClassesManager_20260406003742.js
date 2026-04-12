'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function ClassesManager({ initialClasses }) {
  const router = useRouter()
  const [classes, setClasses]   = useState(initialClasses)
  const [adding, setAdding]     = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [newName, setNewName]   = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)

  const reset = () => {
    setAdding(false); setEditingId(null)
    setNewName(''); setError(null)
  }

  const handleAdd = async () => {
    if (!newName.trim()) { setError('Le nom est obligatoire.'); return }
    setSaving(true)
    const { data, error: err } = await supabase.from('car_classes')
      .insert([{ name: newName.trim(), sort_order: (classes.length + 1) * 10 }])
      .select().single()
    if (err) { setError(err.message); setSaving(false); return }
    setClasses(prev => [...prev, data])
    reset(); setSaving(false); router.refresh()
  }

  const handleEdit = async () => {
    if (!newName.trim()) { setError('Le nom est obligatoire.'); return }
    setSaving(true)
    const { data, error: err } = await supabase.from('car_classes')
      .update({ name: newName.trim() }).eq('id', editingId).select().single()
    if (err) { setError(err.message); setSaving(false); return }
    setClasses(prev => prev.map(c => c.id === editingId ? data : c))
    reset(); setSaving(false); router.refresh()
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette classe ? Les voitures et entrées utilisant cette classe ne seront pas supprimées.')) return
    const { error: err } = await supabase.from('car_classes').delete().eq('id', id)
    if (err) { setError(err.message); return }
    setClasses(prev => prev.filter(c => c.id !== id)); router.refresh()
  }

  const startEdit = (cls) => {
    setEditingId(cls.id); setNewName(cls.name)
    setAdding(false); setError(null)
  }

  return (
    <div>
      {error && !editingId && !adding && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>
      )}

      <div className="table-wrap" style={{ marginBottom: '0.75rem' }}>
        <table>
          <thead>
            <tr>
              <th>Classe</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {classes.map(cls => (
              <>
                <tr key={cls.id}>
                  <td>
                    <span className="badge badge-driver" style={{ fontSize: '0.85rem' }}>{cls.name}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => startEdit(cls)} className="btn btn-secondary btn-sm">Modifier</button>
                      <button onClick={() => handleDelete(cls.id)} className="btn btn-danger btn-sm">Supprimer</button>
                    </div>
                  </td>
                </tr>
                {editingId === cls.id && (
                  <tr key={`edit-${cls.id}`}>
                    <td colSpan={2} style={{ background: 'var(--surface-2)', padding: '1rem' }}>
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label>Nom de la classe</label>
                          <input type="text" value={newName} onChange={e => setNewName(e.target.value)} />
                        </div>
                        <button onClick={handleEdit} className="btn btn-primary" disabled={saving}>
                          {saving ? '…' : '✓ Enregistrer'}
                        </button>
                        <button onClick={reset} className="btn btn-secondary">Annuler</button>
                      </div>
                      {error && <div className="alert alert-error" style={{ marginTop: '0.75rem' }}>{error}</div>}
                    </td>
                  </tr>
                )}
              </>
            ))}
            {classes.length === 0 && (
              <tr><td colSpan={2} className="empty">Aucune classe.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {adding ? (
        <div className="card">
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Nouvelle classe</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="ex : LMP3" autoFocus />
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
          + Ajouter une classe
        </button>
      )}
    </div>
  )
}