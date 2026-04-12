'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import React from 'react'

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

// ── Badge component ────────────────────────────────────────

function Badge({ label, bg, borderColor }) {
  return (
    <span style={{
      fontSize: '0.58rem',
      fontWeight: 700,
      color: '#fff',
      background: bg,
      border: `1px solid ${borderColor}`,
      padding: '1px 4px',
      borderRadius: '2px',
      flexShrink: 0,
    }}>
      {label}
    </span>
  )
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
  const [loading, setLoading]                   = useState(true)

  const isDragging     = useRef(false)
  const dragValue      = useRef(null)
  const pendingUpdates = useRef({})
  const [dragPreview, setDragPreview] = useState({})
  const [dragMode, setDragMode] = useState('available') // 'available' | 'unavailable' | 'tentative'

  const slots     = irlStart ? generateSlots(irlStart, durationMinutes || 0) : []
  const raceStart = irlStart ? new Date(irlStart) : null
  const raceEnd   = raceStart && durationMinutes
    ? new Date(raceStart.getTime() + durationMinutes * 60 * 1000)
    : null

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  useEffect(() => {
    if (!teamEntryId) return
    supabase.from('availabilities')
      .select('*').eq('team_entry_id', teamEntryId)
      .then(({ data }) => {
        const map = {}
        ;(data || []).forEach(a => {
          const key = `${a.driver_id}_${new Date(a.slot_start).toISOString()}`
          map[key] = a
        })
        setAvailabilities(map)
        setLoading(false)
      })
  }, [teamEntryId])

  const getAvail    = (driverId, slot) => availabilities[`${driverId}_${slot.toISOString()}`]
  const getSlotState = (driverId, slot) => {
    const key = `${driverId}_${slot.toISOString()}`
    if (dragPreview[key] !== undefined) return dragPreview[key]
    const record = getAvail(driverId, slot)
    if (!record) return false // no row = unavailable by default
    return record.available // true | false | null
  }

  // ── Drag ──────────────────────────────────────────────────

  const startDrag = (slot) => {
    if (!selectedDriverId) return
    isDragging.current = true
    dragValue.current = dragMode === 'available' ? true 
      : dragMode === 'unavailable' ? false 
      : null
    pendingUpdates.current = {}
    applyDrag(slot)
  }

  const applyDrag = (slot) => {
    if (!isDragging.current || !selectedDriverId) return
    const key = `${selectedDriverId}_${slot.toISOString()}`
    if (pendingUpdates.current[key] !== undefined) return
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

    const rows = updates.map(({ slot, value }) => ({
      team_entry_id: teamEntryId,
      driver_id:     selectedDriverId,
      slot_start:    slot.toISOString(),
      available:     value,
      updated_at:    new Date().toISOString(),
    }))

    setAvailabilities(prev => {
      const next = { ...prev }
      rows.forEach(row => { next[`${row.driver_id}_${row.slot_start}`] = row })
      return next
    })

    const { error: upsertError } = await supabase.from('availabilities').upsert(rows, {
      onConflict: 'team_entry_id,driver_id,slot_start'
    })
    if (upsertError) console.error('Upsert error:', upsertError)
  }, [selectedDriverId, teamEntryId])

  useEffect(() => {
    const end = () => commitDrag()
    window.addEventListener('mouseup', end)
    window.addEventListener('touchend', end)
    return () => {
      window.removeEventListener('mouseup', end)
      window.removeEventListener('touchend', end)
    }
  }, [commitDrag])

  // ── Row helpers ───────────────────────────────────────────

  const isRaceStart = (slot) => raceStart && Math.abs(slot - raceStart) < 15 * 60 * 1000
  const isRaceEnd   = (slot) => raceEnd   && Math.abs(slot - raceEnd)   < 15 * 60 * 1000
  const isAfterEnd  = (slot) => raceEnd   && slot > raceEnd

  const getRowStyle = (slot) => {
    if (isRaceStart(slot)) return { background: 'rgba(46,180,96,0.10)', borderTop: '2px solid #2eb460', borderBottom: '2px solid #2eb460' }
    if (isRaceEnd(slot))   return { background: 'rgba(224,85,85,0.08)',  borderTop: '2px solid var(--danger)',  borderBottom: '2px solid var(--danger)'  }
    if (isAfterEnd(slot))  return { background: 'rgba(0,0,0,0.18)', opacity: 0.55 }
    return {}
  }

  const getStickyBg = (slot) => {
    if (isRaceStart(slot)) return 'rgba(46,180,96,0.15)'
    if (isRaceEnd(slot))   return 'rgba(224,85,85,0.12)'
    if (isAfterEnd(slot))  return '#0d0d18'
    return 'var(--bg)'
  }

  const driverCounts = assignedDrivers.reduce((acc, d) => {
    const id = d.drivers?.id
    acc[id] = slots.filter(s => getSlotState(id, s) === true).length
    return acc
  }, {})

  // ── Styles ────────────────────────────────────────────────

  const TH = {
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
    textAlign: 'center',
  }

  const TD = {
    padding: '0.2rem 0.4rem',
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'middle',
    fontSize: '0.8rem',
    userSelect: 'none',
    textAlign: 'center',
  }

  // ── Guards ────────────────────────────────────────────────

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
            : "Sélectionnez votre nom pour activer l'édition."}
        </p>

        {selectedDriverId && (
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>
              Mode de saisie
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {[
                { value: 'available',   label: '✓ Disponible',   color: 'var(--accent)' },
                { value: 'unavailable', label: '✗ Indisponible',  color: 'var(--danger)' },
                { value: 'tentative',   label: '? Incertain',     color: '#3a8080' },
              ].map(({ value, label, color }) => (
                <button key={value} onClick={() => setDragMode(value)}
                  style={{
                    padding: '0.4rem 0.85rem', borderRadius: '3px', border: '1px solid',
                    borderColor: dragMode === value ? color : 'var(--border)',
                    background: dragMode === value ? `${color}22` : 'var(--surface-2)',
                    color: dragMode === value ? color : 'var(--text-dim)',
                    fontFamily: 'var(--font-rajdhani), sans-serif',
                    fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
          {selectedDriverId && (
            <button
              onClick={async () => {
                const updates = slots.map(slot => ({
                  team_entry_id: teamEntryId,
                  driver_id:     selectedDriverId,
                  slot_start:    slot.toISOString(),
                  available:     true,
                  updated_at:    new Date().toISOString(),
                }))
                setAvailabilities(prev => {
                  const next = { ...prev }
                  updates.forEach(u => { next[`${u.driver_id}_${u.slot_start}`] = u })
                  return next
                })
                await supabase.from('availabilities').upsert(updates, {
                  onConflict: 'team_entry_id,driver_id,slot_start'
                })
              }}
              className="btn btn-primary btn-sm"
            >
              Tout marquer disponible
            </button>
          )}

          {!selectedDriverId && (
            <button
              onClick={async () => {
                const input = prompt('Cette action efface les disponibilités de TOUS les pilotes.\nTapez CONFIRMER pour continuer :')
                if (input !== 'CONFIRMER') return
                const updates = assignedDrivers.flatMap(d =>
                  slots.map(slot => ({
                    team_entry_id: teamEntryId,
                    driver_id:     d.drivers?.id,
                    slot_start:    slot.toISOString(),
                    available:     false,
                    updated_at:    new Date().toISOString(),
                  }))
                )
                setAvailabilities(prev => {
                  const next = { ...prev }
                  updates.forEach(u => { next[`${u.driver_id}_${u.slot_start}`] = u })
                  return next
                })
                await supabase.from('availabilities').upsert(updates, {
                  onConflict: 'team_entry_id,driver_id,slot_start'
                })
              }}
              className="btn btn-danger btn-sm"
            >
              Effacer toutes les disponibilités
            </button>
          )}
        </div>
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
          width: '100%',
        }}>
          <table style={{
            borderCollapse: 'collapse',
            width: '100%',
            minWidth: `${160 + assignedDrivers.length * 52}px`,
          }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 3 }}>
              <tr>
                <th style={{ ...TH, textAlign: 'left', position: 'sticky', left: 0, zIndex: 4, minWidth: '56px', width: '56px' }}>
                  IRL
                </th>
                <th style={{ ...TH, minWidth: '52px' }}>IG</th>
                <th style={{ ...TH, width: '30px' }}>⏱</th>
                {assignedDrivers.map(d => (
                  <th key={d.drivers?.id} style={{
                    ...TH,
                    minWidth: '50px',
                    color: d.drivers?.id === selectedDriverId ? 'var(--accent)' : 'var(--text-dim)',
                  }}>
                    <div>{d.drivers?.name?.split(' ')[0]}</div>
                    <div style={{ fontSize: '0.58rem', fontWeight: 400, color: 'var(--text-dim)' }}>
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
                const newDay  = i > 0 && !sameDay(slots[i - 1], slot)
                const rowStyle = getRowStyle(slot)

                return (
                  <React.Fragment key={slot.toISOString()}>
                    {newDay && (
                      <tr>
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
                        }}>
                          {formatDate(slot)}
                        </td>
                      </tr>
                    )}
                    <tr>

                      {/* IRL time — sticky */}
                      <td style={{
                        ...TD,
                        textAlign: 'left',
                        position: 'sticky',
                        left: 0,
                        zIndex: 1,
                        background: getStickyBg(slot),
                        borderRight: '1px solid var(--border)',
                        width: '56px',
                        minWidth: '56px',
                        padding: '0.2rem 0.3rem',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexWrap: 'nowrap' }}>
                          <span className="mono" style={{
                            fontSize: '0.8rem',
                            fontWeight: 400,
                            color: isRaceStart(slot) ? '#2eb460' : isRaceEnd(slot) ? 'var(--danger)' : 'var(--text)',
                          }}>
                            {formatTime(slot)}
                          </span>
                          {isRaceStart(slot) && (
                            <Badge label="▶" bg="#2eb460" borderColor="#2eb460" />
                          )}
                          {isRaceEnd(slot) && (
                            <Badge label="■" bg="var(--danger)" borderColor="var(--danger)" />
                          )}
                        </div>
                      </td>

                      {/* IG time */}
                      <td style={TD}>
                        <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                          {igTime ? formatTime(igTime) : '—'}
                        </span>
                      </td>

                      {/* Phase */}
                      <td style={{ ...TD, fontSize: '0.85rem' }}>
                        {phase || ''}
                      </td>

                      {/* Driver cells */}
                      {assignedDrivers.map(d => {
                        const driverId = d.drivers?.id
                        const isMe     = driverId === selectedDriverId
                        const state = getSlotState(driverId, slot)
                        const cellBg = state === true  ? 'var(--accent)'
                                    : state === false ? '#3a1010'
                                    : state === null  ? '#2a2a3a'
                                    : isMe            ? 'var(--surface-2)'
                                    : 'transparent'
                        const cellBorder = state === true  ? 'var(--accent)'
                                        : state === false ? 'var(--danger)'
                                        : state === null  ? '#4a4a6a'
                                        : isMe            ? 'var(--border)'
                                        : 'transparent'

                        return (
                          <td
                            key={driverId}
                            style={{ ...TD, padding: '2px 3px' }}
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
                              if (el?.dataset?.slot) applyDrag(new Date(el.dataset.slot))
                            }}
                          >
                            <div
                              data-slot={slot.toISOString()}
                              style={{
                                width: '100%', height: '22px',
                                border: '1px solid', borderColor: cellBorder,
                                borderRadius: '3px', background: cellBg,
                                cursor: isMe ? 'pointer' : 'default',
                                transition: 'background 0.08s',
                              }}
                            />
                          </td>
                        )
                      })}
                    </tr>
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.75rem', fontSize: '0.78rem', color: 'var(--text-dim)', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ width: 14, height: 14, background: 'var(--accent)', borderRadius: 2, display: 'inline-block' }} />
          Disponible
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ width: 14, height: 14, background: '#2a2a3a', border: '1px solid #4a4a6a', borderRadius: 2, display: 'inline-block' }} />
          Incertain
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ width: 14, height: 14, background: '#3a1010', border: '1px solid var(--danger)', borderRadius: 2, display: 'inline-block' }} />
          Indisponible
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Badge label="▶" bg="#2eb460" borderColor="#2eb460" />
          Départ
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Badge label="■" bg="var(--danger)" borderColor="var(--danger)" />
          Fin
        </span>
        <span>Cliquez ou glissez pour appliquer le mode sélectionné.</span>
      </div>
    </div>
  )
}