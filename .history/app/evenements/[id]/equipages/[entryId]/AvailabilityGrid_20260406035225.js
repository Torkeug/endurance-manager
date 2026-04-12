'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../../../../lib/supabase'

// ── Time helpers ───────────────────────────────────────────

function generateSlots(irlStart, durationMinutes) {
  const slots = []
  const start = new Date(new Date(irlStart).getTime() - 60 * 60 * 1000)
  const end   = new Date(new Date(irlStart).getTime() + (durationMinutes + 60) * 60 * 1000)
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
  return new Date(igStart.getTime() + (new Date(irlSlot) - irlStart))
}

function getPhase(igTime, sunriseStr, sunsetStr) {
  if (!igTime || !sunriseStr || !sunsetStr) return null
  const minutes = igTime.getHours() * 60 + igTime.getMinutes()
  const [srH, srM] = sunriseStr.split(':').map(Number)
  const [ssH, ssM] = sunsetStr.split(':').map(Number)
  const sunrise = srH * 60 + srM
  const sunset  = ssH * 60 + ssM
  if (sunrise < sunset) {
    if (minutes >= sunrise + 30 && minutes < sunset - 30) return '☀️'
    if (minutes >= sunset + 30 || minutes < sunrise - 30) return '🌑'
    return '🌗'
  } else {
    if (minutes >= sunrise + 30 || minutes < sunset - 30) return '☀️'
    if (minutes >= sunset + 30 && minutes < sunrise - 30) return '🌑'
    return '🌗'
  }
}

function formatTime(date) {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function formatDate(date) {
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: '2-digit' })
}

function sameDay(a, b) {
  return a.toDateString() === b.toDateString()
}

// ── Component ──────────────────────────────────────────────

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
  const [loading, setLoading]                   = useState(true)

  // Drag state
  const isDragging      = useRef(false)
  const dragValue       = useRef(null)   // true = marking available, false = marking unavailable
  const pendingUpdates  = useRef({})     // slots toggled during drag, committed on mouseup
  const [dragPreview, setDragPreview]   = useState({}) // optimistic preview during drag

  const slots      = irlStart ? generateSlots(irlStart, durationMinutes || 0) : []
  const raceStart  = irlStart ? new Date(irlStart) : null

  // Load all availability records
  useEffect(() => {
    if (!teamEntryId) return
    supabase.from('availabilities')
      .select('*').eq('team_entry_id', teamEntryId)
      .then(({ data }) => {
        const map = {}
        ;(data || []).forEach(a => { map[`${a.driver_id}_${a.slot_start}`] = a })
        setAvailabilities(map)
        setLoading(false)
      })
  }, [teamEntryId])

  const getAvail = (driverId, slot) =>
    availabilities[`${driverId}_${slot.toISOString()}`]

  const isAvailable = (driverId, slot) => {
    const key = `${driverId}_${slot.toISOString()}`
    if (dragPreview[key] !== undefined) return dragPreview[key]
    return getAvail(driverId, slot)?.available || false
  }

  // ── Drag handlers ─────────────────────────────────────────

  const startDrag = (slot) => {
    if (!selectedDriverId) return
    isDragging.current = true
    const current = isAvailable(selectedDriverId, slot)
    dragValue.current = !current
    pendingUpdates.current = {}
    applyDrag(slot)
  }

  const applyDrag = (slot) => {
    if (!isDragging.current || !selectedDriverId) return
    const key = `${selectedDriverId}_${slot.toISOString()}`
    if (pendingUpdates.current[key] !== undefined) return // already applied
    pendingUpdates.current[key] = { slot, value: dragValue.current }
    setDragPreview(prev => ({ ...prev, [key]: dragValue.current }))
  }

  const commitDrag = useCallback(async () => {
    if (!isDragging.current) return
    isDragging.current = false
    const updates = Object.values(pendingUpdates.current)
    pendingUpdates.current = {}
    setDragPreview({})

    if (updates.length === 0) return

    // Batch upsert
    const rows = updates.map(({ slot, value }) => ({
      team_entry_id: teamEntryId,
      driver_id:     selectedDriverId,
      slot_start:    slot.toISOString(),
      available:     value,
      updated_at:    new Date().toISOString(),
    }))

    // Optimistic update to main state
    setAvailabilities(prev => {
      const next = { ...prev }
      rows.forEach(row => {
        next[`${row.driver_id}_${row.slot_start}`] = row
      })
      return next
    })

    await supabase.from('availabilities').upsert(rows, {
      onConflict: 'team_entry_id,driver_id,slot_start'
    })
  }, [selectedDriverId, teamEntryId])

  // Listen for mouseup/touchend globally to end drag
  useEffect(() => {
    const end = () => commitDrag()
    window.addEventListener('mouseup', end)
    window.addEventListener('touchend', end)
    return () => {
      window.removeEventListener('mouseup', end)
      window.removeEventListener('touchend', end)
    }
  }, [commitDrag])

  // ── Helpers ───────────────────────────────────────────────

  const isRaceStart = (slot) =>
    raceStart && Math.abs(slot - raceStart) < 15 * 60 * 1000

  const isAfterEnd = (slot) => {
    if (!raceStart || !durationMinutes) return false
    return slot > new Date(raceStart.getTime() + durationMinutes * 60 * 1000)
  }

  const driverCounts = assignedDrivers.reduce((acc, d) => {
    const id = d.drivers?.id
    acc[id] = slots.filter(s => isAvailable(id, s)).length
    return acc
  }, {})

  // ── Styles ────────────────────────────────────────────────

  const TH_BASE = {
    background: 'var(--surface-2)',
    color: 'var(--text-dim)',
    fontSize: '0.68rem',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    padding: '0.5rem 0.4rem',
    borderBottom: '2px solid var(--border)',
    whiteSpace: 'nowrap',
    userSelect: 'none',
  }

  const TD_BASE = {
    padding: '0.2rem 0.4rem',
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'middle',
    fontSize: '0.8rem',
    userSelect: 'none',
  }

  // ── Early returns ─────────────────────────────────────────

  if (!irlStart) return (
    <div className="card"><div className="empty">Aucun horaire de départ configuré.</div></div>
  )
  if (assignedDrivers.length === 0) return (
    <div className="card"><div className="empty">Aucun pilote assigné à cet équipage.</div></div>
  )

  // ── Render ────────────────────────────────────────────────

  return (
    <div>
      {/* Driver selector */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="form-group">
          <label>Remplir ma disponibilité</label>
          <select value={selectedDriverId} onChange={e => setSelectedDriverId(e.target.value)}>
            <option value="">— Sélectionnez votre nom —</option>
            {assignedDrivers.map(d => (
              <option key={d.drivers?.id} value={d.drivers?.id}>{d.drivers?.name}</option>
            ))}
          </select>
        </div>
        <p style={{ fontSize: '0.78rem', color: selectedDriverId ? 'var(--accent)' : 'var(--text-dim)', marginTop: '0.5rem' }}>
          {selectedDriverId
            ? 'Cliquez ou glissez sur les créneaux pour marquer votre disponibilité.'
            : 'Sélectionnez votre nom pour activer l\'édition.'}
        </p>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="card"><div className="empty">Chargement…</div></div>
      ) : (
        <div style={{
          border: '1px solid var(--border)',
          borderRadius: '4px',
          maxHeight: '65vh',
          overflowY: 'auto',
          overflowX: 'auto',
        }}>
          <table style={{
            borderCollapse: 'collapse',
            width: '100%',
            minWidth: `${180 + assignedDrivers.length * 56}px`,
          }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 3 }}>
              <tr>
                <th style={{ ...TH_BASE, textAlign: 'left', position: 'sticky', left: 0, zIndex: 4, minWidth: '72px' }}>
                  IRL
                </th>
                <th style={{ ...TH_BASE, textAlign: 'center', minWidth: '54px' }}>IG</th>
                <th style={{ ...TH_BASE, textAlign: 'center', width: '32px' }}>⏱</th>
                {assignedDrivers.map(d => (
                  <th key={d.drivers?.id} style={{
                    ...TH_BASE,
                    textAlign: 'center',
                    minWidth: '52px',
                    color: d.drivers?.id === selectedDriverId ? 'var(--accent)' : 'var(--text-dim)',
                  }}>
                    <div>{d.drivers?.name?.split(' ')[0]}</div>
                    <div style={{ fontSize: '0.6rem', fontWeight: 400, color: 'var(--text-dim)' }}>
                      {driverCounts[d.drivers?.id] || 0}×30m
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slots.map((slot, i) => {
                const igTime  = getIGTime(slot, irlStart, igStartTime)
                const phase   = getPhase(igTime, igSunrise, igSunset)
                const isStart = isRaceStart(slot)
                const isPast  = isAfterEnd(slot)
                const newDay  = i > 0 && !sameDay(slots[i - 1], slot)

                const rowBg = isStart
                  ? 'rgba(201,168,76,0.12)'
                  : isPast
                  ? 'rgba(0,0,0,0.2)'
                  : 'transparent'

                return (
                  <>
                    {newDay && (
                      <tr key={`day-${slot.toISOString()}`}>
                        <td colSpan={3 + assignedDrivers.length} style={{
                          background: 'var(--surface-2)',
                          padding: '0.3rem 0.75rem',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          color: 'var(--text-dim)',
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          borderBottom: '1px solid var(--border)',
                          borderTop: '2px solid var(--border)',
                          position: 'sticky',
                          left: 0,
                        }}>
                          {formatDate(slot)}
                        </td>
                      </tr>
                    )}
                    <tr
                      key={slot.toISOString()}
                      style={{
                        background: rowBg,
                        opacity: isPast ? 0.55 : 1,
                        borderTop: isStart ? '2px solid var(--accent)' : undefined,
                        borderBottom: isStart ? '2px solid var(--accent)' : undefined,
                      }}
                    >
                      {/* IRL time — sticky */}
                      <td style={{
                        ...TD_BASE,
                        position: 'sticky',
                        left: 0,
                        zIndex: 1,
                        background: isStart
                          ? 'rgba(201,168,76,0.15)'
                          : isPast
                          ? '#0d0d18'
                          : 'var(--bg)',
                        borderRight: '1px solid var(--border)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span className="mono" style={{
                            fontSize: '0.82rem',
                            fontWeight: isStart ? 700 : 400,
                            color: isStart ? 'var(--accent)' : 'var(--text)',
                          }}>
                            {formatTime(slot)}
                          </span>
                          {isStart && (
                            <span style={{
                            fontSize: '0.6rem',
                            fontWeight: 700,
                            color: '#fff',
                            background: '#1a1a3a',
                            border: '1px solid var(--accent)',
                            padding: '1px 4px',
                            borderRadius: '2px',
                            }}>
                            DÉPART
                            </span>
                          )}
                        </div>
                      </td>

                      {/* IG time */}
                      <td style={{ ...TD_BASE, textAlign: 'center' }}>
                        <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                          {igTime ? formatTime(igTime) : '—'}
                        </span>
                      </td>

                      {/* Phase */}
                      <td style={{ ...TD_BASE, textAlign: 'center', fontSize: '0.85rem' }}>
                        {phase || ''}
                      </td>

                      {/* Driver cells */}
                      {assignedDrivers.map(d => {
                        const driverId = d.drivers?.id
                        const avail    = isAvailable(driverId, slot)
                        const isMe     = driverId === selectedDriverId

                        return (
                          <td
                            key={driverId}
                            style={{ ...TD_BASE, textAlign: 'center', padding: '2px 3px' }}
                            onMouseDown={() => isMe && startDrag(slot)}
                            onMouseEnter={() => isMe && applyDrag(slot)}
                            onTouchStart={(e) => {
                              if (!isMe) return
                              e.preventDefault()
                              startDrag(slot)
                            }}
                            onTouchMove={(e) => {
                              if (!isMe || !isDragging.current) return
                              e.preventDefault()
                              const touch = e.touches[0]
                              const el = document.elementFromPoint(touch.clientX, touch.clientY)
                              if (el?.dataset?.slot) {
                                const s = new Date(el.dataset.slot)
                                applyDrag(s)
                              }
                            }}
                          >
                            <div
                              data-slot={slot.toISOString()}
                              style={{
                                width: '100%',
                                height: '24px',
                                border: '1px solid',
                                borderColor: avail
                                  ? 'var(--accent)'
                                  : isMe
                                  ? 'var(--border)'
                                  : 'transparent',
                                borderRadius: '3px',
                                background: avail
                                  ? 'var(--accent)'
                                  : isMe
                                  ? 'var(--surface-2)'
                                  : 'transparent',
                                cursor: isMe ? 'pointer' : 'default',
                                opacity: avail && !isMe ? 0.6 : 1,
                                transition: 'background 0.08s',
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
          <span style={{ width: 14, height: 14, background: 'var(--accent)', borderRadius: 2, display: 'inline-block' }} />
          Disponible
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ width: 14, height: 14, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 2, display: 'inline-block' }} />
          Indisponible / non renseigné
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ width: 14, height: 6, background: 'var(--accent)', borderRadius: 1, display: 'inline-block', opacity: 0.5 }} />
          Ligne de départ
        </span>
        <span>Cliquez ou glissez pour sélectionner plusieurs créneaux.</span>
      </div>
    </div>
  )
}