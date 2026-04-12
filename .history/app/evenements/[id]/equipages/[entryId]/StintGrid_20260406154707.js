'use client'
import { useState, useEffect, useCallback } from 'react'
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

// Check driver availability during a time window
// Returns 'available' | 'partial' | 'unavailable' | null
function checkAvailability(availabilities, driverId, irlStart, irlEnd) {
  if (!irlStart || !irlEnd || !driverId) return null
  const start = new Date(irlStart).getTime()
  const end   = new Date(irlEnd).getTime()

  const allSlots = Object.values(availabilities).filter(a => a.driver_id === driverId)
  const windowSlots = allSlots.filter(a => {
    const t = new Date(a.slot_start).getTime()
    return t >= start && t < end
  })
  if (windowSlots.length === 0) return null
  const availableCount = windowSlots.filter(a => a.available).length
  if (availableCount === 0) return 'unavailable'
  if (availableCount === windowSlots.length) return 'available'
  return 'partial'
}

// ── Calculation engine ─────────────────────────────────────

function calculateStints(stints, teamEntry, driverPerf, igStartTime, igSunrise, igSunset) {
  const raceStart  = teamEntry?.event_start_times?.irl_start
  const pitLane    = teamEntry?.events?.circuits?.pit_lane_time_seconds || 0
  const refuel     = teamEntry?.refuel_time_seconds || 0
  const tyreChange = teamEntry?.tyre_change_time_seconds || 0
  const tankSize   = teamEntry?.cars?.tank_size_litres

  let currentTime = raceStart ? new Date(raceStart) : null

  return stints.map(stint => {
    const perf = driverPerf[stint.driver_id]

    // Use best available lap time: prefer condition-appropriate, fall back to other
    const lapTimeSec = stint.rain
      ? (perf?.lap_time_wet || perf?.lap_time_dry || null)
      : (perf?.lap_time_dry || perf?.lap_time_wet || null)

    const fuelPerLap = stint.rain
      ? (perf?.fuel_wet || perf?.fuel_dry || null)
      : (perf?.fuel_dry || perf?.fuel_wet || null)

    // Laps: manual override first, then calculate from tank/fuel
    const maxLaps = (fuelPerLap && tankSize)
      ? Math.floor(tankSize / fuelPerLap)
      : null
    const laps = stint.laps_planned || maxLaps || null

    // Duration: laps × lap time, or manual minutes
    const stintDurationSec = (laps && lapTimeSec)
      ? Math.round(laps * lapTimeSec)
      : (stint.duration_minutes ? stint.duration_minutes * 60 : null)

    const fuelUsed = (laps && fuelPerLap) ? laps * fuelPerLap : null
    const pitStopSec = pitLane + refuel + (stint.tyre_change ? tyreChange : 0)

    const irlStart = currentTime ? new Date(currentTime) : null
    const irlEnd   = (irlStart && stintDurationSec)
      ? new Date(irlStart.getTime() + stintDurationSec * 1000)
      : null

    if (irlEnd) {
      currentTime = new Date(irlEnd.getTime() + pitStopSec * 1000)
    } else if (irlStart) {
      // no duration known — can't advance time
      currentTime = null
    }

    const igStart = getIGTime(irlStart, raceStart, igStartTime)
    const phase   = getPhase(igStart, igSunrise, igSunset)

    return {
      ...stint,
      _irlStart:         irlStart,
      _irlEnd:           irlEnd,
      _igStart:          igStart,
      _phase:            phase,
      _laps:             laps,
      _lapTimeSec:       lapTimeSec,
      _fuelUsed:         fuelUsed,
      _pitStopSec:       pitStopSec,
      _stintDurationSec: stintDurationSec,
      _hasPerfData:      !!lapTimeSec,
    }
  })
}

// ── Auto-generate stints ───────────────────────────────────

function generateInitialStints(teamEntry, driverPerf, assignedDrivers) {
  const durationMinutes = teamEntry?.events?.duration_minutes
  const tankSize        = teamEntry?.cars?.tank_size_litres
  if (!durationMinutes) return 1

  const driverIds = assignedDrivers.map(d => d.drivers?.id).filter(Boolean)

  // Find average lap time and fuel across drivers with data
  const perfs = driverIds.map(id => driverPerf[id]).filter(p => p?.lap_time_dry && p?.fuel_dry)
  if (perfs.length === 0) return Math.ceil(durationMinutes / 60) // ~1 stint per hour fallback

  const avgLapSec  = perfs.reduce((s, p) => s + p.lap_time_dry, 0) / perfs.length
  const avgFuel    = perfs.reduce((s, p) => s + p.fuel_dry,     0) / perfs.length
  const lapsPerStint = tankSize ? Math.floor(tankSize / avgFuel) : null
  const stintDurationMin = lapsPerStint ? (lapsPerStint * avgLapSec) / 60 : 60

  return Math.max(1, Math.ceil(durationMinutes / stintDurationMin))
}

// ── Main component ─────────────────────────────────────────

export default function StintGrid({ teamEntryId, teamEntry, assignedDrivers }) {
  const [stints, setStints]           = useState([])
  const [driverPerf, setDriverPerf]   = useState({})
  const [availabilities, setAvailabilities] = useState({})
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(null)

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
      setStints(stintsData || [])
      const perfMap = {}
      ;(perfData || []).forEach(p => { perfMap[p.driver_id] = p })
      setDriverPerf(perfMap)
      const availMap = {}
      ;(availData || []).forEach(a => {
        const key = `${a.driver_id}_${new Date(a.slot_start).toISOString()}`
        availMap[key] = a
      })
      setAvailabilities(availMap)
      setLoading(false)
    })
  }, [teamEntryId])

  const calculated = calculateStints(stints, teamEntry, driverPerf, igStartTime, igSunrise, igSunset)

  // Available drivers for a given stint window
  const getAvailableDrivers = (irlStart, irlEnd) => {
    return assignedDrivers.filter(d => {
      const driverId = d.drivers?.id
      const status = checkAvailability(availabilities, driverId, irlStart, irlEnd)
      return status === 'available' || status === 'partial' || status === null
    })
  }

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

  const autoGenerateStints = async () => {
    const count = generateInitialStints(teamEntry, driverPerf, assignedDrivers)
    const rows = Array.from({ length: count }, (_, i) => ({
      team_entry_id: teamEntryId,
      stint_number:  i + 1,
      rain:          false,
      tyre_change:   false,
    }))
    const { data, error } = await supabase.from('stints').insert(rows).select()
    if (!error) setStints(data)
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
    background: 'var(--surface-2)',
    color: 'var(--text-dim)',
    fontSize: '0.68rem',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    padding: '0.5rem 0.6rem',
    borderBottom: '2px solid var(--border)',
    whiteSpace: 'nowrap',
    textAlign: 'left',
  }

  const TD = {
    padding: '0.4rem 0.5rem',
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'middle',
    fontSize: '0.85rem',
  }

  const INPUT = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '3px',
    color: 'var(--text)',
    fontFamily: 'var(--font-mono), monospace',
    fontSize: '0.82rem',
    padding: '0.3rem 0.5rem',
    width: '100%',
  }

  if (!teamEntry?.event_start_times?.irl_start) return (
    <div className="card">
      <div className="empty">Aucun horaire de départ configuré pour cet équipage.</div>
    </div>
  )

  if (assignedDrivers.length === 0) return (
    <div className="card">
      <div className="empty">Aucun pilote assigné — assignez des pilotes d&apos;abord.</div>
    </div>
  )

  if (loading) return (
    <div className="card"><div className="empty">Chargement…</div></div>
  )

  // Race end time
  const raceEndTime = teamEntry?.event_start_times?.irl_start && event?.duration_minutes
    ? new Date(new Date(teamEntry.event_start_times.irl_start).getTime() + event.duration_minutes * 60 * 1000)
    : null

  // Projected finish
  const lastCalc = calculated[calculated.length - 1]
  const projectedFinish = lastCalc?._irlEnd

  return (
    <div>
      {/* Summary bar */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {[
          { label: 'Départ', value: formatDatetime(teamEntry.event_start_times?.irl_start) },
          { label: 'Fin course', value: raceEndTime ? formatDatetime(raceEndTime) : '—' },
          { label: 'Relais', value: stints.length },
          { label: 'Fin prévue', value: projectedFinish ? formatDatetime(projectedFinish) : '—',
            highlight: raceEndTime && projectedFinish
              ? projectedFinish > raceEndTime ? 'var(--danger)' : 'var(--success)'
              : null },
        ].map(({ label, value, highlight }) => (
          <div key={label} style={{
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: '4px', padding: '0.6rem 1rem', flex: '1', minWidth: '130px',
          }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.2rem' }}>
              {label}
            </div>
            <div className="mono" style={{ fontSize: '0.88rem', color: highlight || 'var(--text)' }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Grid */}
      {stints.length > 0 ? (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '4px', marginBottom: '1rem' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: `${720 + assignedDrivers.length * 28}px` }}>
            <thead>
              <tr>
                <th style={{ ...TH, width: '32px' }}>#</th>
                <th style={{ ...TH, minWidth: '130px' }}>Pilote</th>
                <th style={TH}>Départ IRL</th>
                <th style={TH}>Fin IRL</th>
                <th style={{ ...TH, minWidth: '70px' }}>Durée</th>
                <th style={{ ...TH, width: '56px' }}>Tours</th>
                <th style={TH}>Conso</th>
                <th style={TH}>IG</th>
                <th style={{ ...TH, width: '28px' }}>⏱</th>
                <th style={{ ...TH, width: '28px' }} title="Pluie">💧</th>
                <th style={{ ...TH, width: '28px' }} title="Changement de pneus">🛞</th>
                {assignedDrivers.map(d => (
                  <th key={d.drivers?.id} style={{ ...TH, width: '28px', textAlign: 'center', fontSize: '0.6rem' }}
                    title={d.drivers?.name}>
                    {d.drivers?.name?.split(' ')[0]?.slice(0, 3)}
                  </th>
                ))}
                <th style={{ ...TH, width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {calculated.map((stint, i) => {
                const isSaving = saving === stint.id
                const availDrivers = getAvailableDrivers(stint._irlStart, stint._irlEnd)
                const availDriverIds = new Set(availDrivers.map(d => d.drivers?.id))

                return (
                  <tr key={stint.id} style={{
                    background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                    opacity: isSaving ? 0.6 : 1,
                  }}>
                    {/* # */}
                    <td style={{ ...TD, textAlign: 'center' }}>
                      <span className="mono" style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>
                        {stint.stint_number}
                      </span>
                    </td>

                    {/* Driver — filtered to available */}
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
                          return (
                            <option
                              key={driverId}
                              value={driverId}
                              disabled={isUnavailable}
                              style={{ color: isUnavailable ? 'var(--danger)' : 'inherit' }}
                            >
                              {d.drivers?.name}{isUnavailable ? ' ✗' : status === 'partial' ? ' ◑' : ''}
                            </option>
                          )
                        })}
                      </select>
                    </td>

                    {/* IRL Start */}
                    <td style={TD}>
                      <span className="mono" style={{ fontSize: '0.78rem' }}>
                        {stint._irlStart ? formatDatetime(stint._irlStart) : '—'}
                      </span>
                    </td>

                    {/* IRL End */}
                    <td style={TD}>
                      <span className="mono" style={{ fontSize: '0.78rem' }}>
                        {stint._irlEnd ? formatDatetime(stint._irlEnd) : '—'}
                      </span>
                    </td>

                    {/* Duration — manual only when no perf data */}
                    <td style={TD}>
                      {stint._hasPerfData && !stint.laps_planned ? (
                        <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--text)' }}>
                          {stint._stintDurationSec ? formatDuration(stint._stintDurationSec) : '—'}
                        </span>
                      ) : (
                        <input
                          type="number"
                          placeholder="min"
                          value={stint.duration_minutes || ''}
                          onFocus={e => e.target.select()}
                          onChange={e => {
                            const val = e.target.value === '' ? null : parseInt(e.target.value)
                            updateStint(stint.id, 'duration_minutes', val)
                          }}
                          style={{ ...INPUT, width: '56px' }}
                          title="Durée manuelle en minutes"
                        />
                      )}
                    </td>

                    {/* Laps */}
                    <td style={TD}>
                      <input
                        type="number"
                        value={stint.laps_planned || ''}
                        placeholder={stint._laps ? String(stint._laps) : '—'}
                        onFocus={e => e.target.select()}
                        onChange={e => {
                          const val = e.target.value === '' ? null : parseInt(e.target.value)
                          updateStint(stint.id, 'laps_planned', val)
                        }}
                        style={{ ...INPUT, width: '48px' }}
                        title={stint._laps ? `Calculé : ${stint._laps} tours` : 'Tours manuels'}
                      />
                    </td>

                    {/* Fuel */}
                    <td style={TD}>
                      <span className="mono" style={{ fontSize: '0.75rem', color: stint._fuelUsed ? 'var(--accent)' : 'var(--text-dim)' }}>
                        {stint._fuelUsed ? `${stint._fuelUsed.toFixed(1)}L` : '—'}
                      </span>
                    </td>

                    {/* IG */}
                    <td style={TD}>
                      <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                        {stint._igStart ? formatTime(stint._igStart) : '—'}
                      </span>
                    </td>

                    {/* Phase */}
                    <td style={{ ...TD, textAlign: 'center', fontSize: '0.82rem' }}>
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
                      const driverId = d.drivers?.id
                      const status   = checkAvailability(availabilities, driverId, stint._irlStart, stint._irlEnd)
                      const isAssigned = stint.driver_id === driverId
                      const color = status === 'available'   ? '#2eb460'
                                  : status === 'partial'     ? '#c9a84c'
                                  : status === 'unavailable' ? '#e05555'
                                  : '#3a3a5a'
                      return (
                        <td key={driverId} style={{ ...TD, textAlign: 'center', padding: '0.4rem 0.2rem' }}>
                          <div style={{
                            width: '10px', height: '10px', borderRadius: '50%',
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
                        className="btn btn-danger btn-sm" style={{ padding: '0.2rem 0.5rem' }}>
                        ×
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="empty">
            Aucun relais planifié.
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button onClick={addStint} className="btn btn-secondary">
          + Ajouter un relais
        </button>
        {stints.length === 0 && (
          <button onClick={autoGenerateStints} className="btn btn-primary">
            ⚡ Générer automatiquement
          </button>
        )}
        {stints.length > 0 && (
          <button onClick={clearAllStints} className="btn btn-danger btn-sm">
            Tout supprimer
          </button>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-dim)', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, color: 'var(--text)' }}>Dispo :</span>
        {[
          { color: '#2eb460', label: 'Disponible' },
          { color: '#c9a84c', label: 'Partielle' },
          { color: '#e05555', label: 'Indisponible' },
          { color: '#3a3a5a', label: 'Non renseigné' },
        ].map(({ color, label }) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
            {label}
          </span>
        ))}
        <span>🛞 = Changement pneus · 💧 = Pluie</span>
      </div>

      {/* Tyre change note */}
      <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
        Temps changement pneus : {teamEntry?.tyre_change_time_seconds || 0}s
        {' '}(configurable dans les paramètres de l&apos;équipage)
      </div>
    </div>
  )
}