'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../../../../lib/supabase'

// ── Helpers ────────────────────────────────────────────────

function formatTime(date) {
  if (!date) return '—'
  return new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function formatDatetime(date) {
  if (!date) return '—'
  return new Date(date).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function formatDuration(seconds) {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h${String(m).padStart(2,'0')}`
  return `${m}min`
}

function getIGTime(irlTime, irlStartStr, igStartTimeStr) {
  if (!igStartTimeStr || !irlStartStr || !irlTime) return null
  const [igH, igM] = igStartTimeStr.split(':').map(Number)
  const irlStart = new Date(irlStartStr)
  const igStart  = new Date(irlStart)
  igStart.setHours(igH, igM, 0, 0)
  return new Date(igStart.getTime() + (new Date(irlTime) - irlStart))
}

function getPhase(igTime, sunriseStr, sunsetStr) {
  if (!igTime || !sunriseStr || !sunsetStr) return null
  const minutes = new Date(igTime).getHours() * 60 + new Date(igTime).getMinutes()
  const [srH, srM] = sunriseStr.split(':').map(Number)
  const [ssH, ssM] = sunsetStr.split(':').map(Number)
  const sunrise = srH * 60 + srM
  const sunset  = ssH * 60 + ssM
  if (sunrise < sunset) {
    if (minutes >= sunrise + 30 && minutes < sunset - 30) return '☀️'
    if (minutes >= sunset + 30 || minutes < sunrise - 30) return '🌑'
    return '🌗'
  }
  if (minutes >= sunrise + 30 || minutes < sunset - 30) return '☀️'
  if (minutes >= sunset + 30 && minutes < sunrise - 30) return '🌑'
  return '🌗'
}

// ── Availability check ─────────────────────────────────────
// Rules:
// - Only 'available' if ALL 30-min slots in window are marked available
// - 'partial' if some slots are available
// - 'unavailable' if at least one slot is explicitly marked unavailable
// - null (unknown) if no slots have been filled at all in the window

function checkAvailability(availabilities, driverId, irlStart, irlEnd) {
  if (!irlStart || !irlEnd || !driverId) return null
  const start = new Date(irlStart).getTime()
  const end   = new Date(irlEnd).getTime()

  // For short stints: find the 30-min slot that contains the start time
  const slotStart = new Date(start)
  slotStart.setMinutes(Math.floor(slotStart.getMinutes() / 30) * 30, 0, 0)

  const windowSlots = Object.values(availabilities).filter(a => {
    if (a.driver_id !== driverId) return false
    const t = new Date(a.slot_start).getTime()
    // Include slot if it overlaps with the stint window
    return t < end && (t + 30 * 60 * 1000) > start
  })

  if (windowSlots.length === 0) return 'unavailable'
  const availableCount  = windowSlots.filter(a => a.available === true).length
  const unavailableCount = windowSlots.filter(a => a.available === false).length
  const tentativeCount  = windowSlots.filter(a => a.available === null).length

  if (availableCount === windowSlots.length) return 'available'
  if (unavailableCount > 0 && availableCount === 0 && tentativeCount === 0) return 'unavailable'
  if (availableCount > 0) return 'partial'
  if (tentativeCount > 0 && availableCount === 0 && unavailableCount === 0) return 'tentative'
  return 'partial'
}

// ── Calculation engine ─────────────────────────────────────

function calcStint(stint, teamEntry, driverPerf, igStartTime, igSunrise, igSunset, irlStart) {
  const pitLane    = teamEntry?.events?.circuits?.pit_lane_time_seconds || 0
  const refuel     = teamEntry?.refuel_time_seconds || 0
  const tyreChange = teamEntry?.tyre_change_time_seconds || 0
  const tankSize   = teamEntry?.cars?.tank_size_litres
  const raceStart  = teamEntry?.event_start_times?.irl_start

  const perf = driverPerf[stint.driver_id]
  const lapTimeSec = stint.rain
    ? (perf?.lap_time_wet || perf?.lap_time_dry || null)
    : (perf?.lap_time_dry || perf?.lap_time_wet || null)
  const fuelPerLap = stint.rain
    ? (perf?.fuel_wet || perf?.fuel_dry || null)
    : (perf?.fuel_dry || perf?.fuel_wet || null)

  // Laps: manual override > calculated from fuel+tank
  const calcLaps = (fuelPerLap && tankSize) ? Math.max(1, Math.floor(tankSize / fuelPerLap)) : null
  // If we have lap time but no laps, estimate from 1h default
  const laps = stint.laps_planned || calcLaps || (lapTimeSec ? Math.floor(3600 / lapTimeSec) : null)

  // Duration: laps × lap time > manual minutes
  const stintDurationSec = (laps && lapTimeSec)
    ? Math.round(laps * lapTimeSec)
    : (stint.duration_minutes ? stint.duration_minutes * 60 : 3600)

  const fuelUsed   = (laps && fuelPerLap) ? laps * fuelPerLap : null
  const pitStopSec = pitLane + refuel + (stint.tyre_change ? tyreChange : 0)

  const stintIrlStart = irlStart
  const stintIrlEnd   = (stintIrlStart && stintDurationSec)
    ? new Date(stintIrlStart.getTime() + stintDurationSec * 1000)
    : null

  const nextStart = stintIrlEnd
    ? new Date(stintIrlEnd.getTime() + pitStopSec * 1000)
    : null

  const igStart = getIGTime(stintIrlStart, raceStart, igStartTime)
  const phase   = getPhase(igStart, igSunrise, igSunset)

  return {
    ...stint,
    _irlStart:         stintIrlStart,
    _irlEnd:           stintIrlEnd,
    _igStart:          igStart,
    _phase:            phase,
    _laps:             laps,
    _calcLaps:         calcLaps,
    _lapTimeSec:       lapTimeSec,
    _fuelUsed:         fuelUsed,
    _pitStopSec:       pitStopSec,
    _stintDurationSec: stintDurationSec,
    _hasPerfData:      !!lapTimeSec,
    _nextStart:        nextStart,
  }
}

function calculateAllStints(stints, teamEntry, driverPerf, igStartTime, igSunrise, igSunset) {
  const raceStart = teamEntry?.event_start_times?.irl_start
  let currentTime = raceStart ? new Date(raceStart) : null
  const result = []

  for (const stint of stints) {
    const calc = calcStint(stint, teamEntry, driverPerf, igStartTime, igSunrise, igSunset, currentTime)
    result.push(calc)
    currentTime = calc._nextStart || null
  }

  return result
}

// ── Auto-generate ──────────────────────────────────────────

function estimateStintCount(teamEntry, driverPerf, assignedDrivers) {
  const durationMinutes = teamEntry?.events?.duration_minutes
  const tankSize        = teamEntry?.cars?.tank_size_litres
  if (!durationMinutes) return 1

  const driverIds = assignedDrivers.map(d => d.drivers?.id).filter(Boolean)
  const perfs = driverIds.map(id => driverPerf[id]).filter(p => p?.lap_time_dry && p?.fuel_dry)

  if (perfs.length === 0) return Math.max(1, Math.ceil(durationMinutes / 60))

  const avgLapSec  = perfs.reduce((s, p) => s + p.lap_time_dry, 0) / perfs.length
  const avgFuel    = perfs.reduce((s, p) => s + p.fuel_dry,     0) / perfs.length
  const lapsPerStint = tankSize ? Math.floor(tankSize / avgFuel) : Math.ceil(60 * 60 / avgLapSec)
  const stintDurMin  = Math.round((lapsPerStint * avgLapSec) / 60)

  return Math.max(1, Math.ceil(durationMinutes / stintDurMin))
}

// ── Main component ─────────────────────────────────────────

export default function StintGrid({ teamEntryId, teamEntry, assignedDrivers }) {
  const [stints, setStints]         = useState([])
  const [driverPerf, setDriverPerf] = useState({})
  const [availabilities, setAvailabilities] = useState({})
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(null)
  const [autoGenDone, setAutoGenDone] = useState(false)

  const event       = teamEntry?.events
  const igStartTime = event?.ig_start_time
  const igSunrise   = event?.ig_sunrise
  const igSunset    = event?.ig_sunset

  useEffect(() => {
    if (!teamEntryId) return
    Promise.all([
      supabase.from('stints').select('*').eq('team_entry_id', teamEntryId).order('stint_number'),
      supabase.from('driver_performance').select('*').eq('team_entry_id', teamEntryId),
      supabase.from('availabilities').select('*').eq('team_entry_id', teamEntryId),
    ]).then(([{ data: stintsData }, { data: perfData }, { data: availData }]) => {
      const perfMap = {}
      ;(perfData || []).forEach(p => { perfMap[p.driver_id] = p })
      setDriverPerf(perfMap)

      const availMap = {}
      ;(availData || []).forEach(a => {
        const key = `${a.driver_id}_${new Date(a.slot_start).toISOString()}`
        availMap[key] = a
      })
      setAvailabilities(availMap)

      const loadedStints = stintsData || []
      setStints(loadedStints)
      setLoading(false)

      // Auto-generate if no stints exist yet
      if (loadedStints.length === 0 && !autoGenDone) {
        setAutoGenDone(true)
        const count = estimateStintCount(teamEntry, perfMap, assignedDrivers)
        const rows = Array.from({ length: count }, (_, i) => ({
          team_entry_id: teamEntryId,
          stint_number:  i + 1,
          rain:          false,
          tyre_change:   false,
        }))
        supabase.from('stints').insert(rows).select()
          .then(({ data }) => { if (data) setStints(data) })
      }
    })
  }, [teamEntryId])

  const calculated = calculateAllStints(stints, teamEntry, driverPerf, igStartTime, igSunrise, igSunset)

  // Save IRL times back to DB whenever calculation changes
  useEffect(() => {
    if (calculated.length === 0) return
    const updates = calculated
      .filter(s => s._irlStart || s._irlEnd)
      .map(s => ({
        id:        s.id,
        irl_start: s._irlStart ? s._irlStart.toISOString() : null,
        irl_end:   s._irlEnd   ? s._irlEnd.toISOString()   : null,
      }))
    if (updates.length === 0) return

    // Batch update — fire and forget
    Promise.all(
      updates.map(u => supabase.from('stints')
        .update({ irl_start: u.irl_start, irl_end_planned: u.irl_end })
        .eq('id', u.id)
      )
    )
  }, [JSON.stringify(calculated.map(s => ({ id: s.id, start: s._irlStart, end: s._irlEnd })))])  

  // ── CRUD ──────────────────────────────────────────────────

  const addStint = async () => {
    const nextNum = stints.length > 0
      ? Math.max(...stints.map(s => s.stint_number)) + 1
      : 1
    const { data, error } = await supabase.from('stints')
      .insert([{ team_entry_id: teamEntryId, stint_number: nextNum, rain: false, tyre_change: false }])
      .select().single()
    if (!error) setStints(prev => [...prev, data])
  }

  const updateStint = async (stintId, field, value) => {
    setSaving(stintId)
    setStints(prev => prev.map(s => s.id === stintId ? { ...s, [field]: value } : s))
    await supabase.from('stints').update({ [field]: value }).eq('id', stintId)
    setSaving(null)
  }

  const deleteStint = async (stintId) => {
    if (!confirm('Supprimer ce relais ?')) return
    await supabase.from('stints').delete().eq('id', stintId)
    setStints(prev => prev.filter(s => s.id !== stintId))
  }

  const clearAllStints = async () => {
    if (!confirm('Supprimer tous les relais ?')) return
    await supabase.from('stints').delete().eq('team_entry_id', teamEntryId)
    setStints([])
  }

  // ── Styles ────────────────────────────────────────────────

  const TH = {
    background: 'var(--surface-2)', color: 'var(--text-dim)',
    fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em',
    textTransform: 'uppercase', padding: '0.5rem 0.5rem',
    borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap', textAlign: 'left',
  }

  const TD = {
    padding: '0.35rem 0.5rem', borderBottom: '1px solid var(--border)',
    verticalAlign: 'middle', fontSize: '0.82rem',
  }

  const INPUT = {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: '3px', color: 'var(--text)',
    fontFamily: 'var(--font-mono), monospace', fontSize: '0.8rem',
    padding: '0.25rem 0.4rem', width: '100%',
  }

  if (!teamEntry?.event_start_times?.irl_start) return (
    <div className="card"><div className="empty">Aucun horaire de départ configuré.</div></div>
  )
  if (assignedDrivers.length === 0) return (
    <div className="card"><div className="empty">Aucun pilote assigné — assignez des pilotes d&apos;abord.</div></div>
  )
  if (loading) return (
    <div className="card"><div className="empty">Chargement…</div></div>
  )

  const raceEndTime = teamEntry?.event_start_times?.irl_start && event?.duration_minutes
    ? new Date(new Date(teamEntry.event_start_times.irl_start).getTime() + event.duration_minutes * 60 * 1000)
    : null
  const lastCalc = calculated[calculated.length - 1]
  const projectedFinish = lastCalc?._irlEnd

  return (
    <div>
      {/* Summary */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {[
          { label: 'Départ', value: formatDatetime(teamEntry.event_start_times?.irl_start) },
          { label: 'Fin course', value: raceEndTime ? formatDatetime(raceEndTime) : '—' },
          { label: 'Relais', value: stints.length },
          {
            label: 'Fin prévue', value: projectedFinish ? formatDatetime(projectedFinish) : '—',
            color: raceEndTime && projectedFinish
              ? (projectedFinish > raceEndTime ? 'var(--danger)' : '#2eb460') : null
          },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: '4px', padding: '0.6rem 1rem', flex: 1, minWidth: '120px',
          }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.2rem' }}>{label}</div>
            <div className="mono" style={{ fontSize: '0.85rem', color: color || 'var(--text)' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '4px', marginBottom: '1rem' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: `${680 + assignedDrivers.length * 26}px` }}>
          <thead>
            <tr>
              <th style={{ ...TH, width: '28px' }}>#</th>
              <th style={{ ...TH, minWidth: '130px' }}>Pilote</th>
              <th style={TH}>Départ IRL</th>
              <th style={TH}>Fin IRL</th>
              <th style={{ ...TH, width: '68px' }}>Durée</th>
              <th style={{ ...TH, width: '52px' }}>Tours</th>
              <th style={{ ...TH, width: '60px' }}>Conso</th>
              <th style={{ ...TH, width: '52px' }}>IG</th>
              <th style={{ ...TH, width: '24px' }}>⏱</th>
              <th style={{ ...TH, width: '24px' }} title="Pluie">💧</th>
              <th style={{ ...TH, width: '24px' }} title="Changement de pneus">🛞</th>
              {assignedDrivers.map(d => (
                <th key={d.drivers?.id} style={{ ...TH, width: '26px', textAlign: 'center', fontSize: '0.58rem' }}
                  title={d.drivers?.name}>
                  {d.drivers?.name?.split(' ')[0]?.slice(0, 3)}
                </th>
              ))}
              <th style={{ ...TH, width: '36px' }}></th>
            </tr>
          </thead>
          <tbody>
            {calculated.length === 0 && (
              <tr>
                <td colSpan={11 + assignedDrivers.length} style={{ ...TD, textAlign: 'center', color: 'var(--text-dim)', padding: '2rem' }}>
                  Aucun relais planifié.
                </td>
              </tr>
            )}
            {calculated.map((stint, i) => {
              const isSaving = saving === stint.id

              return (
                <tr key={stint.id} style={{
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                  opacity: isSaving ? 0.6 : 1,
                }}>
                  {/* # */}
                  <td style={{ ...TD, textAlign: 'center' }}>
                    <span className="mono" style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>
                      {stint.stint_number}
                    </span>
                  </td>

                  {/* Driver */}
                  <td style={TD}>
                    <select
                      value={stint.driver_id || ''}
                      onChange={e => updateStint(stint.id, 'driver_id', e.target.value || null)}
                      style={{ ...INPUT, minWidth: '120px' }}
                    >
                      <option value="">— À définir —</option>
                      {assignedDrivers.map(d => {
                        const driverId = d.drivers?.id
                        const status = checkAvailability(availabilities, driverId, stint._irlStart, stint._irlEnd)
                        const isUnavailable = status === 'unavailable'
                        const suffix = isUnavailable ? ' ✗' : status === 'partial' ? ' ◑' : ''
                        return (
                          <option key={driverId} value={driverId}
                            disabled={isUnavailable}>
                            {d.drivers?.name}{suffix}
                          </option>
                        )
                      })}
                    </select>
                  </td>

                  {/* IRL Start */}
                  <td style={TD}>
                    <span className="mono" style={{ fontSize: '0.75rem' }}>
                      {stint._irlStart ? formatDatetime(stint._irlStart) : '—'}
                    </span>
                  </td>

                  {/* IRL End */}
                  <td style={TD}>
                    <span className="mono" style={{ fontSize: '0.75rem' }}>
                      {stint._irlEnd ? formatDatetime(stint._irlEnd) : '—'}
                    </span>
                  </td>

                  {/* Duration */}
                  <td style={TD}>
                    {stint._stintDurationSec ? (
                      <span className="mono" style={{ fontSize: '0.75rem' }}>
                        {formatDuration(stint._stintDurationSec)}
                      </span>
                    ) : (
                      <input type="number" placeholder="min"
                        value={stint.duration_minutes || ''}
                        onFocus={e => e.target.select()}
                        onChange={e => updateStint(stint.id, 'duration_minutes', e.target.value ? parseInt(e.target.value) : null)}
                        style={{ ...INPUT, width: '70px' }}
                        title="Durée manuelle en minutes" />
                    )}
                  </td>

                  {/* Laps */}
                  <td style={TD}>
                    <input type="number" min="1"
                      value={stint.laps_planned || ''}
                      placeholder={stint._calcLaps ? String(stint._calcLaps) : '—'}
                      onFocus={e => e.target.select()}
                      onChange={e => {
                        let val = e.target.value ? parseInt(e.target.value) : null
                        if (val !== null) {
                          val = Math.max(1, val) // minimum 1
                          // Max laps from tank capacity
                          const fuelPerLap = stint.rain
                            ? (driverPerf[stint.driver_id]?.fuel_wet || driverPerf[stint.driver_id]?.fuel_dry)
                            : (driverPerf[stint.driver_id]?.fuel_dry || driverPerf[stint.driver_id]?.fuel_wet)
                          const tankSize = teamEntry?.cars?.tank_size_litres
                          if (fuelPerLap && tankSize) {
                            val = Math.min(val, Math.floor(tankSize / fuelPerLap))
                          }
                        }
                        updateStint(stint.id, 'laps_planned', val)
                      }}
                      style={{ ...INPUT, width: '60px' }}
                      title={stint._calcLaps ? `Calculé : ${stint._calcLaps} tours` : 'Saisissez les tours'} />
                  </td>

                  {/* Fuel */}
                  <td style={TD}>
                    <span className="mono" style={{ fontSize: '0.72rem', color: stint._fuelUsed ? 'var(--accent)' : 'var(--text-dim)' }}>
                      {stint._fuelUsed ? `${stint._fuelUsed.toFixed(1)}L` : '—'}
                    </span>
                  </td>

                  {/* IG */}
                  <td style={TD}>
                    <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                      {stint._igStart ? formatTime(stint._igStart) : '—'}
                    </span>
                  </td>

                  {/* Phase */}
                  <td style={{ ...TD, textAlign: 'center', fontSize: '0.8rem' }}>
                    {stint._phase || '—'}
                  </td>

                  {/* Rain */}
                  <td style={{ ...TD, textAlign: 'center' }}>
                    <input type="checkbox" checked={!!stint.rain}
                      onChange={e => updateStint(stint.id, 'rain', e.target.checked)}
                      style={{ accentColor: '#4a9fd4', cursor: 'pointer' }} />
                  </td>

                  {/* Tyre change */}
                  <td style={{ ...TD, textAlign: 'center' }}>
                    <input type="checkbox" checked={!!stint.tyre_change}
                      onChange={e => updateStint(stint.id, 'tyre_change', e.target.checked)}
                      style={{ accentColor: 'var(--accent)', cursor: 'pointer' }} />
                  </td>

                  {/* Availability dots */}
                  {assignedDrivers.map(d => {
                    const driverId   = d.drivers?.id
                    const status     = checkAvailability(availabilities, driverId, stint._irlStart, stint._irlEnd)
                    const isAssigned = stint.driver_id === driverId
                    const color = status === 'available'   ? '#2eb460'
                                : status === 'partial'     ? '#c9a84c'
                                : status === 'unavailable' ? '#e05555'
                                : status === 'tentative'   ? '#4a4a6a'
                                : '#3a3a5a'
                    return (
                      <td key={driverId} style={{ ...TD, textAlign: 'center', padding: '0.35rem 0.2rem' }}>
                        <div style={{
                          width: '9px', height: '9px', borderRadius: '50%',
                          background: color, margin: '0 auto',
                          outline: isAssigned ? '2px solid var(--accent)' : 'none',
                          outlineOffset: '2px',
                        }} title={`${d.drivers?.name} — ${status || 'non renseigné'}${isAssigned ? ' (assigné)' : ''}`} />
                      </td>
                    )
                  })}

                  {/* Delete */}
                  <td style={{ ...TD, textAlign: 'center' }}>
                    <button onClick={() => deleteStint(stint.id)}
                      className="btn btn-danger btn-sm" style={{ padding: '0.15rem 0.4rem' }}>
                      ×
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={addStint} className="btn btn-secondary">+ Ajouter un relais</button>
        {stints.length > 0 && (
          <button onClick={clearAllStints} className="btn btn-danger btn-sm">Tout supprimer</button>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', fontSize: '0.72rem', color: 'var(--text-dim)', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, color: 'var(--text)' }}>Dispo :</span>
        {[
          { color: '#2eb460', label: 'Disponible' },
          { color: '#c9a84c', label: 'Partielle' },
          { color: '#e05555', label: 'Indisponible' },
          { color: '#4a4a6a', label: 'Incertain' },
        ].map(({ color, label }) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
            {label}
          </span>
        ))}
        <span style={{ marginLeft: '0.5rem' }}>🛞 = Chgt pneus · 💧 = Pluie</span>
      </div>
      <div style={{ marginTop: '0.35rem', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
        Temps chgt pneus : {teamEntry?.tyre_change_time_seconds || 0}s
        {' — '}Ravitaillement : {teamEntry?.refuel_time_seconds || 0}s
        {' (configurables dans Modifier l\'équipage)'}
      </div>
    </div>
  )
}