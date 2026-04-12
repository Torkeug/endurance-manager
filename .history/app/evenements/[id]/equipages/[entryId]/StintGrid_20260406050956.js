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
  const s = Math.round(seconds % 60)
  if (h > 0) return `${h}h${String(m).padStart(2,'0')}`
  return `${m}m${String(s).padStart(2,'0')}`
}

function secToLapDisplay(sec) {
  if (!sec) return ''
  const m = Math.floor(sec / 60)
  const s = (sec % 60).toFixed(3).padStart(6, '0')
  return `${m}:${s}`
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

// Check if a driver is available during a time window
function isDriverAvailable(availabilities, driverId, irlStart, irlEnd) {
  if (!irlStart || !irlEnd || !driverId) return null
  const start = new Date(irlStart)
  const end   = new Date(irlEnd)
  const slots  = Object.values(availabilities).filter(a =>
    a.driver_id === driverId &&
    a.available === true &&
    new Date(a.slot_start) >= start &&
    new Date(a.slot_start) < end
  )
  const totalSlots = Math.max(1, Math.ceil((end - start) / (30 * 60 * 1000)))
  if (slots.length === 0) return 'unavailable'
  if (slots.length >= totalSlots) return 'available'
  return 'partial'
}

// ── Calculation engine ─────────────────────────────────────

function calculateStints(stints, teamEntry, driverPerf, igStartTime, igSunrise, igSunset) {
  const raceStart  = teamEntry.event_start_times?.irl_start
  const pitLane    = teamEntry.events?.circuits?.pit_lane_time_seconds || 0
  const refuel     = teamEntry.refuel_time_seconds || 0
  const tyreChange = teamEntry.tyre_change_time_seconds || 0
  const tankSize   = teamEntry.cars?.tank_size_litres

  let currentTime = raceStart ? new Date(raceStart) : null

  return stints.map((stint, i) => {
    const perf = driverPerf[stint.driver_id]
    const lapTimeSec = stint.rain
      ? (perf?.lap_time_wet || perf?.lap_time_dry || null)
      : (perf?.lap_time_dry || null)
    const fuelPerLap = stint.rain
      ? (perf?.fuel_wet || perf?.fuel_dry || null)
      : (perf?.fuel_dry || null)

    // Laps: use override, or calculate from tank/fuel, or null
    const maxLaps = (fuelPerLap && tankSize)
      ? Math.floor(tankSize / fuelPerLap)
      : null
    const laps = stint.laps_planned || maxLaps || null

    // Duration in seconds
    const stintDurationSec = (laps && lapTimeSec)
      ? laps * lapTimeSec
      : stint.duration_minutes ? stint.duration_minutes * 60 : null

    // Fuel used
    const fuelUsed = (laps && fuelPerLap) ? laps * fuelPerLap : null

    // Pit stop time
    const pitStopSec = pitLane + refuel + (stint.tyre_change ? tyreChange : 0)

    // IRL times
    const irlStart = currentTime ? new Date(currentTime) : null
    const irlEnd   = (irlStart && stintDurationSec)
      ? new Date(irlStart.getTime() + stintDurationSec * 1000)
      : null

    // Advance time for next stint
    if (irlEnd) {
      currentTime = new Date(irlEnd.getTime() + pitStopSec * 1000)
    } else if (irlStart && pitStopSec) {
      currentTime = new Date(irlStart.getTime() + pitStopSec * 1000)
    }

    // IG times
    const igStart = getIGTime(irlStart, raceStart, igStartTime)
    const phase   = getPhase(igStart, igSunrise, igSunset)

    return {
      ...stint,
      _irlStart:        irlStart,
      _irlEnd:          irlEnd,
      _igStart:         igStart,
      _phase:           phase,
      _laps:            laps,
      _lapTimeSec:      lapTimeSec,
      _fuelUsed:        fuelUsed,
      _pitStopSec:      pitStopSec,
      _stintDurationSec: stintDurationSec,
    }
  })
}

// ── Main component ─────────────────────────────────────────

export default function StintGrid({
  teamEntryId,
  teamEntry,
  assignedDrivers,
}) {
  const [stints, setStints]       = useState([])
  const [driverPerf, setDriverPerf] = useState({})
  const [availabilities, setAvailabilities] = useState({})
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(null)

  const event      = teamEntry?.events
  const igStartTime = event?.ig_start_time
  const igSunrise   = event?.ig_sunrise
  const igSunset    = event?.ig_sunset

  // Load stints, perf data, availabilities
  useEffect(() => {
    if (!teamEntryId) return
    Promise.all([
      supabase.from('stints')
        .select('*').eq('team_entry_id', teamEntryId).order('stint_number'),
      supabase.from('driver_performance')
        .select('*').eq('team_entry_id', teamEntryId),
      supabase.from('availabilities')
        .select('*').eq('team_entry_id', teamEntryId),
    ]).then(([{ data: stintsData }, { data: perfData }, { data: availData }]) => {
      setStints(stintsData || [])
      const perfMap = {}
      ;(perfData || []).forEach(p => { perfMap[p.driver_id] = p })
      setDriverPerf(perfMap)
      const availMap = {}
      ;(availData || []).forEach(a => { availMap[`${a.driver_id}_${a.slot_start}`] = a })
      setAvailabilities(availMap)
      setLoading(false)
    })
  }, [teamEntryId])

  const calculated = calculateStints(stints, teamEntry, driverPerf, igStartTime, igSunrise, igSunset)

  // ── CRUD ──────────────────────────────────────────────────

  const addStint = async () => {
    const nextNum = stints.length > 0
      ? Math.max(...stints.map(s => s.stint_number)) + 1
      : 1

    const { data, error } = await supabase.from('stints')
      .insert([{
        team_entry_id: teamEntryId,
        stint_number:  nextNum,
        rain:          false,
        tyre_change:   false,
      }])
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
    padding: '0.4rem 0.6rem',
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

  // ── Render ────────────────────────────────────────────────

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

  return (
    <div>
      {/* Race summary */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {[
          { label: 'Départ IRL', value: formatDatetime(teamEntry.event_start_times?.irl_start) },
          { label: 'Durée course', value: event?.duration_minutes ? `${Math.floor(event.duration_minutes/60)}h${String(event.duration_minutes%60).padStart(2,'0')}` : '—' },
          { label: 'Relais planifiés', value: stints.length },
          { label: 'Fin prévue', value: calculated.length > 0 ? formatDatetime(calculated[calculated.length-1]._irlEnd) : '—' },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: '4px', padding: '0.6rem 1rem', flex: '1', minWidth: '140px' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.2rem' }}>
              {label}
            </div>
            <div className="mono" style={{ fontSize: '0.9rem', color: 'var(--text)' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '4px', marginBottom: '1rem' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '800px' }}>
          <thead>
            <tr>
              <th style={{ ...TH, width: '36px' }}>#</th>
              <th style={{ ...TH, minWidth: '140px' }}>Pilote</th>
              <th style={TH}>Départ IRL</th>
              <th style={TH}>Fin IRL</th>
              <th style={TH}>Durée</th>
              <th style={TH}>Tours</th>
              <th style={TH}>Conso</th>
              <th style={TH}>IG</th>
              <th style={TH}>⏱</th>
              <th style={{ ...TH, width: '36px' }}>💧</th>
              <th style={{ ...TH, width: '36px' }}>🔄</th>
              {assignedDrivers.map(d => (
                <th key={d.drivers?.id} style={{ ...TH, width: '32px', textAlign: 'center', fontSize: '0.62rem' }}>
                  {d.drivers?.name?.split(' ')[0]?.slice(0, 4)}
                </th>
              ))}
              <th style={{ ...TH, width: '60px' }}></th>
            </tr>
          </thead>
          <tbody>
            {calculated.length === 0 && (
              <tr>
                <td colSpan={12 + assignedDrivers.length} style={{ ...TD, textAlign: 'center', color: 'var(--text-dim)', padding: '2rem' }}>
                  Aucun relais — cliquez sur &quot;+ Ajouter un relais&quot; pour commencer.
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
                    <span className="mono" style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>
                      {stint.stint_number}
                    </span>
                  </td>

                  {/* Driver */}
                  <td style={TD}>
                    <select
                      value={stint.driver_id || ''}
                      onChange={e => updateStint(stint.id, 'driver_id', e.target.value || null)}
                      style={{ ...INPUT, minWidth: '130px' }}
                    >
                      <option value="">— À définir —</option>
                      {assignedDrivers.map(d => (
                        <option key={d.drivers?.id} value={d.drivers?.id}>
                          {d.drivers?.name}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* IRL Start */}
                  <td style={TD}>
                    <span className="mono" style={{ fontSize: '0.8rem', color: 'var(--text)' }}>
                      {stint._irlStart ? formatDatetime(stint._irlStart) : '—'}
                    </span>
                  </td>

                  {/* IRL End */}
                  <td style={TD}>
                    <span className="mono" style={{ fontSize: '0.8rem', color: 'var(--text)' }}>
                      {stint._irlEnd ? formatDatetime(stint._irlEnd) : '—'}
                    </span>
                  </td>

                  {/* Duration */}
                  <td style={TD}>
                    <span className="mono" style={{ fontSize: '0.8rem', color: stint._stintDurationSec ? 'var(--text)' : 'var(--text-dim)' }}>
                      {stint._stintDurationSec ? formatDuration(stint._stintDurationSec) : (
                        <input
                          type="number"
                          placeholder="min"
                          value={stint.duration_minutes || ''}
                          onChange={e => updateStint(stint.id, 'duration_minutes', e.target.value ? parseInt(e.target.value) : null)}
                          style={{ ...INPUT, width: '60px' }}
                          title="Durée manuelle en minutes (si pas de données de performance)"
                        />
                      )}
                    </span>
                  </td>

                  {/* Laps */}
                  <td style={TD}>
                    <input
                      type="number"
                      value={stint.laps_planned || stint._laps || ''}
                      onChange={e => updateStint(stint.id, 'laps_planned', e.target.value ? parseInt(e.target.value) : null)}
                      style={{ ...INPUT, width: '52px' }}
                      placeholder={stint._laps ? String(stint._laps) : '—'}
                      title={stint._laps ? `Calculé : ${stint._laps} tours` : 'Saisissez le nombre de tours'}
                    />
                  </td>

                  {/* Fuel */}
                  <td style={TD}>
                    <span className="mono" style={{ fontSize: '0.78rem', color: stint._fuelUsed ? 'var(--accent)' : 'var(--text-dim)' }}>
                      {stint._fuelUsed ? `${stint._fuelUsed.toFixed(1)}L` : '—'}
                    </span>
                  </td>

                  {/* IG Start */}
                  <td style={TD}>
                    <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                      {stint._igStart ? formatTime(stint._igStart) : '—'}
                    </span>
                  </td>

                  {/* Phase */}
                  <td style={{ ...TD, textAlign: 'center', fontSize: '0.85rem' }}>
                    {stint._phase || '—'}
                  </td>

                  {/* Rain */}
                  <td style={{ ...TD, textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={!!stint.rain}
                      onChange={e => updateStint(stint.id, 'rain', e.target.checked)}
                      style={{ accentColor: '#4a9fd4', cursor: 'pointer' }}
                    />
                  </td>

                  {/* Tyre change */}
                  <td style={{ ...TD, textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={!!stint.tyre_change}
                      onChange={e => updateStint(stint.id, 'tyre_change', e.target.checked)}
                      style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
                    />
                  </td>

                  {/* Availability dots */}
                  {assignedDrivers.map(d => {
                    const driverId = d.drivers?.id
                    const avail = isDriverAvailable(availabilities, driverId, stint._irlStart, stint._irlEnd)
                    const isAssigned = stint.driver_id === driverId
                    const color = avail === 'available' ? '#2eb460'
                      : avail === 'partial' ? '#c9a84c'
                      : avail === 'unavailable' ? '#e05555'
                      : '#3a3a5a'

                    return (
                      <td key={driverId} style={{ ...TD, textAlign: 'center', padding: '0.4rem 0.2rem' }}>
                        <div style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          background: color,
                          margin: '0 auto',
                          outline: isAssigned ? '2px solid var(--accent)' : 'none',
                          outlineOffset: '2px',
                        }}
                          title={`${d.drivers?.name} — ${avail || 'non renseigné'}${isAssigned ? ' (assigné)' : ''}`}
                        />
                      </td>
                    )
                  })}

                  {/* Delete */}
                  <td style={{ ...TD, textAlign: 'center' }}>
                    <button
                      onClick={() => deleteStint(stint.id)}
                      className="btn btn-danger btn-sm"
                      style={{ padding: '0.2rem 0.5rem' }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Add stint button */}
      <button onClick={addStint} className="btn btn-secondary">
        + Ajouter un relais
      </button>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1.25rem', marginTop: '1rem', fontSize: '0.78rem', color: 'var(--text-dim)', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, color: 'var(--text)' }}>Disponibilité :</span>
        {[
          { color: '#2eb460', label: 'Disponible' },
          { color: '#c9a84c', label: 'Partielle' },
          { color: '#e05555', label: 'Indisponible' },
          { color: '#3a3a5a', label: 'Non renseigné' },
        ].map(({ color, label }) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }} />
            {label}
          </span>
        ))}
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#3a3a5a', outline: '2px solid var(--accent)', outlineOffset: '2px', display: 'inline-block' }} />
          Pilote assigné au relais
        </span>
      </div>
    </div>
  )
}