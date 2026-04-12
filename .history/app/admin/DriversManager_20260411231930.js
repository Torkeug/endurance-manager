'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

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

// What roles can currentRole assign to a target
function getAllowedRoles(currentRole, targetRole, targetId, currentDriverId) {
  // Can't change own role
  if (targetId === currentDriverId) return null

  if (currentRole === 'super_admin') {
    // Super admin can promote/demote anyone except other super_admins
    if (targetRole === 'super_admin') return null
    return ['driver', 'admin']
  }

  if (currentRole === 'admin') {
    // Admin can only promote drivers to admin
    // Cannot touch admins or super_admins
    if (targetRole === 'admin' || targetRole === 'super_admin') return null
    return ['driver', 'admin']
  }

  return null
}

function canApproveOrRevoke(currentRole, targetRole, targetId, currentDriverId) {
  if (targetId === currentDriverId) return false
  if (currentRole === 'super_admin') return targetRole !== 'super_admin'
  if (currentRole === 'admin') return targetRole === 'driver'
  return false
}

export default function DriversManager({ initialDrivers, currentDriver }) {
  const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  const router = useRouter()
  const [drivers, setDrivers] = useState(initialDrivers)
  const [saving, setSaving]   = useState(null)
  const [error, setError]     = useState(null)
  const [filter, setFilter]   = useState('pending')

  const pending  = drivers.filter(d => !d.approved && !d.refused)
  const refused  = drivers.filter(d => d.refused)
  const approved = drivers.filter(d => d.approved && !d.refused)

  const approve = async (driverId) => {
    setSaving(driverId); setError(null)
    const { error: err } = await supabase
      .from('drivers').update({ approved: true, refused: false }).eq('id', driverId)
    if (err) { setError(err.message); setSaving(null); return }
    setDrivers(prev => prev.map(d => d.id === driverId ? { ...d, approved: true, refused: false } : d))
    setSaving(null); router.refresh()
  }

  const refuse = async (driverId) => {
    if (!confirm('Refuser cet accès ? Le pilote ne pourra plus se connecter avec cet email.')) return
    setSaving(driverId); setError(null)
    const { error: err } = await supabase
      .from('drivers').update({ approved: false, refused: true }).eq('id', driverId)
    if (err) { setError(err.message); setSaving(null); return }
    setDrivers(prev => prev.map(d => d.id === driverId ? { ...d, approved: false, refused: true } : d))
    setSaving(null); router.refresh()
  }

  const revoke = async (driverId) => {
    if (!confirm('Révoquer l\'accès de ce pilote ? Il sera mis en attente d\'approbation.')) return
    setSaving(driverId); setError(null)
    const { error: err } = await supabase
      .from('drivers').update({ approved: false }).eq('id', driverId)
    if (err) { setError(err.message); setSaving(null); return }
    setDrivers(prev => prev.map(d => d.id === driverId ? { ...d, approved: false } : d))
    setSaving(null); router.refresh()
  }

  const deleteDriver = async (driverId) => {
    if (!confirm('Supprimer définitivement ce pilote ? Cette action est irréversible.')) return
    setSaving(driverId); setError(null)
    const { error: err } = await supabase.from('drivers').delete().eq('id', driverId)
    if (err) {
      if (err.code === '23503') {
        setError('Ce pilote est lié à des données existantes (relais, inscriptions) et ne peut pas être supprimé.')
      } else {
        setError(err.message)
      }
      setSaving(null); return
    }
    setDrivers(prev => prev.filter(d => d.id !== driverId))
    setSaving(null); router.refresh()
  }

  const changeRole = async (driverId, role) => {
    setSaving(driverId); setError(null)
    const { error: err } = await supabase
      .from('drivers').update({ role }).eq('id', driverId)
    if (err) { setError(err.message); setSaving(null); return }
    setDrivers(prev => prev.map(d => d.id === driverId ? { ...d, role } : d))
    setSaving(null); router.refresh()
  }

  const toggleMembership = async (driverId, value) => {
    setSaving(driverId)
    const { error: err } = await supabase
      .from('drivers').update({ membership_ok: value }).eq('id', driverId)
    if (err) { setError(err.message); setSaving(null); return }
    setDrivers(prev => prev.map(d => d.id === driverId ? { ...d, membership_ok: value } : d))
    setSaving(null)
  }

  const toggleTestDriver = async (driverId, value) => {
    setSaving(driverId)
    const { error: err } = await supabase
      .from('drivers').update({ test_driver: value }).eq('id', driverId)
    if (err) { setError(err.message); setSaving(null); return }
    setDrivers(prev => prev.map(d => d.id === driverId ? { ...d, test_driver: value } : d))
    setSaving(null)
  }

  const tabs = [
    { id: 'pending',  label: `En attente (${pending.length})`,  danger: pending.length > 0 },
    { id: 'all',      label: `Approuvés (${approved.length})` },
    { id: 'refused',  label: `Refusés (${refused.length})` },
  ]

  return (
    <div>
      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setFilter(tab.id)} style={{
            padding: '0.4rem 1rem', borderRadius: '3px', border: '1px solid',
            borderColor: filter === tab.id ? (tab.danger ? 'var(--danger)' : 'var(--accent)') : 'var(--border)',
            background: filter === tab.id ? (tab.danger ? 'rgba(224,85,85,0.1)' : 'var(--accent-dim)') : 'var(--surface-2)',
            color: filter === tab.id ? (tab.danger ? 'var(--danger)' : 'var(--accent)') : 'var(--text-dim)',
            fontFamily: 'var(--font-rajdhani), sans-serif',
            fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Pending */}
      {filter === 'pending' && (
        pending.length === 0 ? (
          <div className="card"><div className="empty">Aucun pilote en attente d&apos;approbation.</div></div>
        ) : (
          <div className="table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={TH}>Nom</th>
                  <th style={TH}>Email</th>
                  <th style={TH}>iRacing ID</th>
                  <th style={TH}>Discord</th>
                  <th style={TH}></th>
                </tr>
              </thead>
              <tbody>
                {pending.map(d => (
                  <tr key={d.id} style={{ opacity: saving === d.id ? 0.5 : 1 }}>
                    <td style={TD}><span style={{ fontWeight: 600 }}>{d.name}</span></td>
                    <td style={TD} className="mono">{d.email || '—'}</td>
                    <td style={TD} className="mono">{d.iracing_id || '—'}</td>
                    <td style={TD}>{d.discord || '—'}</td>
                    <td style={TD}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => approve(d.id)}
                          className="btn btn-primary btn-sm" disabled={saving === d.id}>
                          ✓ Approuver
                        </button>
                        <button onClick={() => refuse(d.id)}
                          className="btn btn-danger btn-sm" disabled={saving === d.id}>
                          ✗ Refuser
                        </button>
                        <button onClick={() => deleteDriver(d.id)}
                          className="btn btn-secondary btn-sm" disabled={saving === d.id}>
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Approved */}
      {filter === 'all' && (
        approved.length === 0 ? (
          <div className="card"><div className="empty">Aucun pilote approuvé.</div></div>
        ) : (
          <div className="table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={TH}>Nom</th>
                  <th style={TH}>Email</th>
                  <th style={TH}>Rôle</th>
                  <th style={TH}></th>
                  <th style={TH}>Cotisation</th>
                  <th style={TH}>Test</th>
                </tr>
              </thead>
              <tbody>
                {approved.map(d => {
                  const allowedRoles = getAllowedRoles(currentDriver?.role, d.role, d.id, currentDriver?.id)
                  const canAct = canApproveOrRevoke(currentDriver?.role, d.role, d.id, currentDriver?.id)
                  const isMe = d.id === currentDriver?.id

                  return (
                    <tr key={d.id} style={{ opacity: saving === d.id ? 0.5 : 1 }}>
                      <td style={TD}>
                        <span style={{ fontWeight: 600 }}>{d.name}</span>
                        {isMe && <span style={{ marginLeft: '0.5rem', fontSize: '0.72rem', color: 'var(--accent)' }}>( vous)</span>}
                      </td>
                      <td style={{ ...TD, fontSize: '0.82rem' }} className="mono">{d.email || '—'}</td>
                      <td style={TD}>
                        {allowedRoles ? (
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
                            {allowedRoles.map(r => (
                              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                            ))}
                          </select>
                        ) : (
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: ROLE_COLORS[d.role] }}>
                            {ROLE_LABELS[d.role] || 'Pilote'}
                          </span>
                        )}
                      </td>
                      <td style={TD}>
                        {canAct && (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={() => revoke(d.id)}
                              className="btn btn-secondary btn-sm" disabled={saving === d.id}>
                              Révoquer
                            </button>
                            <button onClick={() => deleteDriver(d.id)}
                              className="btn btn-danger btn-sm" disabled={saving === d.id}>
                              Supprimer
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Refused */}
      {filter === 'refused' && (
        refused.length === 0 ? (
          <div className="card"><div className="empty">Aucun pilote refusé.</div></div>
        ) : (
          <div className="table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={TH}>Nom</th>
                  <th style={TH}>Email</th>
                  <th style={TH}></th>
                </tr>
              </thead>
              <tbody>
                {refused.map(d => (
                  <tr key={d.id} style={{ opacity: saving === d.id ? 0.5 : 1 }}>
                    <td style={TD}><span style={{ fontWeight: 600 }}>{d.name}</span></td>
                    <td style={TD} className="mono">{d.email || '—'}</td>
                    <td style={TD}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => approve(d.id)}
                          className="btn btn-primary btn-sm" disabled={saving === d.id}>
                          Approuver
                        </button>
                        <button onClick={() => deleteDriver(d.id)}
                          className="btn btn-danger btn-sm" disabled={saving === d.id}>
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}

const TH = {
  background: 'var(--surface-2)', color: 'var(--text-dim)',
  fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em',
  textTransform: 'uppercase', padding: '0.6rem 1rem',
  textAlign: 'left', borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
}

const TD = {
  padding: '0.6rem 1rem', borderBottom: '1px solid var(--border)',
  verticalAlign: 'middle',
}