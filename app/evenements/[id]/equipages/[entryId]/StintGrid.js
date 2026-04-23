"use client";
import { useState, useEffect } from "react";
import { supabaseBrowser as supabase } from "../../../../../lib/supabase-browser";
import ActualEndInput from "./ActualEndInput";

// ─── Display helpers ────────────────────────────────────────────────────────

function formatTime(date) {
  if (!date) return "—";
  return new Date(date).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDatetime(date) {
  if (!date) return "—";
  return new Date(date).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDuration(seconds) {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}min`;
  return `${m} min`;
}

// ─── In-game time calculation ───────────────────────────────────────────────

function getIGTime(irlTime, irlStartStr, igStartTimeStr) {
  if (!igStartTimeStr || !irlStartStr || !irlTime) return null;
  const [igH, igM] = igStartTimeStr.split(":").map(Number);
  const irlStart = new Date(irlStartStr);
  const igStart = new Date(irlStart);
  igStart.setHours(igH, igM, 0, 0);
  return new Date(igStart.getTime() + (new Date(irlTime) - irlStart));
}

function getPhase(igTime, sunriseStr, sunsetStr) {
  if (!igTime || !sunriseStr || !sunsetStr) return null;
  const minutes =
    new Date(igTime).getHours() * 60 + new Date(igTime).getMinutes();
  const [srH, srM] = sunriseStr.split(":").map(Number);
  const [ssH, ssM] = sunsetStr.split(":").map(Number);
  const sunrise = srH * 60 + srM;
  const sunset = ssH * 60 + ssM;
  if (sunrise < sunset) {
    if (minutes >= sunrise + 30 && minutes < sunset - 30) return "☀️";
    if (minutes >= sunset + 30 || minutes < sunrise - 30) return "🌑";
    return "🌗";
  }
  if (minutes >= sunrise + 30 || minutes < sunset - 30) return "☀️";
  if (minutes >= sunset + 30 && minutes < sunrise - 30) return "🌑";
  return "🌗";
}

// ─── Availability check ─────────────────────────────────────────────────────

function checkAvailability(availabilities, driverId, irlStart, irlEnd) {
  if (!irlStart || !irlEnd || !driverId) return null;
  const start = new Date(irlStart).getTime();
  const end = new Date(irlEnd).getTime();
  const windowSlots = Object.values(availabilities).filter((a) => {
    if (a.driver_id !== driverId) return false;
    const t = new Date(a.slot_start).getTime();
    return t < end && t + 30 * 60 * 1000 > start;
  });
  if (windowSlots.length === 0) return "unavailable";
  const availableCount = windowSlots.filter((a) => a.available === true).length;
  const unavailableCount = windowSlots.filter(
    (a) => a.available === false,
  ).length;
  const tentativeCount = windowSlots.filter((a) => a.available === null).length;
  if (availableCount === windowSlots.length) return "available";
  if (unavailableCount > 0 && availableCount === 0 && tentativeCount === 0)
    return "unavailable";
  if (availableCount > 0) return "partial";
  if (tentativeCount > 0 && availableCount === 0 && unavailableCount === 0)
    return "tentative";
  return "partial";
}

// ─── Fuel per lap selection ──────────────────────────────────────────────────
// Extracted so it can be reused in calcStint and calcSkipLastStintTarget.
// Priority mirrors calcStint: night-specific → day + additive → opposite condition.

function selectFuelPerLap(perf, rain, isNight) {
  if (!perf) return null;
  if (rain) {
    return isNight
      ? perf.fuel_night_wet || perf.fuel_wet || perf.fuel_dry || null
      : perf.fuel_wet || perf.fuel_dry || null;
  }
  return isNight
    ? perf.fuel_night_dry || perf.fuel_dry || perf.fuel_wet || null
    : perf.fuel_dry || perf.fuel_wet || null;
}

// ─── Stint calculation engine ───────────────────────────────────────────────

function calcStint(
  stint,
  teamEntry,
  driverPerf,
  igStartTime,
  igSunrise,
  igSunset,
  irlStart,
  // fuelRemaining: fuel left in tank at end of previous stint (null for first stint)
  fuelRemaining = null,
) {
  const pitLane = teamEntry?.events?.circuits?.pit_lane_time_seconds || 0;
  const tyreChange = teamEntry?.tyre_change_time_seconds || 0;
  const carTankSize = teamEntry?.cars?.tank_size_litres;
  const tankSizeForRefuel = teamEntry?.bop_tank_size_percent
    ? carTankSize * (teamEntry.bop_tank_size_percent / 100)
    : carTankSize;
  // Variable refuel time: based on fuel needed to fill tank at class refuel rate.
  // Falls back to flat refuel_time_seconds if rate or tank size unavailable.
  // Per-car rate takes priority over class rate — allows overrides for mixed classes
  const refuelRate =
    teamEntry?.cars?.refuel_litres_per_second ||
    teamEntry?.cars?.car_classes?.refuel_litres_per_second;
  const fuelToAdd =
    fuelRemaining !== null && tankSizeForRefuel
      ? Math.max(0, tankSizeForRefuel - fuelRemaining)
      : (tankSizeForRefuel ?? 0); // first stint or unknown: assume full tank fill
  const refuel =
    refuelRate && fuelToAdd > 0
      ? fuelToAdd / refuelRate
      : teamEntry?.refuel_time_seconds || 0;
  const tankSize = teamEntry?.bop_tank_size_percent
    ? carTankSize * (teamEntry.bop_tank_size_percent / 100)
    : carTankSize;
  const raceStart = teamEntry?.event_start_times?.irl_start;
  const perf = driverPerf[stint.driver_id];

  // Compute phase first so lap time selection can account for night conditions.
  // stintIrlStart is defined here and reused throughout the rest of the function.
  const stintIrlStart = irlStart;
  const igStart = getIGTime(stintIrlStart, raceStart, igStartTime);
  const phase = getPhase(igStart, igSunrise, igSunset);
  const isNight = phase === "🌑";

  // Night additive fallback — applied only when no specific night lap time data exists
  const nightDryAdd = teamEntry?.night_dry_add_seconds || 0;
  const nightWetAdd = teamEntry?.night_wet_add_seconds || 0;

  // Lap time selection priority:
  //   Night + rain:    lap_time_night_wet → (lap_time_wet + nightWetAdd) → (lap_time_dry + nightWetAdd)
  //   Night + dry:     lap_time_night_dry → (lap_time_dry + nightDryAdd) → (lap_time_wet + nightDryAdd)
  //   Day + rain:      lap_time_wet → lap_time_dry
  //   Day + dry:       lap_time_dry → lap_time_wet
  let lapTimeSec;
  if (stint.rain) {
    lapTimeSec = isNight
      ? perf?.lap_time_night_wet ||
        (perf?.lap_time_wet ? perf.lap_time_wet + nightWetAdd : null) ||
        (perf?.lap_time_dry ? perf.lap_time_dry + nightWetAdd : null) ||
        null
      : perf?.lap_time_wet || perf?.lap_time_dry || null;
  } else {
    lapTimeSec = isNight
      ? perf?.lap_time_night_dry ||
        (perf?.lap_time_dry ? perf.lap_time_dry + nightDryAdd : null) ||
        (perf?.lap_time_wet ? perf.lap_time_wet + nightDryAdd : null) ||
        null
      : perf?.lap_time_dry || perf?.lap_time_wet || null;
  }

  // Fuel selection delegated to selectFuelPerLap for reuse
  const fuelPerLap = selectFuelPerLap(perf, stint.rain, isNight);

  const calcLaps =
    fuelPerLap && tankSize
      ? Math.max(1, Math.floor(tankSize / fuelPerLap))
      : null;
  const laps =
    stint.laps_planned ||
    calcLaps ||
    (lapTimeSec ? Math.floor(3600 / lapTimeSec) : null);
  const stintDurationSec =
    laps && lapTimeSec
      ? Math.round(laps * lapTimeSec)
      : stint.duration_minutes
        ? stint.duration_minutes * 60
        : 3600;
  const _durationFromPerf = !!(lapTimeSec && (stint.laps_planned || calcLaps));
  const _durationIsDefault = !laps && !lapTimeSec && !stint.duration_minutes;
  const fuelUsed = laps && fuelPerLap ? laps * fuelPerLap : null;
  const pitStopSec = pitLane + refuel + (stint.tyre_change ? tyreChange : 0);
  const stintIrlEnd =
    stintIrlStart && stintDurationSec
      ? new Date(stintIrlStart.getTime() + stintDurationSec * 1000)
      : null;
  const nextStart = stintIrlEnd
    ? new Date(stintIrlEnd.getTime() + pitStopSec * 1000)
    : null;
  return {
    ...stint,
    _irlStart: stintIrlStart,
    _irlEnd: stintIrlEnd,
    _igStart: igStart,
    _phase: phase,
    _laps: laps,
    _calcLaps: calcLaps,
    _lapTimeSec: lapTimeSec,
    _fuelUsed: fuelUsed,
    _fuelPerLap: fuelPerLap,
    _pitStopSec: pitStopSec,
    _stintDurationSec: stintDurationSec,
    _hasPerfData: !!lapTimeSec,
    _nextStart: nextStart,
    _durationFromPerf,
    _durationIsDefault,
    // Fuel state for next stint's refuel calculation
    _fuelToAdd: fuelToAdd,
    _refuelTime: refuel,
    _fuelRemaining:
      fuelUsed !== null && tankSizeForRefuel
        ? Math.max(0, tankSizeForRefuel - (fuelUsed || 0))
        : null,
  };
}

function calculateAllStints(
  stints,
  teamEntry,
  driverPerf,
  igStartTime,
  igSunrise,
  igSunset,
) {
  const raceStart = teamEntry?.event_start_times?.irl_start;
  const raceEnd =
    raceStart && teamEntry?.events?.duration_minutes
      ? new Date(
          new Date(raceStart).getTime() +
            teamEntry.events.duration_minutes * 60 * 1000,
        )
      : null;
  let currentTime = raceStart ? new Date(raceStart) : null;
  // fuelRemaining tracks fuel left at end of each stint for variable refuel calc
  let fuelRemaining = null;
  const result = [];
  for (const stint of stints) {
    const calc = calcStint(
      stint,
      teamEntry,
      driverPerf,
      igStartTime,
      igSunrise,
      igSunset,
      currentTime,
      fuelRemaining,
    );
    result.push(calc);
    // Carry fuel remaining forward to next stint
    fuelRemaining = calc._fuelRemaining;
    const effectiveEnd = calc.irl_end_actual
      ? new Date(calc.irl_end_actual)
      : calc._irlEnd;
    currentTime = effectiveEnd
      ? new Date(effectiveEnd.getTime() + calc._pitStopSec * 1000)
      : null;
  }
  if (result.length > 0 && raceEnd) {
    const coveringStint = result.find((s) => s._irlEnd && s._irlEnd >= raceEnd);
    if (coveringStint) {
      coveringStint._isLastStint = true;
      if (coveringStint._irlStart && coveringStint._lapTimeSec) {
        const remainingSecs = (raceEnd - coveringStint._irlStart) / 1000;
        coveringStint._optimalLaps = Math.ceil(
          remainingSecs / coveringStint._lapTimeSec,
        );
        coveringStint._laps = coveringStint.laps_planned
          ? coveringStint.laps_planned
          : coveringStint._optimalLaps;
        coveringStint._optimalDurationSec =
          coveringStint._optimalLaps * coveringStint._lapTimeSec;
        coveringStint._optimalIrlEnd = new Date(
          coveringStint._irlStart.getTime() +
            coveringStint._optimalDurationSec * 1000,
        );
        coveringStint._calcLaps = coveringStint._laps;
        coveringStint._stintDurationSec =
          coveringStint._laps * coveringStint._lapTimeSec;
        coveringStint._irlEnd = new Date(
          coveringStint._irlStart.getTime() +
            coveringStint._stintDurationSec * 1000,
        );
        coveringStint._adjustedIrlEnd = coveringStint._irlEnd;
        coveringStint._adjustedDurationSec = coveringStint._stintDurationSec;
        const perf = driverPerf[coveringStint.driver_id];
        const fuelPerLap = coveringStint.rain
          ? perf?.fuel_wet || perf?.fuel_dry
          : perf?.fuel_dry || perf?.fuel_wet;
        if (fuelPerLap)
          coveringStint._fuelUsed = coveringStint._laps * fuelPerLap;
      }
    } else {
      const lastStint = result[result.length - 1];
      lastStint._isLastStint = true;
      lastStint._doesNotCoverRaceEnd = true;
    }
  }
  return result;
}

// ─── Skip last pit stop target consumption ───────────────────────────────────
// For a given stint index, computes the target fuel consumption (L/lap) that
// would allow the car to cover all remaining laps (from next stint to end)
// on the current tank, effectively eliminating the final pit stop.
//
// target = tankSize / Σ laps(stintIndex+1 → lastStint)
// gap    = weightedActualConsumption − target  (always > 0: how much to reduce)
// hasWarning = true if any remaining stint used averaged data (no driver/perf)

function calcSkipLastStintTarget(
  stintIndex,
  calculated,
  teamEntry,
  driverPerf,
  assignedDrivers,
) {
  const carTankSize = teamEntry?.cars?.tank_size_litres;
  const tankSize = teamEntry?.bop_tank_size_percent
    ? carTankSize * (teamEntry.bop_tank_size_percent / 100)
    : carTankSize;
  if (!tankSize) return null;

  const lastIdx = calculated.findIndex((s) => s._isLastStint);
  // Hide on the last stint itself — no pit stop to skip from there
  if (lastIdx === -1 || stintIndex >= lastIdx) return null;

  const lastStint = calculated[lastIdx];

  // ── Fuel cost of the last stint (the stop we're trying to eliminate) ──
  const lastIsNight = lastStint._phase === "🌑";
  let lastFuelPerLap = lastStint._fuelPerLap;
  let hasWarning = false;

  if (!lastFuelPerLap) {
    // Fall back to team average for last stint's condition
    const fuels = assignedDrivers
      .map((d) => d.drivers?.id)
      .filter(Boolean)
      .map((id) =>
        selectFuelPerLap(driverPerf[id], lastStint.rain, lastIsNight),
      )
      .filter(Boolean);
    if (fuels.length > 0)
      lastFuelPerLap = fuels.reduce((s, f) => s + f, 0) / fuels.length;
    hasWarning = true;
  }

  if (!lastFuelPerLap || !lastStint._laps) return null;

  const lastStintFuel = lastStint._laps * lastFuelPerLap;

  // ── Stints over which savings are spread: current stint → second-to-last ──
  // Includes the current stint (stintIndex) so that the second-to-last row
  // shows savings spread over 1 stint — the hardest case.
  const middleStints = calculated.slice(stintIndex, lastIdx);
  const lapsToSaveOver = middleStints.reduce(
    (sum, s) => sum + (s._laps || 0),
    0,
  );
  if (lapsToSaveOver === 0) return null;

  const savingsPerLap = lastStintFuel / lapsToSaveOver;

  // ── Weighted average actual consumption across the same window ──
  let weightedFuelSum = 0;
  let weightedLapSum = 0;

  for (const st of middleStints) {
    const isNight = st._phase === "🌑";
    let fuelPerLap = st._fuelPerLap;
    if (!fuelPerLap) {
      const fuels = assignedDrivers
        .map((d) => d.drivers?.id)
        .filter(Boolean)
        .map((id) => selectFuelPerLap(driverPerf[id], st.rain, isNight))
        .filter(Boolean);
      if (fuels.length > 0)
        fuelPerLap = fuels.reduce((s, f) => s + f, 0) / fuels.length;
      hasWarning = true;
    }
    if (fuelPerLap && st._laps) {
      weightedFuelSum += fuelPerLap * st._laps;
      weightedLapSum += st._laps;
    }
  }

  const actualAvg =
    weightedLapSum > 0 ? weightedFuelSum / weightedLapSum : null;
  // Target: what average consumption needs to be across remaining stints
  const targetConsumption =
    actualAvg !== null ? actualAvg - savingsPerLap : null;

  return { savingsPerLap, targetConsumption, hasWarning };
}

// ─── Completed stint detection ───────────────────────────────────────────────
// A stint is completed if stamped via Race Mode (irl_end_actual),
// OR its calculated end time has already passed.

function isStintCompleted(calcStint) {
  if (calcStint.irl_end_actual) return true;
  if (calcStint._irlEnd && calcStint._irlEnd < new Date()) return true;
  return false;
}

// ─── Extract and merge actual performance from completed stints ──────────────
// Derives actual lap time and fuel per lap from completed stints, grouped by
// driver and condition (dry/wet/night_dry/night_wet).
// Returns a merged driverPerf map where actuals override planned data.

function extractAndMergeActualPerf(completedCalcStints, driverPerf) {
  // Build readings: driverId → condition → [{ lapTime, fuel }]
  const actuals = {};

  for (const stint of completedCalcStints) {
    if (!stint.driver_id || !stint.irl_start) continue;

    // Use actual end if stamped, otherwise the calculated planned end
    const actualEnd = stint.irl_end_actual
      ? new Date(stint.irl_end_actual)
      : stint._irlEnd;
    if (!actualEnd) continue;

    const actualDurationSec = (actualEnd - new Date(stint.irl_start)) / 1000;
    // Prefer laps_planned (confirmed by user); fall back to calculated laps
    const laps = stint.laps_planned || stint._laps;
    if (!laps || laps === 0) continue;

    const actualLapTime = actualDurationSec / laps;
    // fuel_used_calc is persisted by StintGrid's persist useEffect
    const actualFuelPerLap =
      stint.fuel_used_calc != null ? stint.fuel_used_calc / laps : null;

    const isNight = stint._phase === "🌑";
    const condition = stint.rain
      ? isNight
        ? "night_wet"
        : "wet"
      : isNight
        ? "night_dry"
        : "dry";

    if (!actuals[stint.driver_id]) actuals[stint.driver_id] = {};
    if (!actuals[stint.driver_id][condition])
      actuals[stint.driver_id][condition] = [];
    actuals[stint.driver_id][condition].push({
      lapTime: actualLapTime,
      fuel: actualFuelPerLap,
    });
  }

  // Deep-copy driverPerf so we don't mutate the original
  const merged = Object.fromEntries(
    Object.entries(driverPerf).map(([id, perf]) => [id, { ...perf }]),
  );

  // Map condition keys to driver_performance field names
  const fieldMap = {
    dry: { lap: "lap_time_dry", fuel: "fuel_dry" },
    wet: { lap: "lap_time_wet", fuel: "fuel_wet" },
    night_dry: { lap: "lap_time_night_dry", fuel: "fuel_night_dry" },
    night_wet: { lap: "lap_time_night_wet", fuel: "fuel_night_wet" },
  };

  for (const [driverId, conditions] of Object.entries(actuals)) {
    if (!merged[driverId]) merged[driverId] = {};
    for (const [condition, readings] of Object.entries(conditions)) {
      const avgLapTime =
        readings.reduce((s, r) => s + r.lapTime, 0) / readings.length;
      const fuelReadings = readings.filter((r) => r.fuel !== null);
      const avgFuel =
        fuelReadings.length > 0
          ? fuelReadings.reduce((s, r) => s + r.fuel, 0) / fuelReadings.length
          : null;

      const fields = fieldMap[condition];
      merged[driverId][fields.lap] = avgLapTime;
      if (avgFuel !== null) merged[driverId][fields.fuel] = avgFuel;
    }
  }

  return merged;
}

// ─── Auto-generation ────────────────────────────────────────────────────────

function estimateStintCount(teamEntry, driverPerf, assignedDrivers) {
  const durationMinutes = teamEntry?.events?.duration_minutes;
  const carTankSize = teamEntry?.cars?.tank_size_litres;
  const tankSize = teamEntry?.bop_tank_size_percent
    ? carTankSize * (teamEntry.bop_tank_size_percent / 100)
    : carTankSize;
  if (!durationMinutes) return 1;
  const driverIds = assignedDrivers.map((d) => d.drivers?.id).filter(Boolean);
  const perfs = driverIds
    .map((id) => driverPerf[id])
    .filter((p) => p?.lap_time_dry && p?.fuel_dry);
  if (perfs.length === 0) return Math.max(1, Math.ceil(durationMinutes / 60));
  const avgLapSec =
    perfs.reduce((s, p) => s + p.lap_time_dry, 0) / perfs.length;
  const avgFuel = perfs.reduce((s, p) => s + p.fuel_dry, 0) / perfs.length;
  const lapsPerStint = tankSize
    ? Math.floor(tankSize / avgFuel)
    : Math.ceil((60 * 60) / avgLapSec);
  const stintDurMin = Math.round((lapsPerStint * avgLapSec) / 60);
  return Math.max(1, Math.ceil(durationMinutes / stintDurMin));
}

// ─── Cross-event conflict detection ─────────────────────────────────────────

function hasConflict(calc, otherStints) {
  if (!calc._irlStart || !calc._irlEnd) return null;
  for (const other of otherStints) {
    if (!other.irl_start || !other.irl_end_planned) continue;
    if (calc.driver_id !== other.driver_id) continue;
    const aStart = calc._irlStart;
    const aEnd = calc._irlEnd;
    const bStart = new Date(other.irl_start);
    const bEnd = new Date(other.irl_end_planned);
    if (aStart < bEnd && bStart < aEnd) return other;
  }
  return null;
}

// ─── Recalc preview modal ────────────────────────────────────────────────────

function RecalcModal({ diffs, raceEndDiff, onConfirm, onCancel, saving }) {
  const hasChanges = diffs.some((d) => d.newLaps !== d.oldLaps);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "6px",
          padding: "1.5rem",
          maxWidth: "560px",
          width: "100%",
          maxHeight: "80vh",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: "1.25rem" }}>
          <h3
            style={{
              fontFamily: "var(--font-rajdhani), sans-serif",
              letterSpacing: "0.04em",
              marginBottom: "0.25rem",
            }}
          >
            Révision de stratégie
          </h3>
          <p style={{ fontSize: "0.82rem", color: "var(--text-dim)" }}>
            Basée sur les données réelles des relais complétés. Seuls les relais
            restants sont modifiés.
          </p>
        </div>

        {!hasChanges ? (
          <div
            style={{
              color: "var(--text-dim)",
              fontSize: "0.85rem",
              marginBottom: "1.25rem",
              padding: "0.75rem",
              background: "var(--surface-2)",
              borderRadius: "3px",
            }}
          >
            ✓ Aucun changement — la stratégie actuelle correspond aux données
            réelles.
          </div>
        ) : (
          <div style={{ marginBottom: "1.25rem" }}>
            {/* Diff table */}
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.82rem",
              }}
            >
              <thead>
                <tr>
                  {["#", "Pilote", "Actuel", "Révisé", "Écart"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "0.4rem 0.5rem",
                        background: "var(--surface-2)",
                        color: "var(--text-dim)",
                        fontSize: "0.68rem",
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        textAlign: "left",
                        borderBottom: "2px solid var(--border)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {diffs.map((d) => {
                  const diff =
                    d.newLaps != null && d.oldLaps != null
                      ? d.newLaps - d.oldLaps
                      : null;
                  const changed = diff !== null && diff !== 0;
                  return (
                    <tr
                      key={d.stintId}
                      style={{
                        background: changed
                          ? diff > 0
                            ? "rgba(46,180,96,0.06)"
                            : "rgba(224,85,85,0.06)"
                          : "transparent",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      <td
                        style={{
                          padding: "0.4rem 0.5rem",
                          fontFamily: "var(--font-mono), monospace",
                          color: "var(--text-dim)",
                          fontSize: "0.78rem",
                        }}
                      >
                        {d.stintNumber}
                      </td>
                      <td style={{ padding: "0.4rem 0.5rem", fontWeight: 600 }}>
                        {d.driverName}
                      </td>
                      <td
                        style={{
                          padding: "0.4rem 0.5rem",
                          fontFamily: "var(--font-mono), monospace",
                          color: "var(--text-dim)",
                        }}
                      >
                        {d.oldLaps ?? "—"}
                      </td>
                      <td
                        style={{
                          padding: "0.4rem 0.5rem",
                          fontFamily: "var(--font-mono), monospace",
                          fontWeight: changed ? 700 : 400,
                          color: changed
                            ? diff > 0
                              ? "#2eb460"
                              : "var(--danger)"
                            : "var(--text)",
                        }}
                      >
                        {d.newLaps ?? "—"}
                      </td>
                      <td
                        style={{
                          padding: "0.4rem 0.5rem",
                          fontFamily: "var(--font-mono), monospace",
                          fontWeight: 700,
                          color: changed
                            ? diff > 0
                              ? "#2eb460"
                              : "var(--danger)"
                            : "var(--text-dim)",
                        }}
                      >
                        {diff === null
                          ? "—"
                          : diff === 0
                            ? "—"
                            : diff > 0
                              ? `+${diff}`
                              : `${diff}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Race end diff */}
            {raceEndDiff && (
              <div
                style={{
                  marginTop: "0.75rem",
                  padding: "0.5rem 0.75rem",
                  background: "var(--surface-2)",
                  borderRadius: "3px",
                  fontSize: "0.82rem",
                  display: "flex",
                  gap: "0.75rem",
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <span style={{ color: "var(--text-dim)" }}>Fin prévue :</span>
                <span
                  className="mono"
                  style={{
                    color: "var(--text-dim)",
                    textDecoration: "line-through",
                  }}
                >
                  {raceEndDiff.old}
                </span>
                <span style={{ color: "var(--text-dim)" }}>→</span>
                <span
                  className="mono"
                  style={{
                    color: raceEndDiff.improved ? "#2eb460" : "var(--danger)",
                    fontWeight: 700,
                  }}
                >
                  {raceEndDiff.new}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onCancel}
            className="btn btn-secondary"
            disabled={saving}
          >
            Annuler
          </button>
          {hasChanges && (
            <button
              onClick={onConfirm}
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? "Application…" : "✓ Appliquer"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function StintGrid({
  teamEntryId,
  teamEntry,
  assignedDrivers,
  archived = false,
  // When true, automatically opens the recalc modal (triggered from Race Mode)
  autoOpenRecalc = false,
  // Called after auto-open so EquipageTabs can reset the flag
  onAutoOpenHandled = null,
}) {
  const [stints, setStints] = useState([]);
  const [driverPerf, setDriverPerf] = useState({});
  const [availabilities, setAvailabilities] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [autoGenDone, setAutoGenDone] = useState(false);
  const [conflictStints, setConflictStints] = useState([]);
  const [showRecalcModal, setShowRecalcModal] = useState(false);
  const [recalcDiffs, setRecalcDiffs] = useState([]);
  const [recalcRaceEndDiff, setRecalcRaceEndDiff] = useState(null);
  const [recalcMergedPerf, setRecalcMergedPerf] = useState(null);
  const [recalcSaving, setRecalcSaving] = useState(false);

  const event = teamEntry?.events;
  const igStartTime = event?.ig_start_time;
  const igSunrise = event?.ig_sunrise;
  const igSunset = event?.ig_sunset;
  const driverIds = assignedDrivers.map((d) => d.drivers?.id).filter(Boolean);

  // Touch device detection — coarse pointer = mobile = show arrow buttons
  // instead of drag-and-drop which is unreliable on touch screens.
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  // Index of the row currently being dragged over — used for visual highlight
  const [dragOverIndex, setDragOverIndex] = useState(null);
  // Index of the row being dragged — used to prevent self-drop
  const [draggingIndex, setDraggingIndex] = useState(null);

  useEffect(() => {
    if (!teamEntryId) return;
    Promise.all([
      supabase
        .from("stints")
        .select("*")
        .eq("team_entry_id", teamEntryId)
        .order("stint_number"),
      supabase
        .from("driver_performance")
        .select("*")
        .eq("team_entry_id", teamEntryId),
      supabase
        .from("availabilities")
        .select("*")
        .eq("team_entry_id", teamEntryId),
      driverIds.length > 0
        ? supabase
            .from("stints")
            .select("*, team_entries(crew_name, events(name))")
            .in("driver_id", driverIds)
            .neq("team_entry_id", teamEntryId)
        : Promise.resolve({ data: [] }),
    ]).then(
      ([
        { data: stintsData },
        { data: perfData },
        { data: availData },
        { data: otherStints },
      ]) => {
        const perfMap = {};
        (perfData || []).forEach((p) => {
          perfMap[p.driver_id] = p;
        });
        setDriverPerf(perfMap);

        const availMap = {};
        (availData || []).forEach((a) => {
          const key = `${a.driver_id}_${new Date(a.slot_start).toISOString()}`;
          availMap[key] = a;
        });
        setAvailabilities(availMap);

        const loadedStints = stintsData || [];
        setStints(loadedStints);
        setLoading(false);
        setConflictStints(otherStints || []);

        // Auto-generate stints if none exist — skipped for archived events
        if (loadedStints.length === 0 && !autoGenDone && !archived) {
          setAutoGenDone(true);
          const count = estimateStintCount(teamEntry, perfMap, assignedDrivers);
          const rows = Array.from({ length: count }, (_, i) => ({
            team_entry_id: teamEntryId,
            stint_number: i + 1,
            rain: false,
            tyre_change: false,
          }));
          supabase
            .from("stints")
            .insert(rows)
            .select()
            .then(({ data }) => {
              if (data) setStints(data);
            });
        }
      },
    );
  }, [teamEntryId, JSON.stringify(driverIds)]);

  const calculated = calculateAllStints(
    stints,
    teamEntry,
    driverPerf,
    igStartTime,
    igSunrise,
    igSunset,
  );

  // Persist calculated IRL start/end times for conflict detection — skipped when archived
  useEffect(() => {
    if (calculated.length === 0 || archived) return;

    // Compute skip-last-pit target per stint index so it can be persisted
    const raceCoveredLocal = calculated.some(
      (s) => s._isLastStint && !s._doesNotCoverRaceEnd,
    );

    const updates = calculated.map((s, i) => {
      // Only compute skip target when race is covered (same condition as display)
      const skip =
        raceCoveredLocal && !s._isLastStint
          ? calcSkipLastStintTarget(
              i,
              calculated,
              teamEntry,
              driverPerf,
              assignedDrivers,
            )
          : null;
      return {
        id: s.id,
        irl_start: s._irlStart ? s._irlStart.toISOString() : null,
        irl_end: s._irlEnd ? s._irlEnd.toISOString() : null,
        fuel_used_calc: s._fuelUsed ?? null,
        fuel_remaining_calc: s._fuelRemaining ?? null,
        target_consumption_skip_last: skip?.targetConsumption ?? null,
      };
    });

    if (updates.length === 0) return;

    Promise.all(
      updates.map((u) =>
        supabase
          .from("stints")
          .update({
            irl_start: u.irl_start,
            irl_end_planned: u.irl_end,
            fuel_used_calc: u.fuel_used_calc,
            fuel_remaining_calc: u.fuel_remaining_calc,
            target_consumption_skip_last: u.target_consumption_skip_last,
          })
          .eq("id", u.id),
      ),
    );
  }, [
    JSON.stringify(
      calculated.map((s) => ({
        id: s.id,
        start: s._irlStart,
        end: s._irlEnd,
        fuel: s._fuelUsed,
      })),
    ),
  ]);

  // Auto-open recalc modal when triggered from Race Mode
  useEffect(() => {
    if (!autoOpenRecalc || loading) return;
    // Only open if there are completed and remaining stints
    if (
      calculated.some(isStintCompleted) &&
      calculated.some((s) => !isStintCompleted(s))
    ) {
      openRecalcModal();
      onAutoOpenHandled?.();
    }
  }, [autoOpenRecalc, loading]);

  // Detect touch device on mount — pointer: coarse = touchscreen.
  // Determines whether to show drag handles or arrow buttons.
  useEffect(() => {
    setIsTouchDevice(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  // ── Open recalc modal ──────────────────────────────────────────────────────
  // Splits calculated stints into completed vs remaining, extracts actual perf,
  // reruns the calc engine, then builds a diff for the preview modal.

  const openRecalcModal = () => {
    const completedCalc = calculated.filter(isStintCompleted);
    const remainingCalc = calculated.filter((s) => !isStintCompleted(s));
    if (completedCalc.length === 0 || remainingCalc.length === 0) return;

    // Build driver id → name lookup
    const driverMap = {};
    assignedDrivers.forEach((d) => {
      if (d.drivers?.id) driverMap[d.drivers.id] = d.drivers.name;
    });

    // Merge actual perf from completed stints into driverPerf
    const mergedPerf = extractAndMergeActualPerf(completedCalc, driverPerf);

    // Rerun calculation with merged perf
    const recalculated = calculateAllStints(
      stints,
      teamEntry,
      mergedPerf,
      igStartTime,
      igSunrise,
      igSunset,
    );

    // Build diff for remaining stints only
    const diffs = remainingCalc.map((orig) => {
      const revised = recalculated.find((s) => s.id === orig.id);
      return {
        stintId: orig.id,
        stintNumber: orig.stint_number,
        driverName: driverMap[orig.driver_id] || "—",
        oldLaps: orig.laps_planned ?? orig._laps ?? null,
        newLaps: revised?.laps_planned ?? revised?._laps ?? null,
      };
    });

    // Race end diff — compare last projected finish
    const oldLast = calculated[calculated.length - 1];
    const newLast = recalculated[recalculated.length - 1];
    const oldEnd = oldLast?._adjustedIrlEnd || oldLast?._irlEnd;
    const newEnd = newLast?._adjustedIrlEnd || newLast?._irlEnd;
    const raceEndDiff =
      oldEnd && newEnd
        ? {
            old: formatDatetime(oldEnd),
            new: formatDatetime(newEnd),
            // "improved" = new finish is closer to (but not over) the actual race end
            improved: raceEndTime
              ? Math.abs(newEnd - raceEndTime) < Math.abs(oldEnd - raceEndTime)
              : newEnd <= oldEnd,
          }
        : null;

    setRecalcMergedPerf(mergedPerf);
    setRecalcDiffs(diffs);
    setRecalcRaceEndDiff(raceEndDiff);
    setShowRecalcModal(true);
  };

  // ── Apply recalc ───────────────────────────────────────────────────────────
  // Writes new laps_planned to DB for remaining stints only.

  const applyRecalc = async () => {
    if (!recalcMergedPerf) return;
    setRecalcSaving(true);

    // Rerun with merged perf to get final laps
    const recalculated = calculateAllStints(
      stints,
      teamEntry,
      recalcMergedPerf,
      igStartTime,
      igSunrise,
      igSunset,
    );

    const remainingCalc = recalculated.filter((s) => !isStintCompleted(s));

    // Persist new laps_planned for remaining stints that have a calculated value
    await Promise.all(
      remainingCalc
        .filter((s) => s._laps != null)
        .map((s) =>
          supabase
            .from("stints")
            .update({ laps_planned: s._laps })
            .eq("id", s.id),
        ),
    );

    // Update local state so StintGrid rerenders immediately
    setStints((prev) =>
      prev.map((s) => {
        const revised = remainingCalc.find((r) => r.id === s.id);
        if (!revised || revised._laps == null) return s;
        return { ...s, laps_planned: revised._laps };
      }),
    );

    setRecalcSaving(false);
    setShowRecalcModal(false);
    setRecalcMergedPerf(null);
  };

  const addStint = async () => {
    if (archived) return;
    const nextNum =
      stints.length > 0
        ? Math.max(...stints.map((s) => s.stint_number)) + 1
        : 1;
    const { data, error } = await supabase
      .from("stints")
      .insert([
        {
          team_entry_id: teamEntryId,
          stint_number: nextNum,
          rain: false,
          tyre_change: false,
        },
      ])
      .select()
      .single();
    if (!error) setStints((prev) => [...prev, data]);
  };

  const updateStint = async (stintId, field, value) => {
    if (archived) return;
    setSaving(stintId);
    setStints((prev) =>
      prev.map((s) => (s.id === stintId ? { ...s, [field]: value } : s)),
    );
    // When a new driver is assigned, clear previous_driver_id — the slot is
    // now actively claimed and should no longer trigger the restore modal.
    const extraFields =
      field === "driver_id" && value ? { previous_driver_id: null } : {};
    await supabase
      .from("stints")
      .update({ [field]: value, ...extraFields })
      .eq("id", stintId);
    setSaving(null);
  };

  const updateActualEnd = async (stintId, isoString) => {
    if (archived) return;
    setSaving(stintId);
    setStints((prev) =>
      prev.map((s) =>
        s.id === stintId ? { ...s, irl_end_actual: isoString } : s,
      ),
    );
    await supabase
      .from("stints")
      .update({ irl_end_actual: isoString })
      .eq("id", stintId);
    setSaving(null);
  };

  const deleteStint = async (stintId) => {
    if (archived) return;
    if (!confirm("Supprimer ce relais ?")) return;
    await supabase.from("stints").delete().eq("id", stintId);
    setStints((prev) => prev.filter((s) => s.id !== stintId));
  };

  const clearAllStints = async () => {
    if (archived) return;
    if (!confirm("Supprimer tous les relais ?")) return;
    await supabase.from("stints").delete().eq("team_entry_id", teamEntryId);
    setStints([]);
  };

  // Swaps all driver-specific fields between two stints identified by their
  // position in the calculated array. Only eligible stints can be swapped —
  // completed or past stints are immovable.
  // Fields swapped: driver_id, laps_planned, rain, tyre_change, notes,
  //                 irl_end_actual, previous_driver_id
  // Fields kept:    id, stint_number, team_entry_id (slot identity)
  const swapStints = async (indexA, indexB) => {
    if (archived) return;
    const a = calculated[indexA];
    const b = calculated[indexB];
    if (!a || !b) return;

    // Guard — never swap with a completed or past stint
    const isLocked = (s) =>
      isStintCompleted(s) || (s._irlStart && s._irlStart < new Date());
    if (isLocked(a) || isLocked(b)) return;

    const fieldsToSwap = [
      "driver_id",
      "laps_planned",
      "rain",
      "tyre_change",
      "notes",
      "irl_end_actual",
      "previous_driver_id",
    ];

    // Build payloads — each stint gets the other's values
    const payloadA = Object.fromEntries(
      fieldsToSwap.map((f) => [f, b[f] ?? null]),
    );
    const payloadB = Object.fromEntries(
      fieldsToSwap.map((f) => [f, a[f] ?? null]),
    );

    // Optimistic update — instant UI response
    setStints((prev) =>
      prev.map((s) => {
        if (s.id === a.id) return { ...s, ...payloadA };
        if (s.id === b.id) return { ...s, ...payloadB };
        return s;
      }),
    );

    // Persist both updates in parallel
    await Promise.all([
      supabase.from("stints").update(payloadA).eq("id", a.id),
      supabase.from("stints").update(payloadB).eq("id", b.id),
    ]);
  };

  // Returns true if a stint can be reordered — not completed and not started
  const isEligible = (stint) =>
    !isStintCompleted(stint) &&
    !(stint._irlStart && stint._irlStart < new Date());

  const TH = {
    background: "var(--surface-2)",
    color: "var(--text-dim)",
    fontSize: "0.65rem",
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    padding: "0.5rem 0.5rem",
    borderBottom: "2px solid var(--border)",
    whiteSpace: "nowrap",
    textAlign: "left",
  };
  const TD = {
    padding: "0.35rem 0.5rem",
    borderBottom: "1px solid var(--border)",
    verticalAlign: "middle",
    fontSize: "0.82rem",
  };
  const INPUT = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "3px",
    color: "var(--text)",
    fontFamily: "var(--font-mono), monospace",
    fontSize: "0.8rem",
    padding: "0.25rem 0.4rem",
    width: "100%",
  };

  // True when the last calculated stint covers the race end — this is the
  // only context where the skip-last-pit feature is meaningful.
  const raceCovered =
    calculated.length > 0 &&
    calculated.some((s) => s._isLastStint && !s._doesNotCoverRaceEnd);

  if (!teamEntry?.event_start_times?.irl_start)
    return (
      <div className="card">
        <div className="empty">Aucun horaire de départ configuré.</div>
      </div>
    );
  if (assignedDrivers.length === 0)
    return (
      <div className="card">
        <div className="empty">
          Aucun pilote assigné — assignez des pilotes d&apos;abord.
        </div>
      </div>
    );
  if (loading)
    return (
      <div className="card">
        <div className="empty">Chargement…</div>
      </div>
    );

  const raceEndTime =
    teamEntry?.event_start_times?.irl_start && event?.duration_minutes
      ? new Date(
          new Date(teamEntry.event_start_times.irl_start).getTime() +
            event.duration_minutes * 60 * 1000,
        )
      : null;

  const lastCalc = calculated[calculated.length - 1];
  const projectedFinish = lastCalc?._adjustedIrlEnd || lastCalc?._irlEnd;

  return (
    <div>
      {/* Summary bar */}
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          marginBottom: "1rem",
          flexWrap: "wrap",
        }}
      >
        {[
          {
            label: "Départ",
            value: formatDatetime(teamEntry.event_start_times?.irl_start),
          },
          {
            label: "Fin course",
            value: raceEndTime ? formatDatetime(raceEndTime) : "—",
          },
          { label: "Relais", value: stints.length },
          {
            label: "Fin prévue",
            value: projectedFinish ? formatDatetime(projectedFinish) : "—",
            color:
              raceEndTime && projectedFinish
                ? projectedFinish >= raceEndTime
                  ? "#2eb460"
                  : "var(--danger)"
                : null,
          },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "4px",
              padding: "0.6rem 1rem",
              flex: 1,
              minWidth: "120px",
            }}
          >
            <div
              style={{
                fontSize: "0.65rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--text-dim)",
                marginBottom: "0.2rem",
              }}
            >
              {label}
            </div>
            <div
              className="mono"
              style={{ fontSize: "0.85rem", color: color || "var(--text)" }}
            >
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Fair share indicators */}
      {assignedDrivers.length > 0 &&
        calculated.length > 0 &&
        (() => {
          const totalLaps = calculated.reduce(
            (sum, s) => sum + (s._laps || 0),
            0,
          );
          const equalShare = totalLaps / assignedDrivers.length;
          const fairShareMin = Math.ceil(equalShare * 0.25);
          const lapsByDriver = {};
          assignedDrivers.forEach((d) => {
            if (d.drivers?.id) lapsByDriver[d.drivers.id] = 0;
          });
          calculated.forEach((s) => {
            if (s.driver_id && s._laps)
              lapsByDriver[s.driver_id] =
                (lapsByDriver[s.driver_id] || 0) + s._laps;
          });
          return (
            <div style={{ marginBottom: "1rem" }}>
              <div
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-dim)",
                  marginBottom: "0.5rem",
                }}
              >
                Fair Share — minimum {fairShareMin} tours (
                {Math.round(equalShare)} part égale)
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {assignedDrivers.map((d) => {
                  const driverId = d.drivers?.id;
                  const laps = lapsByDriver[driverId] || 0;
                  const ok = laps >= fairShareMin;
                  return (
                    <div
                      key={driverId}
                      style={{
                        background: "var(--surface-2)",
                        border: "1px solid",
                        borderColor: ok
                          ? "#2eb460"
                          : totalLaps === 0
                            ? "var(--border)"
                            : "var(--danger)",
                        borderRadius: "3px",
                        padding: "0.4rem 0.75rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <span>{totalLaps === 0 ? "—" : ok ? "✅" : "❌"}</span>
                      <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                        {d.drivers?.name || "—"}
                      </span>
                      <span
                        className="mono"
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--text-dim)",
                        }}
                      >
                        {laps} tours
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          marginBottom: "0.5rem",
          fontSize: "0.72rem",
          color: "var(--text-dim)",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <span style={{ fontWeight: 700, color: "var(--text)" }}>Dispo :</span>
        {[
          { color: "#2eb460", label: "Disponible" },
          { color: "#c9a84c", label: "Partielle" },
          { color: "#e05555", label: "Indisponible" },
          { color: "#4a4a6a", label: "Incertain" },
        ].map(({ color, label }) => (
          <span
            key={label}
            style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: color,
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            {label}
          </span>
        ))}
        <span style={{ marginLeft: "0.5rem" }}>
          🛞 = Chgt pneus · 💧 = Pluie
        </span>
      </div>
      <div
        style={{
          marginBottom: "0.5rem",
          fontSize: "0.72rem",
          color: "var(--text-dim)",
        }}
      >
        Temps chgt pneus : {teamEntry?.tyre_change_time_seconds || 0}s
        {teamEntry?.cars?.car_classes?.refuel_litres_per_second
          ? ` — Ravitaillement : ${teamEntry.cars.car_classes.refuel_litres_per_second} L/s (variable)`
          : ` — Ravitaillement : ${teamEntry?.refuel_time_seconds || 0}s (fixe)`}
        {!archived &&
          !teamEntry?.cars?.car_classes?.refuel_litres_per_second &&
          " (configurable dans Modifier l'équipage)"}
      </div>

      {/* ── Recalc banner — visible when completed stints exist ──────────── */}
      {!archived &&
        calculated.some(isStintCompleted) &&
        calculated.some((s) => !isStintCompleted(s)) && (
          <div
            onClick={openRecalcModal}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.65rem 1rem",
              marginBottom: "0.75rem",
              background: "rgba(var(--accent-rgb), 0.06)",
              border: "1px solid var(--accent-dim)",
              borderRadius: "4px",
              cursor: "pointer",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background =
                "rgba(var(--accent-rgb), 0.12)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background =
                "rgba(var(--accent-rgb), 0.06)")
            }
          >
            <div>
              <div
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  color: "var(--accent)",
                }}
              >
                ↻ Recalculer la stratégie
              </div>
              <div
                style={{
                  fontSize: "0.72rem",
                  color: "var(--text-dim)",
                  marginTop: "0.1rem",
                }}
              >
                {calculated.filter(isStintCompleted).length} relais complétés ·
                données réelles disponibles
              </div>
            </div>
            <span style={{ color: "var(--accent)", fontSize: "0.85rem" }}>
              →
            </span>
          </div>
        )}

      {/* Stint grid table */}
      <div
        style={{
          overflowX: "auto",
          border: "1px solid var(--border)",
          borderRadius: "4px",
          marginBottom: "1rem",
        }}
      >
        <table
          style={{
            borderCollapse: "collapse",
            width: "100%",
            minWidth: `${680 + assignedDrivers.length * 26}px`,
          }}
        >
          <thead>
            <tr>
              <th style={{ ...TH, width: "28px" }}>#</th>
              <th style={{ ...TH, minWidth: "130px" }}>Pilote</th>
              <th style={TH}>Départ IRL</th>
              <th style={TH}>Fin IRL</th>
              {!archived && (
                <th style={{ ...TH, minWidth: "110px" }}>Fin réelle</th>
              )}
              <th style={{ ...TH, width: "68px" }}>Durée</th>
              <th style={{ ...TH, width: "52px" }}>Tours</th>
              <th style={{ ...TH, width: "60px" }}>Conso</th>
              {/* Skip last pit — only shown when race is fully covered */}
              {raceCovered && (
                <th
                  style={{ ...TH, width: "90px" }}
                  title="Conso cible pour supprimer le dernier arrêt"
                >
                  Skip fin
                </th>
              )}
              <th style={{ ...TH, width: "52px" }}>IG</th>
              <th style={{ ...TH, width: "24px" }}>⏱</th>
              <th style={{ ...TH, width: "24px" }} title="Pluie">
                💧
              </th>
              <th style={{ ...TH, width: "24px" }} title="Changement de pneus">
                🛞
              </th>
              {assignedDrivers.map((d) => (
                <th
                  key={d.drivers?.id}
                  style={{
                    ...TH,
                    width: "26px",
                    textAlign: "center",
                    fontSize: "0.58rem",
                  }}
                  title={d.drivers?.name}
                >
                  {d.drivers?.name?.split(" ")[0]?.slice(0, 3)}
                </th>
              ))}
              {!archived && <th style={{ ...TH, width: "36px" }}></th>}
            </tr>
          </thead>
          <tbody>
            {calculated.length === 0 && (
              <tr>
                <td
                  colSpan={
                    11 +
                    assignedDrivers.length +
                    (archived ? 0 : 2) +
                    (raceCovered ? 1 : 0)
                  }
                  style={{
                    ...TD,
                    textAlign: "center",
                    color: "var(--text-dim)",
                    padding: "2rem",
                  }}
                >
                  Aucun relais planifié.
                </td>
              </tr>
            )}
            {calculated.map((stint, i) => {
              const isSaving = saving === stint.id;
              const displayIrlEnd =
                stint._isLastStint && stint._adjustedIrlEnd
                  ? stint._adjustedIrlEnd
                  : stint._irlEnd;
              return (
                <tr
                  key={stint.id}
                  draggable={!archived && isEligible(stint)}
                  onDragStart={
                    !archived && isEligible(stint)
                      ? () => {
                          setDraggingIndex(i);
                        }
                      : undefined
                  }
                  onDragOver={
                    !archived && isEligible(stint)
                      ? (e) => {
                          e.preventDefault();
                          // Only highlight if dragging from an eligible source
                          if (draggingIndex !== null && draggingIndex !== i) {
                            setDragOverIndex(i);
                          }
                        }
                      : undefined
                  }
                  onDrop={
                    !archived && isEligible(stint)
                      ? (e) => {
                          e.preventDefault();
                          if (
                            draggingIndex !== null &&
                            draggingIndex !== i &&
                            isEligible(calculated[draggingIndex])
                          ) {
                            swapStints(draggingIndex, i);
                          }
                          setDragOverIndex(null);
                          setDraggingIndex(null);
                        }
                      : undefined
                  }
                  onDragEnd={() => {
                    setDragOverIndex(null);
                    setDraggingIndex(null);
                  }}
                  style={{
                    background:
                      dragOverIndex === i && draggingIndex !== i
                        ? "rgba(var(--accent-rgb), 0.1)"
                        : stint._isLastStint
                          ? stint._doesNotCoverRaceEnd
                            ? "rgba(224,85,85,0.15)"
                            : "rgba(46,180,96,0.12)"
                          : i % 2 === 0
                            ? "transparent"
                            : "rgba(255,255,255,0.02)",
                    opacity: draggingIndex === i ? 0.4 : isSaving ? 0.6 : 1,
                    cursor:
                      !archived && isEligible(stint) && !isTouchDevice
                        ? "grab"
                        : "default",
                    outline:
                      dragOverIndex === i && draggingIndex !== i
                        ? "2px solid var(--accent)"
                        : "none",
                    borderLeft: stint._isLastStint
                      ? stint._doesNotCoverRaceEnd
                        ? "3px solid var(--danger)"
                        : "3px solid #2eb460"
                      : "3px solid transparent",
                  }}
                >
                  {/* # */}
                  <td style={{ ...TD, textAlign: "center" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.3rem",
                      }}
                    >
                      <span
                        className="mono"
                        style={{
                          color: "var(--text-dim)",
                          fontSize: "0.72rem",
                        }}
                      >
                        {stint.stint_number}
                      </span>
                      {(() => {
                        const conflict = hasConflict(stint, conflictStints);
                        if (!conflict) return null;
                        return (
                          <span
                            style={{ fontSize: "0.75rem", cursor: "help" }}
                            title={`Conflit avec ${conflict.team_entries?.crew_name || "?"} — ${conflict.team_entries?.events?.name || "?"}`}
                          >
                            ⚠️
                          </span>
                        );
                      })()}
                    </div>
                  </td>

                  {/* Driver selector */}
                  <td style={TD}>
                    <select
                      value={stint.driver_id || ""}
                      onChange={(e) =>
                        updateStint(
                          stint.id,
                          "driver_id",
                          e.target.value || null,
                        )
                      }
                      disabled={archived}
                      style={{
                        ...INPUT,
                        minWidth: "120px",
                        opacity: archived ? 0.7 : 1,
                      }}
                    >
                      <option value="">— À définir —</option>
                      {assignedDrivers.map((d) => {
                        const driverId = d.drivers?.id;
                        const status = checkAvailability(
                          availabilities,
                          driverId,
                          stint._irlStart,
                          stint._irlEnd,
                        );
                        const isUnavailable = status === "unavailable";
                        const suffix = isUnavailable
                          ? " ✗"
                          : status === "partial"
                            ? " ◑"
                            : "";
                        return (
                          <option
                            key={driverId}
                            value={driverId}
                            disabled={isUnavailable && !archived}
                          >
                            {d.drivers?.name}
                            {suffix}
                          </option>
                        );
                      })}
                    </select>
                  </td>

                  {/* IRL start */}
                  <td style={TD}>
                    <span className="mono" style={{ fontSize: "0.75rem" }}>
                      {stint._irlStart ? formatDatetime(stint._irlStart) : "—"}
                    </span>
                  </td>

                  {/* IRL end */}
                  <td style={TD}>
                    <span
                      className="mono"
                      style={{
                        fontSize: "0.75rem",
                        textDecoration: stint.irl_end_actual
                          ? "line-through"
                          : "none",
                        color: stint.irl_end_actual
                          ? "var(--text-dim)"
                          : "var(--text)",
                      }}
                    >
                      {displayIrlEnd ? formatDatetime(displayIrlEnd) : "—"}
                    </span>
                    {stint._isLastStint &&
                      stint._optimalIrlEnd &&
                      stint.laps_planned &&
                      stint.laps_planned !== stint._optimalLaps && (
                        <div
                          className="mono"
                          style={{
                            fontSize: "0.68rem",
                            color: "var(--accent)",
                            marginTop: "0.1rem",
                          }}
                        >
                          opt: {formatDatetime(stint._optimalIrlEnd)}
                        </div>
                      )}
                  </td>

                  {/* Actual end */}
                  {!archived && (
                    <td
                      style={{ ...TD, padding: "4px 6px", minWidth: "110px" }}
                    >
                      <ActualEndInput
                        plannedEnd={stint._irlEnd}
                        actualEnd={stint.irl_end_actual}
                        onSave={(isoString) =>
                          updateActualEnd(stint.id, isoString)
                        }
                        saving={saving === stint.id}
                      />
                    </td>
                  )}

                  {/* Duration */}
                  <td style={TD}>
                    {stint._isLastStint && stint._adjustedDurationSec ? (
                      <div>
                        <div
                          className="mono"
                          style={{ fontSize: "0.75rem", color: "#2eb460" }}
                        >
                          🏁 {formatDuration(stint._adjustedDurationSec)}
                        </div>
                        {stint._optimalDurationSec &&
                          stint.laps_planned &&
                          stint.laps_planned !== stint._optimalLaps && (
                            <div
                              className="mono"
                              style={{
                                fontSize: "0.68rem",
                                color: "var(--accent)",
                                marginTop: "0.1rem",
                              }}
                            >
                              opt: {formatDuration(stint._optimalDurationSec)}
                            </div>
                          )}
                      </div>
                    ) : stint._durationFromPerf ? (
                      <span className="mono" style={{ fontSize: "0.75rem" }}>
                        {formatDuration(stint._stintDurationSec)}
                      </span>
                    ) : (
                      <input
                        type="number"
                        placeholder="60"
                        value={stint.duration_minutes || ""}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) =>
                          updateStint(
                            stint.id,
                            "duration_minutes",
                            e.target.value ? parseInt(e.target.value) : null,
                          )
                        }
                        disabled={archived}
                        style={{
                          ...INPUT,
                          width: "80px",
                          opacity: archived ? 0.7 : 1,
                        }}
                        title="Durée manuelle en minutes"
                      />
                    )}
                  </td>

                  {/* Laps */}
                  <td style={TD}>
                    <input
                      type="number"
                      min="1"
                      value={stint.laps_planned || stint._laps || ""}
                      placeholder="—"
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        let val = e.target.value
                          ? parseInt(e.target.value)
                          : null;
                        if (val !== null) {
                          val = Math.max(1, val);
                          const fuelPerLap = stint.rain
                            ? driverPerf[stint.driver_id]?.fuel_wet ||
                              driverPerf[stint.driver_id]?.fuel_dry
                            : driverPerf[stint.driver_id]?.fuel_dry ||
                              driverPerf[stint.driver_id]?.fuel_wet;
                          const tankSize = teamEntry?.bop_tank_size_percent
                            ? teamEntry.cars?.tank_size_litres *
                              (teamEntry.bop_tank_size_percent / 100)
                            : teamEntry?.cars?.tank_size_litres;
                          if (fuelPerLap && tankSize)
                            val = Math.min(
                              val,
                              Math.floor(tankSize / fuelPerLap),
                            );
                        }
                        updateStint(stint.id, "laps_planned", val);
                      }}
                      disabled={archived}
                      style={{
                        ...INPUT,
                        width: "60px",
                        opacity: archived ? 0.7 : 1,
                      }}
                      title={
                        stint._calcLaps
                          ? `Calculé : ${stint._calcLaps} tours`
                          : "Saisissez les tours"
                      }
                    />
                    {stint._isLastStint &&
                      stint._optimalLaps &&
                      stint.laps_planned &&
                      stint.laps_planned !== stint._optimalLaps && (
                        <div
                          className="mono"
                          style={{
                            fontSize: "0.68rem",
                            color: "var(--accent)",
                            marginTop: "0.1rem",
                          }}
                        >
                          opt: {stint._optimalLaps}
                        </div>
                      )}
                  </td>

                  {/* Fuel */}
                  <td style={TD}>
                    <span
                      className="mono"
                      style={{
                        fontSize: "0.72rem",
                        // Dim if using persisted fallback (no live perf data)
                        color: stint._fuelUsed
                          ? "var(--accent)"
                          : stint.fuel_used_calc
                            ? "var(--text-dim)"
                            : "var(--text-dim)",
                      }}
                    >
                      {(stint._fuelUsed ?? stint.fuel_used_calc)
                        ? `${(stint._fuelUsed ?? stint.fuel_used_calc).toFixed(1)}L`
                        : "—"}
                    </span>
                  </td>

                  {/* Skip last pit target consumption */}
                  {raceCovered && (
                    <td style={TD}>
                      {(() => {
                        // Last stint itself has no target — it is the stop being skipped
                        if (stint._isLastStint)
                          return (
                            <span
                              style={{
                                color: "var(--text-dim)",
                                fontSize: "0.72rem",
                              }}
                            >
                              —
                            </span>
                          );
                        const skip = calcSkipLastStintTarget(
                          i,
                          calculated,
                          teamEntry,
                          driverPerf,
                          assignedDrivers,
                        );
                        if (!skip)
                          // Show persisted fallback if live calc unavailable (e.g. perf data missing)
                          return stint.target_consumption_skip_last ? (
                            <div
                              className="mono"
                              style={{
                                fontSize: "0.72rem",
                                color: "var(--text-dim)",
                              }}
                            >
                              {stint.target_consumption_skip_last.toFixed(2)}{" "}
                              L/tr
                            </div>
                          ) : (
                            <span
                              style={{
                                color: "var(--text-dim)",
                                fontSize: "0.72rem",
                              }}
                            >
                              —
                            </span>
                          );
                        return (
                          <div className="mono" style={{ fontSize: "0.72rem" }}>
                            {/* Target consumption to skip last pit */}
                            <div style={{ color: "var(--accent)" }}>
                              {skip.targetConsumption !== null
                                ? `${skip.targetConsumption.toFixed(2)} L/tr`
                                : "—"}
                            </div>
                            {/* Savings needed per lap vs current plan */}
                            <div
                              style={{
                                fontSize: "0.65rem",
                                color: "var(--danger)",
                                marginTop: "0.1rem",
                              }}
                            >
                              −{skip.savingsPerLap.toFixed(2)} L/tr
                              {skip.hasWarning && (
                                <span
                                  title="Données manquantes — moyenne utilisée"
                                  style={{ marginLeft: "0.2rem" }}
                                >
                                  ⚠️
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                  )}

                  {/* IG start */}
                  <td style={TD}>
                    <span
                      className="mono"
                      style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}
                    >
                      {stint._igStart ? formatTime(stint._igStart) : "—"}
                    </span>
                  </td>

                  {/* Phase */}
                  <td
                    style={{ ...TD, textAlign: "center", fontSize: "0.8rem" }}
                  >
                    {stint._phase || "—"}
                  </td>

                  {/* Rain */}
                  <td style={{ ...TD, textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={!!stint.rain}
                      onChange={(e) =>
                        updateStint(stint.id, "rain", e.target.checked)
                      }
                      disabled={archived}
                      style={{
                        accentColor: "#4a9fd4",
                        cursor: archived ? "default" : "pointer",
                      }}
                    />
                  </td>

                  {/* Tyre change */}
                  <td style={{ ...TD, textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={!!stint.tyre_change}
                      onChange={(e) =>
                        updateStint(stint.id, "tyre_change", e.target.checked)
                      }
                      disabled={archived}
                      style={{
                        accentColor: "var(--accent)",
                        cursor: archived ? "default" : "pointer",
                      }}
                    />
                  </td>

                  {/* Availability dots */}
                  {assignedDrivers.map((d) => {
                    const driverId = d.drivers?.id;
                    const status = checkAvailability(
                      availabilities,
                      driverId,
                      stint._irlStart,
                      stint._irlEnd,
                    );
                    const isAssigned = stint.driver_id === driverId;
                    const color =
                      status === "available"
                        ? "#2eb460"
                        : status === "partial"
                          ? "#c9a84c"
                          : status === "unavailable"
                            ? "#e05555"
                            : status === "tentative"
                              ? "#4a4a6a"
                              : "#3a3a5a";
                    return (
                      <td
                        key={driverId}
                        style={{
                          ...TD,
                          textAlign: "center",
                          padding: "0.35rem 0.2rem",
                        }}
                      >
                        <div
                          style={{
                            width: "9px",
                            height: "9px",
                            borderRadius: "50%",
                            background: color,
                            margin: "0 auto",
                            outline: isAssigned
                              ? "2px solid var(--accent)"
                              : "none",
                            outlineOffset: "2px",
                          }}
                          title={`${d.drivers?.name} — ${status || "non renseigné"}${isAssigned ? " (assigné)" : ""}`}
                        />
                      </td>
                    );
                  })}

                  {/* Delete + reorder controls */}
                  {!archived && (
                    <td style={{ ...TD, textAlign: "center" }}>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.15rem",
                          alignItems: "center",
                        }}
                      >
                        {/* Arrow buttons — touch devices only, hidden on desktop (drag handles used instead) */}
                        {isTouchDevice && isEligible(stint) && (
                          <div style={{ display: "flex", gap: "0.15rem" }}>
                            {/* ↑ — only shown when the stint above is also eligible */}
                            {i > 0 && isEligible(calculated[i - 1]) && (
                              <button
                                onClick={() => swapStints(i, i - 1)}
                                style={{
                                  background: "var(--surface-2)",
                                  border: "1px solid var(--border)",
                                  borderRadius: "3px",
                                  color: "var(--text-dim)",
                                  cursor: "pointer",
                                  fontSize: "0.65rem",
                                  padding: "0.1rem 0.3rem",
                                  lineHeight: 1,
                                }}
                                title="Remonter"
                              >
                                ↑
                              </button>
                            )}
                            {/* ↓ — only shown when the stint below is also eligible */}
                            {i < calculated.length - 1 &&
                              isEligible(calculated[i + 1]) && (
                                <button
                                  onClick={() => swapStints(i, i + 1)}
                                  style={{
                                    background: "var(--surface-2)",
                                    border: "1px solid var(--border)",
                                    borderRadius: "3px",
                                    color: "var(--text-dim)",
                                    cursor: "pointer",
                                    fontSize: "0.65rem",
                                    padding: "0.1rem 0.3rem",
                                    lineHeight: 1,
                                  }}
                                  title="Descendre"
                                >
                                  ↓
                                </button>
                              )}
                          </div>
                        )}
                        <button
                          onClick={() => deleteStint(stint.id)}
                          className="btn btn-danger btn-sm"
                          style={{ padding: "0.15rem 0.4rem" }}
                        >
                          ×
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      {!archived && (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
        >
          {projectedFinish && raceEndTime && projectedFinish >= raceEndTime && (
            <div
              style={{
                fontSize: "0.82rem",
                color: "#d4904a",
                padding: "0.5rem 0.75rem",
                background: "#2a1a00",
                border: "1px solid #a06020",
                borderRadius: "3px",
              }}
            >
              ⚠️ La course est déjà couverte par les relais planifiés.
            </div>
          )}
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <button onClick={addStint} className="btn btn-secondary">
              + Ajouter un relais
            </button>
            {stints.length > 0 && (
              <button
                onClick={clearAllStints}
                className="btn btn-danger btn-sm"
              >
                Tout supprimer
              </button>
            )}
          </div>
        </div>
      )}
      {/* Recalc preview modal */}
      {showRecalcModal && (
        <RecalcModal
          diffs={recalcDiffs}
          raceEndDiff={recalcRaceEndDiff}
          onConfirm={applyRecalc}
          onCancel={() => {
            setShowRecalcModal(false);
            setRecalcMergedPerf(null);
          }}
          saving={recalcSaving}
        />
      )}
    </div>
  );
}
