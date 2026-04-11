'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export default function CrewNamesManager({ initialCrewNames }) {
  const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  const router = useRouter()
  const [items, setItems]         = useState(initialCrewNames)
  const [adding, setAdding]       = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [newName, setNewName]     = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState(null)

  const reset = () => {
    setAdding(false); setEditingId(null)
    setNewName(''); setError(null)
  }

  const handleAdd = async () => {
    if (!newName.trim()) { setError('Le nom est obligatoire.'); return }
    setSaving(true)
    const { data, error: err } = await supabase.from('crew_names')
      .insert([{ name: newName.trim(), sort_order: (items.length + 1) * 10 }])
      .select().single()
    if (err) {
      if (err.code === '23505') {
        setError('Ce nom existe déjà.')
      } else {
        setError(err.message)
      } setSaving(false); return }
    setItems(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    reset(); setSaving(false); router.refresh()
  }

  const handleEdit = async () => {
    if (!newName.trim()) { setError('Le nom est obligatoire.'); return }
    setSaving(true)
    const { data, error: err } = await supabase.from('crew_names')
      .update({ name: newName.trim() }).eq('id', editingId).select().single()
    if (err) {
      if (err.code === '23505') {
        setError('Ce nom existe déjà.')
      } else {
        setError(err.message)
      } setSaving(false); return }
    setItems(prev => prev.map(i => i.id === editingId ? data : i))
    reset(); setSaving(false); router.refresh()
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce nom d\'équipage ?')) return
    const { error: err } = await supabase.from('crew_names').delete().eq('id', id)
    if (err) {
      if (err.code === '23503') {
        setError('Ce nom est utilisé par un ou plusieurs équipages et ne peut pas être supprimé.')
      } else {
        setError(err.message)
      }
      return
    }
    setItems(prev => prev.filter(i => i.id !== id)); router.refresh()
  }

  const startEdit = (item) => {
    setEditingId(item.id); setNewName(item.name)
    setAdding(false); setError(null)
  }

  const editForm = (
    <div style={{ padding: '1rem', background: 'var(--surface-2)', marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label>{editingId ? 'Nom' : 'Nouveau nom d\'équipage'}</label>
          <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="ex : Kronos Platinum" />
        </div>
        <button onClick={editingId ? handleEdit : handleAdd} className="btn btn-primary" disabled={saving}>
          {saving ? '…' : editingId ? '✓ Enregistrer' : '✓ Ajouter'}
        </button>
        <button onClick={reset} className="btn btn-secondary">Annuler</button>
      </div>
      {error && <div className="alert alert-error" style={{ marginTop: '0.75rem' }}>{error}</div>}
    </div>
  )

  return (
    <div>
      {!adding && !editingId && error && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>
      )}

      {adding && editForm}

      {!adding && !editingId && (
        <button onClick={() => setAdding(true)} className="btn btn-primary" style={{ marginBottom: '0.75rem' }}>
          + Ajouter un nom d&apos;équipage
        </button>
      )}

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
                      <button onClick={() => startEdit(item)} className="btn btn-secondary btn-sm">Modifier</button>
                      <button onClick={() => handleDelete(item.id)} className="btn btn-danger btn-sm">Supprimer</button>
                    </div>
                  </td>
                </tr>
                {editingId === item.id && (
                  <tr><td colSpan={2}>{editForm}</td></tr>
                )}
              </React.Fragment>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={2} className="empty">Aucun nom d&apos;équipage.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}