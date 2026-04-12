'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../../../../lib/supabase'

// ── Time helpers ───────────────────────────────────────────

function generateSlots(irlStart, durationMinutes) {
  const slots = []
  const start = new Date(new Date(irlStart).getTime() - 60 * 60 * 1000) // 1h before
  const end   = new Date(new Date(irlStart).getTime() + (durationMinutes + 60) * 60 * 1000) // 1h after

  // Round down to nearest 30 min
  let current = new Date(start)
  current.setMinutes(Math.floor(current.getMinutes() / 30) * 30, 0, 0)

  while (current <= end) {
    slots.push(new Date(current))
    current = new Date(current.getTime() + 30 * 60 * 1000)
  }
  return slots
}

function getIGTime(irlSlot, irlStartStr, igStartTimeStr) {
  if (!igStartTimeStr || !irlStartStr) return null
  const [igH, igM] = igStartTimeStr.split(':').map(Number)
  const irlStart = new Date(irlStartStr)
  const igStart  = new Date(irlStart)
  igStart.setHours(igH, igM, 0, 0)
  const diff = new Date(irlSlot) - irlStart
  return new Date(igStart.getTime() + diff)
}

function getPhase(igTime, sunriseStr, sunsetStr) {
  if (!igTime || !sunriseStr || !sunsetStr) return null
  const minutes = igTime.getHours() * 60 + igTime.getMinutes()
  const [srH, srM] = sunriseStr.split(':').map(Number)
  const [ssH, ssM] = sunsetStr.split(':').map(Number)
  const sunrise = srH * 60 + srM
  const sunset  = ssH * 60 + ssM

  // Handle day wrap (e.g. sunrise at 06:00, sunset at 20:00)
  if (sunrise < sunset) {
    if (minutes >= sunrise + 30 && minutes < sunset - 30) return '☀️'
    if (minutes >= sunset + 30 || minutes < sunrise - 30) return '🌑'
    return '🌗'
  } else {
    // Overnight scenario
    if (minutes >= sunrise + 30 || minutes < sunset - 30) return '☀️'
    if (minutes >= sunset + 30 && minutes < sunrise - 30) return '🌑'
    return '🌗'
  }
}

function formatTime(date) {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function formatDate(date) {
  return date.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' })
}

function sameDay(a, b) {
  return a.toDateString() === b.toDateString()
}

// ── Styles ─────────────────────────────────────────────────

const thStyle = {
  background: 'var(--surface-2)',
  color: 'var(--text-dim)',
  fontSize: '0.68rem',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  padding: '0.5rem 0.4rem',
  textAlign: 'center',
  borderBottom: '2px solid var(--border)',
  whiteSpace: 'nowrap',
}

const thLeftStyle = {
  ...thStyle,
  textAlign: 'left',
  position: 'sticky',
  left: 0,
  zIndex: 2,
  minWidth: '70px',
}

const tdStyle = {
  padding: '0.2rem 0.4rem',
  borderBottom: '1px solid var(--border)',
  verticalAlign: 'middle',
  fontSize: '0.8rem',
}

const tdStickyStyle = {
  ...tdStyle,
  position: 'sticky',
  left: 0,
  background: 'var(--bg)',
  zIndex: 1,
}

// ── Main component ─────────────────────────────────────────

export default function AvailabilityGrid({
  teamEntryId,
  assignedDrivers,
  irlStart,
  durationMinutes,
  igStartTime,
  igSunrise,
  igSunset,
}) {
  const [selectedDriverId, setSelectedDriverId] = useState('')
  const [availabilities, setAvailabilities]     = useState({})
  const [saving, setSaving]                     = useState(null)
  const [loading, setLoading]                   = useState(true)

  const slots = irlStart ? generateSlots(irlStart, durationMinutes || 0) : []

  // Load all availability records for this team entry
  useEffect(() => {
    if (!teamEntryId) return
    supabase.from('availabilities')
      .select('*')
      .eq('team_entry_id', teamEntryId)
      .then(({ data }) => {
        const map = {}
        ;(data || []).forEach(a => {
          map[`${a.driver_id}_${a.slot_start}`] = a
        })
        setAvailabilities(map)
        setLoading(false)
      })
  }, [teamEntryId])

  const getAvail = (driverId, slot) =>
    availabilities[`${driverId}_${slot.toISOString()}`]

  const toggleSlot = async (driverId, slot) => {
    const key      = `${driverId}_${slot.toISOString()}`
    const existing = availabilities[key]
    const newValue = !existing?.available

    setSaving(key)

    // Optimistic update
    setAvailabilities(prev => ({
      ...prev,
      [key]: {
        ...(existing || {}),
        driver_id:     driverId,
        team_entry_id: teamEntryId,
        slot_start:    slot.toISOString(),
        available:     newValue,
      }
    }))

    const { error } = await supabase.from('availabilities').upsert({
      team_entry_id: teamEntryId,
      driver_id:     driverId,
      slot_start:    slot.toISOString(),
      available:     newValue,
      updated_at:    new Date().toISOString(),
    }, { onConflict: 'team_entry_id,driver_id,slot_start' })

    if (error) {
      // Revert on error
      setAvailabilities(prev => ({ ...prev, [key]: existing }))
      console.error('Availability save error:', error)
    }
    setSaving(null)
  }

  const isRaceStart = (slot) => {
    if (!irlStart) return false
    return Math.abs(slot - new Date(irlStart)) < 15 * 60 * 1000
  }

  const isAfterEnd = (slot) => {
    if (!irlStart || !durationMinutes) return false
    return slot > new Date(new Date(irlStart).getTime() + durationMinutes * 60 * 1000)
  }

  // Count available slots per driver
  const driverCounts = assignedDrivers.reduce((acc, d) => {
    const id = d.drivers?.id
    acc[id] = slots.filter(s => getAvail(id, s)?.available).length
    return acc
  }, {})

  if (!irlStart) {
    return (
      <div className="card">
        <div className="empty">Aucun horaire de départ configuré pour cet équipage.</div>
      </div>
    )
  }

  if (assignedDrivers.length === 0) {
    return (
      <div className="card">
        <div className="empty">Aucun pilote assigné à cet équipage.</div>
      </div>
    )
  }

  return (
    <div>
      {/* Driver selector */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="form-group">
          <label>Remplir ma disponibilité</label>
          <select value={selectedDriverId} onChange={e => setSelectedDriverId(e.target.value)}>
            <option value="">— Sélectionnez votre nom —</option>
            {assignedDrivers.map(d => (
              <option key={d.drivers?.id} value={d.drivers?.id}>
                {d.drivers?.name}
              </option>
            ))}
          </select>
        </div>
        {selectedDriverId && (
          <p style={{ fontSize: '0.78rem', color: 'var(--accent)', marginTop: '0.5rem' }}>
            Cliquez sur les créneaux pour marquer votre disponibilité.
          </p>
        )}
        {!selectedDriverId && (
          <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '0.5rem' }}>
            Sélectionnez votre nom pour activer l&apos;édition de votre colonne.
          </p>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="card"><div className="empty">Chargement…</div></div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: '4px', border: '1px solid var(--border)' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: `${200 + assignedDrivers.length * 60}px` }}>
            <thead>
              <tr>
                <th style={thLeftStyle}>IRL</th>
                <th style={thStyle}>IG</th>
                <th style={thStyle}>⏱</th>
                {assignedDrivers.map(d => (
                  <th key={d.drivers?.id} style={{
                    ...thStyle,
                    color: d.drivers?.id === selectedDriverId ? 'var(--accent)' : 'var(--text-dim)',
                    minWidth: '52px',
                  }}>
                    <div>{d.drivers?.name?.split(' ')[0]}</div>
                    {!loading && (
                      <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', fontWeight: 400 }}>
                        {driverCounts[d.drivers?.id] || 0}×30min
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slots.map((slot, i) => {
                const igTime   = getIGTime(slot, irlStart, igStartTime)
                const phase    = getPhase(igTime, igSunrise, igSunset)
                const isStart  = isRaceStart(slot)
                const isPast   = isAfterEnd(slot)
                const newDay   = i > 0 && !sameDay(slots[i - 1], slot)

                return (
                  <>
                    {newDay && (
                      <tr key={`day-${slot.toISOString()}`}>
                        <td colSpan={3 + assignedDrivers.length} style={{
                          background: 'var(--surface-2)',
                          padding: '0.3rem 0.6rem',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          color: 'var(--text-dim)',
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          borderBottom: '1px solid var(--border)',
                        }}>
                          {formatDate(slot)}
                        </td>
                      </tr>
                    )}
                    <tr
                      key={slot.toISOString()}
                      style={{
                        background: isStart
                          ? 'rgba(201, 168, 76, 0.06)'
                          : isPast
                          ? 'rgba(0,0,0,0.15)'
                          : 'transparent',
                        opacity: isPast ? 0.6 : 1,
                      }}
                    >
                      {/* IRL time */}
                      <td style={{
                        ...tdStickyStyle,
                        background: isStart ? 'rgba(201,168,76,0.06)' : isPast ? 'rgba(0,0,0,0.15)' : 'var(--bg)',
                      }}>
                        <span className="mono" style={{ fontSize: '0.8rem', fontWeight: isStart ? 700 : 400 }}>
                          {formatTime(slot)}
                        </span>
                        {isStart && (
                          <span style={{ marginLeft: '4px', fontSize: '0.6rem', color: 'var(--accent)', fontWeight: 700 }}>
                            ▶
                          </span>
                        )}
                      </td>

                      {/* IG time */}
                      <td style={tdStyle}>
                        <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                          {igTime ? formatTime(igTime) : '—'}
                        </span>
                      </td>

                      {/* Phase */}
                      <td style={{ ...tdStyle, textAlign: 'center', fontSize: '0.85rem' }}>
                        {phase || ''}
                      </td>

                      {/* Driver cells */}
                      {assignedDrivers.map(d => {
                        const driverId  = d.drivers?.id
                        const avail     = getAvail(driverId, slot)
                        const available = avail?.available
                        const isMe      = driverId === selectedDriverId
                        const key       = `${driverId}_${slot.toISOString()}`
                        const isSaving  = saving === key

                        return (
                          <td key={driverId} style={{ ...tdStyle, textAlign: 'center', padding: '2px 3px' }}>
                            <button
                              onClick={() => isMe && toggleSlot(driverId, slot)}
                              disabled={!isMe || isSaving}
                              title={isMe ? (available ? 'Marquer indisponible' : 'Marquer disponible') : d.drivers?.name}
                              style={{
                                width: '100%',
                                height: '26px',
                                border: '1px solid',
                                borderColor: available
                                  ? 'var(--accent)'
                                  : isMe
                                  ? 'var(--border)'
                                  : 'transparent',
                                borderRadius: '3px',
                                background: available
                                  ? 'var(--accent-dim)'
                                  : isMe
                                  ? 'var(--surface-2)'
                                  : 'transparent',
                                cursor: isMe ? 'pointer' : 'default',
                                opacity: isSaving ? 0.4 : 1,
                                transition: 'all 0.1s',
                              }}
                            />
                          </td>
                        )
                      })}
                    </tr>
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.75rem', fontSize: '0.78rem', color: 'var(--text-dim)', flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ width: 14, height: 14, background: 'var(--accent-dim)', border: '1px solid var(--accent)', borderRadius: 2, display: 'inline-block' }} />
          Disponible
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ width: 14, height: 14, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 2, display: 'inline-block' }} />
          Indisponible
        </span>
        <span>▶ = Heure de départ</span>
      </div>
    </div>
  )
}