'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

const ROLES = ['driver', 'admin', 'super_admin']

const ROLE_LABELS = {
  driver:      'Pilote',
  admin:       'Admin',
  super_admin: 'Super Admin',
}

const ROLE_COLORS = {
  driver:      'var(--text-dim)',
  admin:       'var(--accent)',
  super_admin: '#e05555',
}

export default function DriversManager({ initialDrivers }) {
  const router = useRouter()
  const [drivers, setDrivers] = useState(initialDrivers)
  const [saving, setSaving]   = useState(null)
  const [error, setError]     = useState(null)
  const [filter, setFilter]   = useState('pending') // 'pending' | 'all'

  const pending  = drivers.filter(d => !d.approved)
  const approved = drivers.filter(d => d.approved)

  const approve = async (driverId) => {
    setSaving(driverId)
    const { error: err } = await supabase
      .from('drivers').update({ approved: true }).eq('id', driverId)
    if (err) { setError(err.message); setSaving(null); return }
    setDrivers(prev => prev.map(d => d.id === driverId ? { ...d, approved: true } : d))
    setSaving(null)
    router.refresh()
  }

  const changeRole = async (driverId, role) => {
    setSaving(driverId)
    const { error: err } = await supabase
      .from('drivers').update({ role }).eq('id', driverId)
    if (err) { setError(err.message); setSaving(null); return }
    setDrivers(prev => prev.map(d => d.id === driverId ? { ...d, role } : d))
    setSaving(null)
    router.refresh()
  }

  const revoke = async (driverId) => {
    if (!confirm('Révoquer l\'accès de ce pilote ?')) return
    setSaving(driverId)
    const { error: err } = await supabase
      .from('drivers').update({ approved: false }).eq('id', driverId)
    if (err) { setError(err.message); setSaving(null); return }
    setDrivers(prev => prev.map(d => d.id === driverId ? { ...d, approved: false } : d))
    setSaving(null)
    router.refresh()
  }

  return (
    <div>
      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {[
          { id: 'pending', label: `En attente (${pending.length})` },
          { id: 'all',     label: `Tous (${approved.length})` },
        ].map(tab => (
          <button key={tab.id} onClick={() => setFilter(tab.id)} style={{
            padding: '0.4rem 1rem', borderRadius: '3px', border: '1px solid',
            borderColor: filter === tab.id ? 'var(--accent)' : 'var(--border)',
            background: filter === tab.id ? 'var(--accent-dim)' : 'var(--surface-2)',
            color: filter === tab.id ? 'var(--accent)' : 'var(--text-dim)',
            fontFamily: 'var(--font-rajdhani), sans-serif',
            fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Pending drivers */}
      {filter === 'pending' && (
        <>
          {pending.length === 0 ? (
            <div className="card"><div className="empty">Aucun pilote en attente d&apos;approbation.</div></div>
          ) : (
            <div className="table-wrap">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Nom</th>
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>iRacing ID</th>
                    <th style={thStyle}>Discord</th>
                    <th style={thStyle}></th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map(d => (
                    <tr key={d.id} style={{ opacity: saving === d.id ? 0.5 : 1 }}>
                      <td style={tdStyle}><span style={{ fontWeight: 600 }}>{d.name}</span></td>
                      <td style={tdStyle} className="mono">{d.email || '—'}</td>
                      <td style={tdStyle} className="mono">{d.iracing_id || '—'}</td>
                      <td style={tdStyle}>{d.discord || '—'}</td>
                      <td style={tdStyle}>
                        <button onClick={() => approve(d.id)}
                          className="btn btn-primary btn-sm" disabled={saving === d.id}>
                          ✓ Approuver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* All approved drivers */}
      {filter === 'all' && (
        <>
          {approved.length === 0 ? (
            <div className="card"><div className="empty">Aucun pilote approuvé.</div></div>
          ) : (
            <div className="table-wrap">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Nom</th>
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>Rôle</th>
                    <th style={thStyle}></th>
                  </tr>
                </thead>
                <tbody>
                  {approved.map(d => (
                    <tr key={d.id} style={{ opacity: saving === d.id ? 0.5 : 1 }}>
                      <td style={tdStyle}><span style={{ fontWeight: 600 }}>{d.name}</span></td>
                      <td style={tdStyle} className="mono" style={{ fontSize: '0.82rem' }}>{d.email || '—'}</td>
                      <td style={tdStyle}>
                        <select
                          value={d.role || 'driver'}
                          onChange={e => changeRole(d.id, e.target.value)}
                          disabled={saving === d.id}
                          style={{
                            background: 'var(--surface-2)', border: '1px solid var(--border)',
                            borderRadius: '3px', color: ROLE_COLORS[d.role] || 'var(--text)',
                            fontFamily: 'var(--font-rajdhani), sans-serif',
                            fontSize: '0.85rem', fontWeight: 700, padding: '0.25rem 0.5rem',
                            cursor: 'pointer',
                          }}
                        >
                          {ROLES.map(r => (
                            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                          ))}
                        </select>
                      </td>
                      <td style={tdStyle}>
                        <button onClick={() => revoke(d.id)}
                          className="btn btn-danger btn-sm" disabled={saving === d.id}>
                          Révoquer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const thStyle = {
  background: 'var(--surface-2)', color: 'var(--text-dim)',
  fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em',
  textTransform: 'uppercase', padding: '0.6rem 1rem',
  textAlign: 'left', borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
}

const tdStyle = {
  padding: '0.6rem 1rem', borderBottom: '1px solid var(--border)',
  verticalAlign: 'middle',
}