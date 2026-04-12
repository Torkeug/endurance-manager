'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import ActualEndInput from './ActualEndInput'

// ─── Display helpers ────────────────────────────────────────────────────────

// Format a Date to HH:MM (local time)
function formatTime(date) {
  if (!date) return '—'
  return new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false })
}

// Format a Date to DD/MM HH:MM
function formatDatetime(date) {
  if (!date) return '—'
  return new Date(date).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

// Format seconds to "Xh YYmin" or "Y min"
function formatDuration(seconds) {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${String(m).padStart(2,'0')}min`
  return `${m} min`
}

// ─── In-game time calculation ───────────────────────────────────────────────

// Convert an IRL timestamp to its in-game equivalent.
// The IG clock starts at igStartTimeStr when IRL is irlStartStr.
function getIGTime(irlTime, irlStartStr, igStartTimeStr) {
  if (!igStartTimeStr || !irlStartStr || !irlTime) return null
  const [igH, igM] = igStartTimeStr.split(':').map(Number)
  const irlStart = new Date(irlStartStr)
  const igStart  = new Date(irlStart)
  igStart.setHours(igH, igM, 0, 0)
  return new Date(igStart.getTime() + (new Date(irlTime) - irlStart))
}

// Determine day/night phase icon from IG time vs sunrise/sunset strings (HH:MM)
function getPhase(igTime, sunriseStr, sunsetStr) {
  if (!igTime || !sunriseStr || !sunsetStr) return null
  const minutes = new Date(igTime).getHours() * 60 + new Date(igTime).getMinutes()
  const [srH, srM] = sunriseStr.split(':').map(Number)
  const [ssH, ssM] = sunsetStr.split(':').map(Number)
  const sunrise = srH * 60 + srM
  const sunset  = ssH * 60 + ssM
  // Normal day/night (sunrise before sunset)
  if (sunrise < sunset) {
    if (minutes >= sunrise + 30 && minutes < sunset - 30) return '☀️'
    if (minutes >= sunset + 30 || minutes < sunrise - 30) return '🌑'
    return '🌗'
  }
  // Inverted (sunrise after sunset — overnight race)
  if (minutes >= sunrise + 30 || minutes < sunset - 30) return '☀️'
  if (minutes >= sunset + 30 && minutes < sunrise - 30) return '🌑'
  return '🌗'
}

// ─── Availability check ─────────────────────────────────────────────────────

// Check a driver's availability for a stint window.
// Returns: 'available' | 'partial' | 'unavailable' | 'tentative' | null
function checkAvailability(availabilities, driverId, irlStart, irlEnd) {
  if (!irlStart || !irlEnd || !driverId) return null
  const start = new Date(irlStart).getTime()
  const end   = new Date(irlEnd).getTime()

  // Find all 30-min availability slots that overlap the stint window
  const windowSlots = Object.values(availabilities).filter(a => {
    if (a.driver_id !== driverId) return false
    const t = new Date(a.slot_start).getTime()
    return t < end && (t + 30 * 60 * 1000) > start
  })

  if (windowSlots.length === 0) return 'unavailable'
  const availableCount   = windowSlots.filter(a => a.available === true).length
  const unavailableCount = windowSlots.filter(a => a.available === false).length
  const tentativeCount   = windowSlots.filter(a => a.available === null).length

  if (availableCount === windowSlots.length) return 'available'
  if (unavailableCount > 0 && availableCount === 0 && tentativeCount === 0) return 'unavailable'
  if (availableCount > 0) return 'partial'
  if (tentativeCount > 0 && availableCount === 0 && unavailableCount === 0) return 'tentative'
  return 'partial'
}

// ─── Stint calculation engine ───────────────────────────────────────────────

// Calculate all derived fields for a single stint given the IRL start time.
// Returns the stint object enriched with _ prefixed computed fields.
function calcStint(stint, teamEntry, driverPerf, igStartTime, igSunrise, igSunset, irlStart) {
  const pitLane    = teamEntry?.events?.circuits?.pit_lane_time_seconds || 0
  const refuel     = teamEntry?.refuel_time_seconds || 0
  const tyreChange = teamEntry?.tyre_change_time_seconds || 0

  // Apply BoP tank size percentage if set, otherwise use car default
  const carTankSize = teamEntry?.cars?.tank_size_litres
  const tankSize = teamEntry?.bop_tank_size_percent
    ? carTankSize * (teamEntry.bop_tank_size_percent / 100)
    : carTankSize

  const raceStart = teamEntry?.event_start_times?.irl_start

  // Use wet or dry performance data depending on rain flag
  const perf = driverPerf[stint.driver_id]
  const lapTimeSec = stint.rain
    ? (perf?.lap_time_wet || perf?.lap_time_dry || null)
    : (perf?.lap_time_dry || perf?.lap_time_wet || null)
  const fuelPerLap = stint.rain
    ? (perf?.fuel_wet || perf?.fuel_dry || null)
    : (perf?.fuel_dry || perf?.fuel_wet || null)

  // Laps: manual override > calculated from fuel+tank > estimated from 1h
  const calcLaps = (fuelPerLap && tankSize) ? Math.max(1, Math.floor(tankSize / fuelPerLap)) : null
  const laps = stint.laps_planned || calcLaps || (lapTimeSec ? Math.floor(3600 / lapTimeSec) : null)

  // Stint duration: laps x lap time > manual minutes > default 3600s
  const stintDurationSec = (laps && lapTimeSec)
    ? Math.round(laps * lapTimeSec)
    : (stint.duration_minutes ? stint.duration_minutes * 60 : 3600)

  // Flags for rendering decisions
  const _durationFromPerf  = !!(lapTimeSec && (stint.laps_planned || calcLaps))
  const _durationIsDefault = !laps && !lapTimeSec && !stint.duration_minutes

  const fuelUsed   = (laps && fuelPerLap) ? laps * fuelPerLap : null
  const pitStopSec = pitLane + refuel + (stint.tyre_change ? tyreChange : 0)

  const stintIrlStart = irlStart
  const stintIrlEnd   = (stintIrlStart && stintDurationSec)
    ? new Date(stintIrlStart.getTime() + stintDurationSec * 1000)
    : null

  // Next stint starts after pit stop
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
    _durationFromPerf,
    _durationIsDefault,
  }
}

// Chain-calculate all stints in order.
// Each stint's start = previous stint's end + pit stop time.
// Marks the last stint that covers race end with _isLastStint,
// _adjustedDurationSec and _adjustedIrlEnd (= race end time).
function calculateAllStints(stints, teamEntry, driverPerf, igStartTime, igSunrise, igSunset) {
  const raceStart = teamEntry?.event_start_times?.irl_start
  const raceEnd = raceStart && teamEntry?.events?.duration_minutes
    ? new Date(new Date(raceStart).getTime() + teamEntry.events.duration_minutes * 60 * 1000)
    : null

  let currentTime = raceStart ? new Date(raceStart) : null
  const result = []

  for (const stint of stints) {
    const calc = calcStint(stint, teamEntry, driverPerf, igStartTime, igSunrise, igSunset, currentTime)
    result.push(calc)

    // Use actual end time if set (live race), otherwise planned end
    const effectiveEnd = calc.irl_end_actual
      ? new Date(calc.irl_end_actual)
      : calc._irlEnd
    currentTime = effectiveEnd
      ? new Date(effectiveEnd.getTime() + calc._pitStopSec * 1000)
      : null
  }

  // Find the stint that covers race end, mark it with flag and adjusted times
  if (result.length > 0 && raceEnd) {
    const coveringStint = result.find(s => s._irlEnd && s._irlEnd >= raceEnd)
    if (coveringStint) {
      coveringStint._isLastStint = true
      if (coveringStint._irlStart && coveringStint._lapTimeSec) {
        const remainingSecs = (raceEnd - coveringStint._irlStart) / 1000
        // Always store the optimal (minimum to cross finish line) for display hints
        coveringStint._optimalLaps = Math.ceil(remainingSecs / coveringStint._lapTimeSec)
        // If user manually entered laps, respect that — otherwise use optimal
        coveringStint._laps = coveringStint.laps_planned
          ? coveringStint.laps_planned
          : coveringStint._optimalLaps
        // Derive optimal duration and end time for hint display
        coveringStint._optimalDurationSec = coveringStint._optimalLaps * coveringStint._lapTimeSec
        coveringStint._optimalIrlEnd = new Date(coveringStint._irlStart.getTime() + coveringStint._optimalDurationSec * 1000)
        coveringStint._calcLaps = coveringStint._laps
        // Derive real duration and end time from actual lap count
        coveringStint._stintDurationSec = coveringStint._laps * coveringStint._lapTimeSec
        coveringStint._irlEnd = new Date(coveringStint._irlStart.getTime() + coveringStint._stintDurationSec * 1000)
        // _adjustedIrlEnd = real crossing time (≥ race end), used for FIN IRL display
        coveringStint._adjustedIrlEnd = coveringStint._irlEnd
        coveringStint._adjustedDurationSec = coveringStint._stintDurationSec
        // Recalculate fuel based on adjusted laps
        const perf = driverPerf[coveringStint.driver_id]
        const fuelPerLap = coveringStint.rain
          ? (perf?.fuel_wet || perf?.fuel_dry)
          : (perf?.fuel_dry || perf?.fuel_wet)
        if (fuelPerLap) coveringStint._fuelUsed = coveringStint._laps * fuelPerLap
      }
    } else {
      // No stint reaches race end — mark last stint, show real end, flag warning
      const lastStint = result[result.length - 1]
      lastStint._isLastStint = true
      lastStint._doesNotCoverRaceEnd = true
      // No _adjustedIrlEnd — FIN IRL shows real calculated end
    }
  }

  return result
}

// ─── Auto-generation ────────────────────────────────────────────────────────

// Estimate how many stints a race needs based on performance data.
// Falls back to 1 stint/hour if no perf data is available.
function estimateStintCount(teamEntry, driverPerf, assignedDrivers) {
  const durationMinutes = teamEntry?.events?.duration_minutes
  const carTankSize     = teamEntry?.cars?.tank_size_litres
  const tankSize        = teamEntry?.bop_tank_size_percent
    ? carTankSize * (teamEntry.bop_tank_size_percent / 100)
    : carTankSize
  if (!durationMinutes) return 1
  const driverIds = assignedDrivers.map(d => d.drivers?.id).filter(Boolean)
  const perfs = driverIds.map(id => driverPerf[id]).filter(p => p?.lap_time_dry && p?.fuel_dry)
  if (perfs.length === 0) return Math.max(1, Math.ceil(durationMinutes / 60))
  const avgLapSec    = perfs.reduce((s, p) => s + p.lap_time_dry, 0) / perfs.length
  const avgFuel      = perfs.reduce((s, p) => s + p.fuel_dry,     0) / perfs.length
  const lapsPerStint = tankSize ? Math.floor(tankSize / avgFuel) : Math.ceil(60 * 60 / avgLapSec)
  const stintDurMin  = Math.round((lapsPerStint * avgLapSec) / 60)
  return Math.max(1, Math.ceil(durationMinutes / stintDurMin))
}

// ─── Cross-event conflict detection ─────────────────────────────────────────

// Check if a calculated stint overlaps with any other stint from other team entries.
// Returns the conflicting stint object, or null if no conflict.
function hasConflict(calc, otherStints) {
  if (!calc._irlStart || !calc._irlEnd) return null
  for (const other of otherStints) {
    if (!other.irl_start || !other.irl_end_planned) continue
    if (calc.driver_id !== other.driver_id) continue
    const aStart = calc._irlStart
    const aEnd   = calc._irlEnd
    const bStart = new Date(other.irl_start)
    const bEnd   = new Date(other.irl_end_planned)
    if (aStart < bEnd && bStart < aEnd) return other
  }
  return null
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function StintGrid({ teamEntryId, teamEntry, assignedDrivers }) {
  const [stints, setStints]               = useState([])
  const [driverPerf, setDriverPerf]       = useState({})
  const [availabilities, setAvailabilities] = useState({})
  const [loading, setLoading]             = useState(true)
  const [saving, setSaving]               = useState(null)
  const [autoGenDone, setAutoGenDone]     = useState(false)
  const [conflictStints, setConflictStints] = useState([])

  const event       = teamEntry?.events
  const igStartTime = event?.ig_start_time
  const igSunrise   = event?.ig_sunrise
  const igSunset    = event?.ig_sunset
  const driverIds   = assignedDrivers.map(d => d.drivers?.id).filter(Boolean)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  // ── Data fetching ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!teamEntryId) return
    Promise.all([
      // Current team entry's stints
      supabase.from('stints').select('*').eq('team_entry_id', teamEntryId).order('stint_number'),
      // Driver performance data for calculations
      supabase.from('driver_performance').select('*').eq('team_entry_id', teamEntryId),
      // Availability slots for the availability dot indicators
      supabase.from('availabilities').select('*').eq('team_entry_id', teamEntryId),
      // Other stints for assigned drivers (cross-event conflict detection)
      driverIds.length > 0
        ? supabase.from('stints')
            .select('*, team_entries(crew_name, events(name))')
            .in('driver_id', driverIds)
            .neq('team_entry_id', teamEntryId)
        : Promise.resolve({ data: [] }),
    ]).then(([{ data: stintsData }, { data: perfData }, { data: availData }, { data: otherStints }]) => {

      // Build driver performance map: driver_id -> perf object
      const perfMap = {}
      ;(perfData || []).forEach(p => { perfMap[p.driver_id] = p })
      setDriverPerf(perfMap)

      // Build availability map: "driverId_slotISO" -> availability object
      const availMap = {}
      ;(availData || []).forEach(a => {
        const key = `${a.driver_id}_${new Date(a.slot_start).toISOString()}`
        availMap[key] = a
      })
      setAvailabilities(availMap)

      const loadedStints = stintsData || []
      setStints(loadedStints)
      setLoading(false)
      setConflictStints(otherStints || [])

      // Auto-generate stints if none exist yet (runs once on first load)
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
  }, [teamEntryId, JSON.stringify(driverIds)])

  // ── Calculations ───────────────────────────────────────────────────────────

  const calculated = calculateAllStints(stints, teamEntry, driverPerf, igStartTime, igSunrise, igSunset)

  // Persist calculated IRL start/end times to DB after each recalculation.
  // Used for conflict detection and pilot engagement page.
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

  // ── CRUD ──────────────────────────────────────────────────────────────────

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

  const updateActualEnd = async (stintId, isoString) => {
    setSaving(stintId)
    setStints(prev => prev.map(s =>
      s.id === stintId ? { ...s, irl_end_actual: isoString } : s
    ))
    await supabase.from('stints').update({ irl_end_actual: isoString }).eq('id', stintId)
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

  // ── Table styles ───────────────────────────────────────────────────────────

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

  // ── Guard conditions ───────────────────────────────────────────────────────

  if (!teamEntry?.event_start_times?.irl_start) return (
    <div className="card"><div className="empty">Aucun horaire de départ configuré.</div></div>
  )
  if (assignedDrivers.length === 0) return (
    <div className="card"><div className="empty">Aucun pilote assigné — assignez des pilotes d&apos;abord.</div></div>
  )
  if (loading) return (
    <div className="card"><div className="empty">Chargement…</div></div>
  )

  // ── Derived display values ─────────────────────────────────────────────────

  const raceEndTime = teamEntry?.event_start_times?.irl_start && event?.duration_minutes
    ? new Date(new Date(teamEntry.event_start_times.irl_start).getTime() + event.duration_minutes * 60 * 1000)
    : null

  const lastCalc       = calculated[calculated.length - 1]
  // Use adjusted end (real crossing time) for last stint, fall back to calculated end
  const projectedFinish = lastCalc?._adjustedIrlEnd || lastCalc?._irlEnd

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>

      {/* ── Summary bar ── */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {[
          { label: 'Départ',     value: formatDatetime(teamEntry.event_start_times?.irl_start) },
          { label: 'Fin course', value: raceEndTime ? formatDatetime(raceEndTime) : '—' },
          { label: 'Relais',     value: stints.length },
          {
            label: 'Fin prévue',
            value: projectedFinish ? formatDatetime(projectedFinish) : '—',
            color: raceEndTime && projectedFinish
              ? (projectedFinish >= raceEndTime ? '#2eb460' : 'var(--danger)') : null,
          },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: '4px', padding: '0.6rem 1rem', flex: 1, minWidth: '120px',
          }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.2rem' }}>
              {label}
            </div>
            <div className="mono" style={{ fontSize: '0.85rem', color: color || 'var(--text)' }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* ── Fair share indicators ── */}
      {assignedDrivers.length > 0 && calculated.length > 0 && (() => {
        const totalLaps    = calculated.reduce((sum, s) => sum + (s._laps || 0), 0)
        const equalShare   = totalLaps / assignedDrivers.length
        const fairShareMin = Math.ceil(equalShare * 0.25) // 25% of equal share

        const lapsByDriver = {}
        assignedDrivers.forEach(d => { if (d.drivers?.id) lapsByDriver[d.drivers.id] = 0 })
        calculated.forEach(s => {
          if (s.driver_id && s._laps) lapsByDriver[s.driver_id] = (lapsByDriver[s.driver_id] || 0) + s._laps
        })

        return (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>
              Fair Share — minimum {fairShareMin} tours ({Math.round(equalShare)} part égale)
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {assignedDrivers.map(d => {
                const driverId = d.drivers?.id
                const laps     = lapsByDriver[driverId] || 0
                const ok       = laps >= fairShareMin
                return (
                  <div key={driverId} style={{
                    background: 'var(--surface-2)', border: '1px solid',
                    borderColor: ok ? '#2eb460' : totalLaps === 0 ? 'var(--border)' : 'var(--danger)',
                    borderRadius: '3px', padding: '0.4rem 0.75rem',
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                  }}>
                    <span>{totalLaps === 0 ? '—' : ok ? '✅' : '❌'}</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{d.drivers?.name || '—'}</span>
                    <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                      {laps} tours
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* ── Stint grid table ── */}
      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '4px', marginBottom: '1rem' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: `${680 + assignedDrivers.length * 26}px` }}>
          <thead>
            <tr>
              <th style={{ ...TH, width: '28px' }}>#</th>
              <th style={{ ...TH, minWidth: '130px' }}>Pilote</th>
              <th style={TH}>Départ IRL</th>
              <th style={TH}>Fin IRL</th>
              <th style={{ ...TH, minWidth: '110px' }}>Fin réelle</th>
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
                <td colSpan={11 + assignedDrivers.length}
                  style={{ ...TD, textAlign: 'center', color: 'var(--text-dim)', padding: '2rem' }}>
                  Aucun relais planifié.
                </td>
              </tr>
            )}
            {calculated.map((stint, i) => {
              const isSaving = saving === stint.id

              // FIN IRL: for the last stint, show the adjusted race end time
              // instead of the full calculated end (which may exceed race end)
              const displayIrlEnd = stint._isLastStint && stint._adjustedIrlEnd
                ? stint._adjustedIrlEnd
                : stint._irlEnd

              return (
                <tr key={stint.id} style={{
                  background: stint._isLastStint
                    ? (stint._doesNotCoverRaceEnd ? 'rgba(224,85,85,0.15)' : 'rgba(46,180,96,0.12)')
                    : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                  opacity: isSaving ? 0.6 : 1,
                  // Green left border marks the last stint covering race end, Red if not
                  borderLeft: stint._isLastStint
                    ? (stint._doesNotCoverRaceEnd ? '3px solid var(--danger)' : '3px solid #2eb460')
                    : '3px solid transparent',
                }}>

                  {/* Stint number + conflict warning icon */}
                  <td style={{ ...TD, textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                      <span className="mono" style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>
                        {stint.stint_number}
                      </span>
                      {(() => {
                        const conflict = hasConflict(stint, conflictStints)
                        if (!conflict) return null
                        return (
                          <span style={{ fontSize: '0.75rem', cursor: 'help' }}
                            title={`Conflit avec ${conflict.team_entries?.crew_name || '?'} — ${conflict.team_entries?.events?.name || '?'}`}>
                            ⚠️
                          </span>
                        )
                      })()}
                    </div>
                  </td>

                  {/* Driver selector with availability suffix */}
                  <td style={TD}>
                    <select
                      value={stint.driver_id || ''}
                      onChange={e => updateStint(stint.id, 'driver_id', e.target.value || null)}
                      style={{ ...INPUT, minWidth: '120px' }}
                    >
                      <option value="">— À définir —</option>
                      {assignedDrivers.map(d => {
                        const driverId      = d.drivers?.id
                        const status        = checkAvailability(availabilities, driverId, stint._irlStart, stint._irlEnd)
                        const isUnavailable = status === 'unavailable'
                        const suffix        = isUnavailable ? ' ✗' : status === 'partial' ? ' ◑' : ''
                        return (
                          <option key={driverId} value={driverId} disabled={isUnavailable}>
                            {d.drivers?.name}{suffix}
                          </option>
                        )
                      })}
                    </select>
                  </td>

                  {/* IRL start */}
                  <td style={TD}>
                    <span className="mono" style={{ fontSize: '0.75rem' }}>
                      {stint._irlStart ? formatDatetime(stint._irlStart) : '—'}
                    </span>
                  </td>

                  {/* IRL end — shows real crossing time, with optimal hint if user entered custom laps */}
                  <td style={TD}>
                    <span className="mono" style={{
                      fontSize: '0.75rem',
                      textDecoration: stint.irl_end_actual ? 'line-through' : 'none',
                      color: stint.irl_end_actual ? 'var(--text-dim)' : 'var(--text)',
                    }}>
                      {displayIrlEnd ? formatDatetime(displayIrlEnd) : '—'}
                    </span>
                    {/* Show optimal crossing time when user has entered custom laps */}
                    {stint._isLastStint && stint._optimalIrlEnd && stint.laps_planned && stint.laps_planned !== stint._optimalLaps && (
                      <div className="mono" style={{ fontSize: '0.68rem', color: 'var(--accent)', marginTop: '0.1rem' }}>
                        opt: {formatDatetime(stint._optimalIrlEnd)}
                      </div>
                    )}
                  </td>

                  {/* Actual end input (live race use) */}
                  <td style={{ ...TD, padding: '4px 6px', minWidth: '110px' }}>
                    <ActualEndInput
                      plannedEnd={stint._irlEnd}
                      actualEnd={stint.irl_end_actual}
                      onSave={(isoString) => updateActualEnd(stint.id, isoString)}
                      saving={saving === stint.id}
                    />
                  </td>

                  {/* Duration — 🏁 adjusted for last stint, calc or manual for others */}
                  <td style={TD}>
                    {stint._isLastStint && stint._adjustedDurationSec ? (
                      <div>
                        <div className="mono" style={{ fontSize: '0.75rem', color: '#2eb460' }}>
                          🏁 {formatDuration(stint._adjustedDurationSec)}
                        </div>
                        {/* Show optimal duration hint when user has entered custom laps */}
                        {stint._optimalDurationSec && stint.laps_planned && stint.laps_planned !== stint._optimalLaps && (
                          <div className="mono" style={{ fontSize: '0.68rem', color: 'var(--accent)', marginTop: '0.1rem' }}>
                            opt: {formatDuration(stint._optimalDurationSec)}
                          </div>
                        )}
                      </div>
                    ) : stint._durationFromPerf ? (
                      <span className="mono" style={{ fontSize: '0.75rem' }}>
                        {formatDuration(stint._stintDurationSec)}
                      </span>
                    ) : (
                      <input type="number" placeholder="60"
                        value={stint.duration_minutes || ''}
                        onFocus={e => e.target.select()}
                        onChange={e => updateStint(stint.id, 'duration_minutes', e.target.value ? parseInt(e.target.value) : null)}
                        style={{ ...INPUT, width: '80px' }}
                        title="Durée manuelle en minutes" />
                    )}
                  </td>

                  {/* Laps — manual with calculated placeholder, capped at tank capacity */}
                  <td style={TD}>
                    <input type="number" min="1"
                      value={stint.laps_planned || stint._laps || ''}
                      placeholder="—"
                      onFocus={e => e.target.select()}
                      onChange={e => {
                        let val = e.target.value ? parseInt(e.target.value) : null
                        if (val !== null) {
                          val = Math.max(1, val)
                          const fuelPerLap = stint.rain
                            ? (driverPerf[stint.driver_id]?.fuel_wet || driverPerf[stint.driver_id]?.fuel_dry)
                            : (driverPerf[stint.driver_id]?.fuel_dry || driverPerf[stint.driver_id]?.fuel_wet)
                          const tankSize = teamEntry?.bop_tank_size_percent
                            ? teamEntry.cars?.tank_size_litres * (teamEntry.bop_tank_size_percent / 100)
                            : teamEntry?.cars?.tank_size_litres
                          if (fuelPerLap && tankSize) val = Math.min(val, Math.floor(tankSize / fuelPerLap))
                        }
                        updateStint(stint.id, 'laps_planned', val)
                      }}
                      style={{ ...INPUT, width: '60px' }}
                      title={stint._calcLaps ? `Calculé : ${stint._calcLaps} tours` : 'Saisissez les tours'} />
                  </td>

                  {/* Fuel consumption */}
                  <td style={TD}>
                    <span className="mono" style={{ fontSize: '0.72rem', color: stint._fuelUsed ? 'var(--accent)' : 'var(--text-dim)' }}>
                      {stint._fuelUsed ? `${stint._fuelUsed.toFixed(1)}L` : '—'}
                    </span>
                  </td>

                  {/* In-game start time */}
                  <td style={TD}>
                    <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                      {stint._igStart ? formatTime(stint._igStart) : '—'}
                    </span>
                  </td>

                  {/* Day/night phase icon */}
                  <td style={{ ...TD, textAlign: 'center', fontSize: '0.8rem' }}>
                    {stint._phase || '—'}
                  </td>

                  {/* Rain checkbox */}
                  <td style={{ ...TD, textAlign: 'center' }}>
                    <input type="checkbox" checked={!!stint.rain}
                      onChange={e => updateStint(stint.id, 'rain', e.target.checked)}
                      style={{ accentColor: '#4a9fd4', cursor: 'pointer' }} />
                  </td>

                  {/* Tyre change checkbox */}
                  <td style={{ ...TD, textAlign: 'center' }}>
                    <input type="checkbox" checked={!!stint.tyre_change}
                      onChange={e => updateStint(stint.id, 'tyre_change', e.target.checked)}
                      style={{ accentColor: 'var(--accent)', cursor: 'pointer' }} />
                  </td>

                  {/* Availability dots — one per assigned driver */}
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
                          // Accent ring marks the assigned driver
                          outline: isAssigned ? '2px solid var(--accent)' : 'none',
                          outlineOffset: '2px',
                        }} title={`${d.drivers?.name} — ${status || 'non renseigné'}${isAssigned ? ' (assigné)' : ''}`} />
                      </td>
                    )
                  })}

                  {/* Delete button */}
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

      {/* ── Actions ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {/* Warning: race already covered by planned stints */}
        {projectedFinish && raceEndTime && projectedFinish >= raceEndTime && (
          <div style={{
            fontSize: '0.82rem', color: '#d4904a', padding: '0.5rem 0.75rem',
            background: '#2a1a00', border: '1px solid #a06020', borderRadius: '3px',
          }}>
            ⚠️ La course est déjà couverte par les relais planifiés.
          </div>
        )}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={addStint} className="btn btn-secondary">+ Ajouter un relais</button>
          {stints.length > 0 && (
            <button onClick={clearAllStints} className="btn btn-danger btn-sm">Tout supprimer</button>
          )}
        </div>
      </div>

      {/* ── Legend ── */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', fontSize: '0.72rem',
        color: 'var(--text-dim)', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, color: 'var(--text)' }}>Dispo :</span>
        {[
          { color: '#2eb460', label: 'Disponible' },
          { color: '#c9a84c', label: 'Partielle' },
          { color: '#e05555', label: 'Indisponible' },
          { color: '#4a4a6a', label: 'Incertain' },
        ].map(({ color, label }) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: color,
              display: 'inline-block', flexShrink: 0 }} />
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