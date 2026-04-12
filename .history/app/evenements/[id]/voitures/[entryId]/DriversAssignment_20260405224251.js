'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../../../lib/supabase'

function MismatchBadge({ signup, entryCarId, entryClass }) {
  const prefCarId = signup.preferred_car_id
  const prefClass = signup.preferred_class

  if (prefCarId && entryCarId && prefCarId !== entryCarId) {
    const prefCarName = signup.cars?.name || '?'
    return (
      <span title={`Voiture préférée : ${prefCarName}`} style={{
        fontSize: '0.7rem', padding: '0.15rem 0.4rem',
        background: '#2a1a00', border: '1px solid #a06020',
        borderRadius: '2px', color: '#d4904a', whiteSpace: 'nowrap',
      }}>
        ⚠️ {prefCarName}
      </span>
    )
  }
  if (prefClass && entryClass && prefClass !== entryClass) {
    return (
      <span title={`Classe préférée : ${prefClass}`} style={{
        fontSize: '0.7rem', padding: '0.15rem 0.4rem',
        background: '#2a1a00', border: '1px solid #a06020',
        borderRadius: '2px', color: '#d4904a', whiteSpace: 'nowrap',
      }}>
        ⚠️ {prefClass}
      </span>
    )
  }
  return null
}

export default function DriversAssignment({ entryId, entryCarId, entryClass, assignedDrivers, unassignedDrivers }) {
  const router = useRouter()
  const [assigned, setAssigned]     = useState(assignedDrivers)
  const [unassigned, setUnassigned] = useState(unassignedDrivers)
  const [error, setError]           = useState(null)

  const assign = async (signup) => {
    const { error: err } = await supabase
      .from('signups').update({ car_entry_id: entryId }).eq('id', signup.id)
    if (err) { setError(err.message); return }
    setAssigned(prev => [...prev, { ...signup, car_entry_id: entryId }])
    setUnassigned(prev => prev.filter(s => s.id !== signup.id))
    router.refresh()
  }

  const unassign = async (signup) => {
    const { error: err } = await supabase
      .from('signups').update({ car_entry_id: null }).eq('id', signup.id)
    if (err) { setError(err.message); return }
    setUnassigned(prev => [...prev, { ...signup, car_entry_id: null }])
    setAssigned(prev => prev.filter(s => s.id !== signup.id))
    router.refresh()
  }

  return (
    <div>
      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {assigned.length === 0 ? (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="empty" style={{ padding: '1.5rem' }}>
            Aucun pilote assigné à cette équipe.
          </div>
        </div>
      ) : (
        <div className="table-wrap" style={{ marginBottom: '1rem' }}>
          <table>
            <thead>
              <tr>
                <th>Pilote</th>
                <th>iRating</th>
                <th>Préférence</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {assigned.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {s.drivers?.name || '—'}
                      <MismatchBadge signup={s} entryCarId={entryCarId} entryClass={entryClass} />
                    </div>
                  </td>
                  <td className="mono" style={{ color: 'var(--accent)', fontSize: '0.85rem' }}>
                    {s.drivers?.irating ?? '—'}
                  </td>
                  <td style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                    {s.preferred_class || s.cars?.name || '—'}
                  </td>
                  <td style={{ color: 'var(--text-dim)', fontSize: '0.85rem', maxWidth: '180px' }}>
                    {s.notes || '—'}
                  </td>
                  <td>
                    <button 
                      onClick={() => unassign(s)} 
                      className="btn btn-secondary btn-sm"
                      title="Pilote concerné ou admin uniquement"
                    >
                      Retirer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {unassigned.length > 0 && (
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.75rem' }}>
            Pilotes inscrits sans équipe
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {unassigned.map(s => {
              const hasMismatch =
                (s.preferred_car_id && entryCarId && s.preferred_car_id !== entryCarId) ||
                (s.preferred_class  && entryClass  && s.preferred_class  !== entryClass)
              return (
                <button key={s.id} onClick={() => assign(s)}
                  className="btn btn-secondary"
                  title={hasMismatch ? 'Préférence différente de cette équipe' : ''}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.1rem',
                    borderColor: hasMismatch ? '#a06020' : undefined,
                  }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {hasMismatch && <span style={{ color: '#d4904a' }}>⚠️</span>}
                    <span style={{ fontWeight: 600 }}>{s.drivers?.name}</span>
                  </span>
                  {s.drivers?.irating && (
                    <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--accent)' }}>
                      {s.drivers.irating}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}