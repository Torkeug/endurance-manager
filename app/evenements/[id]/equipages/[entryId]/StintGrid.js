"use client";
import { useState, useEffect, useRef } from "react";
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
// selectFuelPerLap — 4-step fuel fallback chains, same-precip priority.
// Returns { value, tier } or null.
// Tier: 1=specific, 2=proxy (different condition, no modifiers).
// Mirrors resolveFuel() in PerformanceData.js — keep in sync when modifying chains.
function selectFuelPerLap(perf, rain, isNight) {
  if (!perf) return null;
  const condition = rain ? (isNight ? "NW" : "DW") : isNight ? "ND" : "DD";
  const chains = {
    DD: ["fuel_dry", "fuel_night_dry", "fuel_wet", "fuel_night_wet"],
    DW: ["fuel_wet", "fuel_night_wet", "fuel_dry", "fuel_night_dry"],
    ND: ["fuel_night_dry", "fuel_dry", "fuel_night_wet", "fuel_wet"],
    NW: ["fuel_night_wet", "fuel_wet", "fuel_night_dry", "fuel_dry"],
  };
  for (let i = 0; i < chains[condition].length; i++) {
    const val = perf[chains[condition][i]];
    // subTier: null — only populated externally when this result becomes a team average.
    if (val != null)
      return { value: val, tier: i === 0 ? 1 : 2, subTier: null };
  }
  return null;
}

// resolveLapTimeCalc — 4-step lap time fallback chains with signed modifier composition.
// Returns { value, tier } or null.
// Tier: 1=specific, 2=modifier-derived (all non-zero), 3=zero-modifier path (low confidence).
// Tier 4 (team average) is assigned externally in calculateAllStints.
// Mirrors resolveLapTime() in PerformanceData.js — keep in sync when modifying chains.
function resolveLapTimeCalc(
  perf,
  condition,
  { dayWetAdd = 0, nightDryAdd = 0, nightWetAdd = 0 } = {},
) {
  if (!perf) return null;
  // Attempt one path: source field + array of signed modifier deltas.
  // Returns { value, tier } or null if source is null or result ≤ 0.
  const tryPath = (source, mods = []) => {
    if (source == null) return null;
    const val = source + mods.reduce((s, m) => s + m, 0);
    if (val <= 0) return null;
    if (mods.length === 0) return { value: val, tier: 1, subTier: null };
    // Tier 3 when any modifier in this path is zero/unset — result is low-confidence.
    // subTier: null here — only populated externally when this result becomes a team average.
    return {
      value: val,
      tier: mods.some((m) => m === 0) ? 3 : 2,
      subTier: null,
    };
  };
  switch (condition) {
    case "DD":
      return (
        tryPath(perf.lap_time_dry) ||
        tryPath(perf.lap_time_wet, [-dayWetAdd]) ||
        tryPath(perf.lap_time_night_dry, [-nightDryAdd]) ||
        tryPath(perf.lap_time_night_wet, [-dayWetAdd, -nightWetAdd]) ||
        null
      );
    case "DW":
      return (
        tryPath(perf.lap_time_wet) ||
        tryPath(perf.lap_time_dry, [dayWetAdd]) ||
        tryPath(perf.lap_time_night_wet, [-nightWetAdd]) ||
        tryPath(perf.lap_time_night_dry, [dayWetAdd, -nightDryAdd]) ||
        null
      );
    case "ND":
      return (
        tryPath(perf.lap_time_night_dry) ||
        tryPath(perf.lap_time_dry, [nightDryAdd]) ||
        tryPath(perf.lap_time_wet, [-dayWetAdd, nightDryAdd]) ||
        tryPath(perf.lap_time_night_wet, [
          -dayWetAdd,
          -nightWetAdd,
          nightDryAdd,
        ]) ||
        null
      );
    case "NW":
      return (
        tryPath(perf.lap_time_night_wet) ||
        tryPath(perf.lap_time_wet, [nightWetAdd]) ||
        tryPath(perf.lap_time_dry, [dayWetAdd, nightWetAdd]) ||
        tryPath(perf.lap_time_night_dry, [
          -nightDryAdd,
          dayWetAdd,
          nightWetAdd,
        ]) ||
        null
      );
    default:
      return null;
  }
}

// computeTeamAverages — averages each perf field across all drivers who have it.
// Returns a perf-shaped object (null per field when no driver has it).
// Used as tier-4 fallback in calcStint when a driver has no resolvable data.
function computeTeamAverages(driverPerf) {
  const fields = [
    "lap_time_dry",
    "lap_time_wet",
    "lap_time_night_dry",
    "lap_time_night_wet",
    "fuel_dry",
    "fuel_wet",
    "fuel_night_dry",
    "fuel_night_wet",
  ];
  const sums = Object.fromEntries(fields.map((f) => [f, 0]));
  const counts = Object.fromEntries(fields.map((f) => [f, 0]));
  Object.values(driverPerf).forEach((perf) => {
    if (!perf) return;
    fields.forEach((f) => {
      if (perf[f] != null) {
        sums[f] += perf[f];
        counts[f]++;
      }
    });
  });
  return Object.fromEntries(
    fields.map((f) => [f, counts[f] > 0 ? sums[f] / counts[f] : null]),
  );
}

// markerFromTier — superscript character for a given fallback tier.
function markerFromTier(tier) {
  if (tier === 2) return "*";
  if (tier === 3) return "~";
  if (tier === 4) return "†";
  return "";
}

// tierTextColor — text color for a given fallback tier.
// baseColor is returned for tier 1 (specific data, no estimation).
function tierTextColor(tier, baseColor = "var(--text)") {
  if (!tier || tier === 1) return baseColor;
  if (tier === 2) return "#c9a84c"; // amber — modifier-derived
  if (tier === 3) return "#a07830"; // dim amber — zero modifier
  if (tier === 4) return "#4a9fd4"; // blue — team average
  return "var(--text-dim)";
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
  // teamAverages: tier-4 fallback when driver has no resolvable perf data
  teamAverages = null,
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

  // Modifier values — used in lap time fallback chain composition
  const dayWetAdd = teamEntry?.day_wet_add_seconds || 0;
  const nightDryAdd = teamEntry?.night_dry_add_seconds || 0;
  const nightWetAdd = teamEntry?.night_wet_add_seconds || 0;
  const mods = { dayWetAdd, nightDryAdd, nightWetAdd };

  // Condition code for this stint — drives fallback chain selection
  const condition = stint.rain
    ? isNight
      ? "NW"
      : "DW"
    : isNight
      ? "ND"
      : "DD";

  // Lap time: driver-specific fallback chain first, then team average (tier 4)
  let resolvedLap = resolveLapTimeCalc(perf, condition, mods);
  if (!resolvedLap && teamAverages) {
    const avgLap = resolveLapTimeCalc(teamAverages, condition, mods);
    // Propagate avgLap.tier as subTier — records how the average itself was derived
    // (e.g. subTier 3 = team avg resolved via zero-modifier path, double low-confidence)
    if (avgLap)
      resolvedLap = { value: avgLap.value, tier: 4, subTier: avgLap.tier };
  }
  const lapTimeSec = resolvedLap?.value ?? null;
  const lapTimeTier = resolvedLap?.tier ?? null;
  const lapTimeSubTier = resolvedLap?.subTier ?? null;

  // Fuel: driver-specific fallback chain first, then team average (tier 4)
  let resolvedFuel = selectFuelPerLap(perf, stint.rain, isNight);
  if (!resolvedFuel && teamAverages) {
    const avgFuel = selectFuelPerLap(teamAverages, stint.rain, isNight);
    // Propagate avgFuel.tier as subTier — same pattern as lap time above
    if (avgFuel)
      resolvedFuel = { value: avgFuel.value, tier: 4, subTier: avgFuel.tier };
  }
  const fuelPerLap = resolvedFuel?.value ?? null;
  const fuelTier = resolvedFuel?.tier ?? null;
  const fuelSubTier = resolvedFuel?.subTier ?? null;

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
    // Fallback tier: null=no data, 1=specific, 2=modifier, 3=zero-modifier, 4=team avg
    _lapTimeTier: lapTimeTier,
    // subTier: how the team average was itself resolved (only set when _lapTimeTier === 4)
    _lapTimeSubTier: lapTimeSubTier,
    _fuelUsed: fuelUsed,
    _fuelPerLap: fuelPerLap,
    _fuelTier: fuelTier,
    // subTier: how the team average was itself resolved (only set when _fuelTier === 4)
    _fuelSubTier: fuelSubTier,
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
  startOffsetMinutes = 0,
) {
  // Compute team averages once — passed to every calcStint call as tier-4 fallback
  const teamAverages = computeTeamAverages(driverPerf);
  const raceStartRaw = teamEntry?.event_start_times?.irl_start;
  // Apply strategy start offset — shifts the effective green-flag time without changing
  // event config. Models delayed starts (practice + qualif + formation lap padding).
  const raceStart = raceStartRaw
    ? new Date(
        new Date(raceStartRaw).getTime() + startOffsetMinutes * 60 * 1000,
      )
    : null;
  const raceEnd =
    raceStart && teamEntry?.events?.duration_minutes
      ? new Date(
          raceStart.getTime() + teamEntry.events.duration_minutes * 60 * 1000,
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
      teamAverages,
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
        const fuelPerLap =
          coveringStint._fuelPerLap ||
          selectFuelPerLap(
            driverPerf[coveringStint.driver_id],
            coveringStint.rain,
            coveringStint._phase === "🌑",
          )?.value;
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
      .map(
        (id) =>
          selectFuelPerLap(driverPerf[id], lastStint.rain, lastIsNight)?.value,
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
        .map((id) => selectFuelPerLap(driverPerf[id], st.rain, isNight)?.value)
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

// ─── Activate-before-delete modal ────────────────────────────────────────────
// Shown when the user tries to delete the currently active strategy.
// Forces them to pick a replacement before deletion proceeds —
// avoids leaving Race Mode without an active strategy.
function ActivateBeforeDeleteModal({ modal, strategies, onConfirm, onCancel }) {
  const [chosenId, setChosenId] = useState(modal?.defaultId || "");

  // Reset selection if modal changes (e.g. re-opened for a different strategy)
  useEffect(() => {
    setChosenId(modal?.defaultId || "");
  }, [modal?.defaultId]);

  if (!modal) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1.5rem",
      }}
    >
      <div className="card" style={{ maxWidth: "440px", width: "100%" }}>
        <h3 style={{ marginBottom: "0.5rem" }}>
          Supprimer {modal.strategyName}
        </h3>
        <p
          style={{
            fontSize: "0.85rem",
            color: "var(--text-dim)",
            marginBottom: "1.25rem",
          }}
        >
          Cette stratégie est{" "}
          <strong style={{ color: "#c9a84c" }}>active</strong> — Race Mode
          l&apos;utilise actuellement. Choisissez une stratégie de remplacement
          avant de la supprimer.
        </p>
        {/* Replacement strategy selector */}
        <div style={{ marginBottom: "1.25rem" }}>
          <label
            style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-dim)",
              display: "block",
              marginBottom: "0.4rem",
            }}
          >
            Nouvelle stratégie active
          </label>
          <select
            value={chosenId}
            onChange={(e) => setChosenId(e.target.value)}
            style={{
              width: "100%",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "3px",
              color: "var(--text)",
              fontSize: "0.85rem",
              padding: "0.4rem 0.6rem",
            }}
          >
            <option value="">— Sélectionner —</option>
            {strategies
              .filter((s) => s.id !== modal.strategyId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.description ? ` — ${s.description}` : ""}
                </option>
              ))}
          </select>
        </div>
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
        >
          <button
            onClick={() => chosenId && onConfirm(chosenId)}
            className="btn btn-danger"
            disabled={!chosenId}
          >
            Supprimer et activer la sélection
          </button>
          <button onClick={onCancel} className="btn btn-secondary">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Clear driver stints modal ───────────────────────────────────────────────
// Shown before clearing all eligible stints for a specific driver.
// Replaces native confirm() for consistency with the rest of the app.
function ClearDriverStintsModal({ modal, onConfirm, onCancel }) {
  if (!modal) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1.5rem",
      }}
    >
      <div className="card" style={{ maxWidth: "420px", width: "100%" }}>
        <h3 style={{ marginBottom: "0.75rem" }}>
          Libérer les relais de {modal.driverName}
        </h3>
        <p
          style={{
            fontSize: "0.9rem",
            color: "var(--text-dim)",
            marginBottom: "1.5rem",
          }}
        >
          Les{" "}
          <strong style={{ color: "var(--text)" }}>
            {modal.stintCount} relais éligibles
          </strong>{" "}
          de{" "}
          <strong style={{ color: "var(--text)" }}>{modal.driverName}</strong>{" "}
          seront vidés. Les données (tours, notes) seront effacées mais les
          créneaux resteront dans le planning. Le pilote pourra être restauré
          lors d&apos;une réassignation.
        </p>
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
        >
          <button onClick={onConfirm} className="btn btn-primary">
            Confirmer
          </button>
          <button onClick={onCancel} className="btn btn-secondary">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Simple confirmation modal ────────────────────────────────────────────────
// Reusable yes/no modal — replaces native confirm() for clearAllStints
// and deleteStint, consistent with the rest of the app's modal pattern.
function ConfirmModal({ modal, onConfirm, onCancel }) {
  if (!modal) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1.5rem",
      }}
    >
      <div className="card" style={{ maxWidth: "400px", width: "100%" }}>
        <h3 style={{ marginBottom: "0.75rem" }}>{modal.title}</h3>
        <p
          style={{
            fontSize: "0.9rem",
            color: "var(--text-dim)",
            marginBottom: "1.5rem",
          }}
        >
          {modal.message}
        </p>
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
        >
          <button onClick={onConfirm} className="btn btn-danger">
            {modal.confirmLabel || "Confirmer"}
          </button>
          <button onClick={onCancel} className="btn btn-secondary">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
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
  autoOpenRecalc = false,
  onAutoOpenHandled = null,
  // Lifts the active strategy up to EquipageTabs so RaceMode can use it
  // without a redundant fetch
  onActiveStrategyChange = null,
}) {
  // Strategy state — strategies fetched from DB, selectedStrategyId is the viewed tab
  const [strategies, setStrategies] = useState([]);
  const [selectedStrategyId, setSelectedStrategyId] = useState(null);
  // Local edit fields for selected strategy metadata — synced via useEffect on strategy switch
  const [strategyName, setStrategyName] = useState("");
  const [strategyDesc, setStrategyDesc] = useState("");
  const [strategyOffset, setStrategyOffset] = useState(0);

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
  // The strategy object for the currently selected tab
  const currentStrategy =
    strategies.find((s) => s.id === selectedStrategyId) ||
    strategies[0] ||
    null;

  // Controls the activate-before-delete modal — shown when deleting the active strategy
  const [activateBeforeDeleteModal, setActivateBeforeDeleteModal] =
    useState(null);
  // null | { strategyId, strategyName, defaultId }

  // Controls the clear driver stints confirmation modal
  const [clearDriverModal, setClearDriverModal] = useState(null);
  // null | { driverId, driverName, stintCount }

  // Touch device detection — coarse pointer = mobile = show arrow buttons
  // instead of drag-and-drop which is unreliable on touch screens.
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  // Index of the row currently being dragged over — used for visual highlight
  const [dragOverIndex, setDragOverIndex] = useState(null);
  // Index of the row being dragged — used to prevent self-drop
  const [draggingIndex, setDraggingIndex] = useState(null);

  // Controls the shared confirm modal for deleteStint and clearAllStints
  const [confirmModal, setConfirmModal] = useState(null);
  // null | { title, message, confirmLabel, onConfirm }

  // Guard against concurrent default-strategy creation — the async insert can race
  // with a re-render that re-fires the effect before the first insert completes.
  const creatingDefaultStrategy = useRef(false);

  // Single parallel fetch — strategies + stints + perf + avail in one Promise.all.
  // Eliminates the previous two-step waterfall (strategies first → then stints).
  useEffect(() => {
    if (!teamEntryId) return;
    setLoading(true);
    Promise.all([
      supabase
        .from("strategies")
        .select("*")
        .eq("team_entry_id", teamEntryId)
        .order("sort_order"),
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
    ]).then(async ([
      { data: stratsData },
      { data: stintsData },
      { data: perfData },
      { data: availData },
      { data: otherStints },
    ]) => {
      // ── Strategies ────────────────────────────────────────────────────────
      let strats = stratsData || [];

      // New team entry — no strategy exists yet (created after migration backfill).
      // Auto-create the default so the grid can load normally.
      if (strats.length === 0 && !archived) {
        if (creatingDefaultStrategy.current) return;
        creatingDefaultStrategy.current = true;
        const { data: newStrat } = await supabase
          .from("strategies")
          .insert({
            team_entry_id: teamEntryId,
            name: "Stratégie 1",
            sort_order: 1,
            is_active: true,
            actual_start_offset_minutes:
              teamEntry?.events?.green_flag_offset_minutes || 0,
          })
          .select()
          .single();
        creatingDefaultStrategy.current = false;
        if (newStrat) {
          strats = [newStrat];
        } else {
          setLoading(false);
          return;
        }
      }

      // Determine active strategy — preserve existing tab selection if still valid
      const resolvedStratId =
        selectedStrategyId && strats.find((s) => s.id === selectedStrategyId)
          ? selectedStrategyId
          : strats.find((s) => s.is_active)?.id || strats[0]?.id || null;

      setStrategies(strats);
      onActiveStrategyChange?.(strats.find((s) => s.is_active) || null);
      setSelectedStrategyId(resolvedStratId);

      // ── Perf + avail + conflicts ───────────────────────────────────────────
      const perfMap = {};
      (perfData || []).forEach((p) => { perfMap[p.driver_id] = p; });
      setDriverPerf(perfMap);

      const availMap = {};
      (availData || []).forEach((a) => {
        const key = `${a.driver_id}_${new Date(a.slot_start).toISOString()}`;
        availMap[key] = a;
      });
      setAvailabilities(availMap);
      setConflictStints(otherStints || []);

      // ── Stints — filter to resolved strategy ──────────────────────────────
      const loadedStints = (stintsData || []).filter(
        (s) => s.strategy_id === resolvedStratId,
      );
      setStints(loadedStints);
      setLoading(false);

      // Auto-generate stints for first strategy only when none exist
      if (loadedStints.length === 0 && !autoGenDone && !archived && strats.length === 1) {
        setAutoGenDone(true);
        const count = estimateStintCount(teamEntry, perfMap, assignedDrivers);
        const rows = Array.from({ length: count }, (_, i) => ({
          team_entry_id: teamEntryId,
          strategy_id: resolvedStratId,
          stint_number: i + 1,
          rain: false,
          tyre_change: false,
        }));
        supabase
          .from("stints")
          .insert(rows)
          .select()
          .then(({ data }) => { if (data) setStints(data); });
      }
    });
  }, [teamEntryId, JSON.stringify(driverIds)]);

  // Sync local edit fields when the selected strategy changes
  useEffect(() => {
    if (!currentStrategy) return;
    setStrategyName(currentStrategy.name || "");
    setStrategyDesc(currentStrategy.description || "");
    setStrategyOffset(currentStrategy.actual_start_offset_minutes || 0);
  }, [currentStrategy?.id]);

  // Guard: if the selected strategy was deleted, fall back to first available
  useEffect(() => {
    if (strategies.length > 0 && !strategies.find((s) => s.id === selectedStrategyId)) {
      setSelectedStrategyId(strategies[0].id);
    }
  }, [strategies]);

  // Strategy switch — lightweight targeted fetch for just the new strategy's stints.
  // Perf/avail/conflict data is already loaded and shared across all strategies.
  useEffect(() => {
    if (!selectedStrategyId || !teamEntryId || loading) return;
    supabase
      .from("stints")
      .select("*")
      .eq("strategy_id", selectedStrategyId)
      .order("stint_number")
      .then(({ data }) => { setStints(data || []); });
  }, [selectedStrategyId]);

  const calculated = calculateAllStints(
    stints,
    teamEntry,
    driverPerf,
    igStartTime,
    igSunrise,
    igSunset,
    strategyOffset, // live local state — updates on every keystroke, not just on blur
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

    // Rerun calculation with merged perf — preserve current strategy offset
    const recalculated = calculateAllStints(
      stints,
      teamEntry,
      mergedPerf,
      igStartTime,
      igSunrise,
      igSunset,
      strategyOffset,
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

    // Rerun with merged perf to get final laps — preserve current strategy offset
    const recalculated = calculateAllStints(
      stints,
      teamEntry,
      recalcMergedPerf,
      igStartTime,
      igSunrise,
      igSunset,
      strategyOffset,
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

  // ── Strategy CRUD handlers ──────────────────────────────────────────────────

  const handleCreateStrategy = async () => {
    if (strategies.length >= 5 || archived) return;
    const nextSort =
      strategies.length > 0
        ? Math.max(...strategies.map((s) => s.sort_order)) + 1
        : 1;
    const { data } = await supabase
      .from("strategies")
      .insert({
        team_entry_id: teamEntryId,
        name: `Stratégie ${nextSort}`,
        sort_order: nextSort,
        is_active: false,
        // Pre-fill from event-level green flag offset — driver can override per strategy
        actual_start_offset_minutes:
          teamEntry?.events?.green_flag_offset_minutes || 0,
      })
      .select()
      .single();
    if (data) {
      setStrategies((prev) => [...prev, data]);
      setSelectedStrategyId(data.id);
    }
  };

  const handleUpdateStrategy = async (id, fields) => {
    if (archived) return;
    await supabase.from("strategies").update(fields).eq("id", id);
    // Only update the fields that changed — don't touch is_active on other strategies
    setStrategies((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...fields } : s)),
    );
  };

  const handleDeleteStrategy = (id) => {
    if (archived || strategies.length <= 1) return;
    const strat = strategies.find((s) => s.id === id);

    if (strat?.is_active) {
      // Active strategy — force user to pick a replacement first
      const remaining = strategies.filter((s) => s.id !== id);
      setActivateBeforeDeleteModal({
        strategyId: id,
        strategyName: strat.name,
        // Pre-select first remaining strategy as a sensible default
        defaultId: remaining[0]?.id || "",
      });
      return;
    }

    // Non-active strategy — standard confirm modal
    setConfirmModal({
      title: `Supprimer ${strat?.name || "cette stratégie"}`,
      message:
        "Tous les relais de cette stratégie seront supprimés définitivement. Cette action est irréversible.",
      confirmLabel: "Supprimer",
      onConfirm: async () => {
        setConfirmModal(null);
        // Cascade on FK deletes all stints for this strategy automatically
        await supabase.from("strategies").delete().eq("id", id);
        setStrategies((prev) => prev.filter((s) => s.id !== id));
      },
    });
  };

  // Callback from ActivateBeforeDeleteModal — activates chosenId, then deletes the old one
  const commitDeleteActiveStrategy = async (chosenId) => {
    const { strategyId } = activateBeforeDeleteModal;
    setActivateBeforeDeleteModal(null);

    // Activate chosen replacement first — keeps Race Mode uninterrupted
    await supabase
      .from("strategies")
      .update({ is_active: false })
      .eq("team_entry_id", teamEntryId);
    await supabase
      .from("strategies")
      .update({ is_active: true })
      .eq("id", chosenId);

    // Delete old strategy — cascade removes its stints
    await supabase.from("strategies").delete().eq("id", strategyId);

    const updated = strategies
      .filter((s) => s.id !== strategyId)
      .map((s) => ({ ...s, is_active: s.id === chosenId }));
    setStrategies(updated);
    onActiveStrategyChange?.(updated.find((s) => s.is_active) || null);

    // Switch view to the newly active strategy
    setSelectedStrategyId(chosenId);
  };

  const handleSetActive = (id) => {
    if (archived) return;
    const strat = strategies.find((s) => s.id === id);
    setConfirmModal({
      title: "Changer la stratégie active",
      message: `Race Mode utilisera désormais "${strat?.name || "cette stratégie"}".`,
      confirmLabel: "Confirmer",
      onConfirm: async () => {
        setConfirmModal(null);
        // Deactivate all, then activate the chosen one
        await supabase
          .from("strategies")
          .update({ is_active: false })
          .eq("team_entry_id", teamEntryId);
        await supabase
          .from("strategies")
          .update({ is_active: true })
          .eq("id", id);
        setStrategies((prev) =>
          prev.map((s) => ({ ...s, is_active: s.id === id })),
        );
      },
    });
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
          strategy_id: currentStrategy?.id || null, // link new stints to the current strategy
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

  const deleteStint = (stintId) => {
    if (archived) return;
    setConfirmModal({
      title: "Supprimer ce relais",
      message:
        "Ce relais sera supprimé définitivement. Cette action est irréversible.",
      confirmLabel: "Supprimer",
      onConfirm: async () => {
        setConfirmModal(null);
        await supabase.from("stints").delete().eq("id", stintId);
        setStints((prev) => prev.filter((s) => s.id !== stintId));
      },
    });
  };

  const clearAllStints = () => {
    if (archived) return;
    setConfirmModal({
      title: "Supprimer tous les relais",
      message:
        "Tous les relais de cet équipage seront supprimés définitivement. Cette action est irréversible.",
      confirmLabel: "Tout supprimer",
      onConfirm: async () => {
        setConfirmModal(null);
        // Delete stints for the current strategy only — other strategies unaffected
        await supabase
          .from("stints")
          .delete()
          .eq("strategy_id", selectedStrategyId);
        setStints([]);
      },
    });
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

  // Shows a confirmation modal before clearing all eligible stints for a driver.
  // Nulls driver-specific fields and stores previous_driver_id for potential
  // restore on reassignment.
  const clearDriverStints = (driverId) => {
    if (archived) return;
    const driver = assignedDrivers.find((d) => d.drivers?.id === driverId);
    const driverName = driver?.drivers?.name || "ce pilote";
    const stintCount = calculated.filter(
      (s) => s.driver_id === driverId && isEligible(s),
    ).length;
    if (stintCount === 0) return;
    setClearDriverModal({ driverId, driverName, stintCount });
  };

  const commitClearDriverStints = async () => {
    const { driverId } = clearDriverModal;
    setClearDriverModal(null);

    const targetStints = calculated.filter(
      (s) => s.driver_id === driverId && isEligible(s),
    );
    if (targetStints.length === 0) return;

    const payload = {
      driver_id: null,
      previous_driver_id: driverId,
      laps_planned: null,
      rain: false,
      tyre_change: false,
      notes: null,
      irl_end_actual: null,
    };

    // Optimistic update
    setStints((prev) =>
      prev.map((s) =>
        targetStints.find((t) => t.id === s.id) ? { ...s, ...payload } : s,
      ),
    );

    await Promise.all(
      targetStints.map((s) =>
        supabase.from("stints").update(payload).eq("id", s.id),
      ),
    );
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

  // effectiveStartTime applies the strategy offset — matches what calculateAllStints uses
  const effectiveStartTime = teamEntry?.event_start_times?.irl_start
    ? new Date(
        new Date(teamEntry.event_start_times.irl_start).getTime() +
          strategyOffset * 60 * 1000,
      )
    : null;
  const raceEndTime =
    effectiveStartTime && event?.duration_minutes
      ? new Date(
          effectiveStartTime.getTime() + event.duration_minutes * 60 * 1000,
        )
      : null;

  const lastCalc = calculated[calculated.length - 1];
  const projectedFinish = lastCalc?._adjustedIrlEnd || lastCalc?._irlEnd;

  return (
    <div>
      {/* ── Strategy tab bar ─────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          gap: "0.25rem",
          borderBottom: "1px solid var(--border)",
          marginBottom: "0.75rem",
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          alignItems: "flex-end",
        }}
      >
        {strategies.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelectedStrategyId(s.id)}
            style={{
              padding: "0.5rem 1rem",
              background: "transparent",
              border: "none",
              borderBottom:
                selectedStrategyId === s.id
                  ? "2px solid var(--accent)"
                  : "2px solid transparent",
              color:
                selectedStrategyId === s.id
                  ? "var(--accent)"
                  : "var(--text-dim)",
              fontFamily: "var(--font-rajdhani), sans-serif",
              fontSize: "0.85rem",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: "pointer",
              marginBottom: "-1px",
              whiteSpace: "nowrap",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
            }}
          >
            {/* ★ marks the strategy used by Race Mode */}
            {s.is_active && (
              <span
                title="Stratégie active — utilisée par Race Mode"
                style={{ color: "#c9a84c", fontSize: "0.75rem" }}
              >
                ★
              </span>
            )}
            {s.name}
          </button>
        ))}
        {/* Add strategy — hidden when at cap (5) or archived */}
        {!archived && strategies.length < 5 && (
          <button
            onClick={handleCreateStrategy}
            style={{
              padding: "0.4rem 0.75rem",
              background: "transparent",
              border: "none",
              borderBottom: "2px solid transparent",
              color: "var(--text-dim)",
              fontFamily: "var(--font-rajdhani), sans-serif",
              fontSize: "0.85rem",
              fontWeight: 700,
              cursor: "pointer",
              marginBottom: "-1px",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
            title="Ajouter une stratégie (max 5)"
          >
            + Nouvelle
          </button>
        )}
      </div>

      {/* ── Strategy controls — editable metadata for the selected strategy ── */}
      {currentStrategy && !archived && (
        <div
          style={{
            marginBottom: "1rem",
            padding: "0.75rem 1rem",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "4px",
            display: "flex",
            flexWrap: "wrap",
            gap: "1rem",
            alignItems: "flex-end",
          }}
        >
          {/* Name — inline edit, auto-save on blur */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
              minWidth: "140px",
            }}
          >
            <label
              style={{
                fontSize: "0.65rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--text-dim)",
              }}
            >
              Nom
            </label>
            <input
              type="text"
              value={strategyName}
              onChange={(e) => setStrategyName(e.target.value)}
              onBlur={() => {
                const trimmed = strategyName.trim();
                // Revert to saved name if blank
                if (!trimmed) {
                  setStrategyName(currentStrategy.name);
                  return;
                }
                handleUpdateStrategy(currentStrategy.id, { name: trimmed });
              }}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "3px",
                color: "var(--text)",
                fontSize: "0.82rem",
                padding: "0.3rem 0.5rem",
                fontFamily: "var(--font-rajdhani), sans-serif",
                fontWeight: 700,
              }}
            />
          </div>

          {/* Description — inline edit, auto-save on blur */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
              flex: 1,
              minWidth: "180px",
            }}
          >
            <label
              style={{
                fontSize: "0.65rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--text-dim)",
              }}
            >
              Description
            </label>
            <input
              type="text"
              placeholder="ex : Plan nominal — météo sèche"
              value={strategyDesc}
              onChange={(e) => setStrategyDesc(e.target.value)}
              onBlur={() =>
                handleUpdateStrategy(currentStrategy.id, {
                  description: strategyDesc.trim() || null,
                })
              }
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "3px",
                color: "var(--text)",
                fontSize: "0.82rem",
                padding: "0.3rem 0.5rem",
              }}
            />
          </div>

          {/* Start offset — shifts the effective green-flag time for this strategy */}
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}
          >
            <label
              style={{
                fontSize: "0.65rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--text-dim)",
              }}
              title="Minutes entre l'heure officielle de départ et le drapeau vert effectif"
            >
              Décalage départ
            </label>
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
            >
              <input
                type="number"
                value={strategyOffset}
                min={-60}
                max={120}
                onChange={(e) =>
                  setStrategyOffset(parseInt(e.target.value) || 0)
                }
                onBlur={() =>
                  handleUpdateStrategy(currentStrategy.id, {
                    actual_start_offset_minutes: strategyOffset,
                  })
                }
                style={{
                  width: "64px",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "3px",
                  color: "var(--text)",
                  fontSize: "0.82rem",
                  padding: "0.3rem 0.5rem",
                  fontFamily: "var(--font-mono), monospace",
                }}
              />
              <span style={{ fontSize: "0.82rem", color: "var(--text-dim)" }}>
                min
              </span>
            </div>
          </div>

          {/* Active badge / Set active button + Delete */}
          <div
            style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}
          >
            {currentStrategy.is_active ? (
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "#c9a84c",
                  padding: "0.3rem 0.6rem",
                  background: "rgba(201,168,76,0.08)",
                  border: "1px solid rgba(201,168,76,0.3)",
                  borderRadius: "3px",
                  whiteSpace: "nowrap",
                }}
              >
                ★ Active
              </span>
            ) : (
              <button
                onClick={() => handleSetActive(currentStrategy.id)}
                className="btn btn-secondary btn-sm"
                style={{
                  borderColor: "#a06020",
                  color: "#d4904a",
                  whiteSpace: "nowrap",
                }}
                title="Définir comme stratégie utilisée par Race Mode"
              >
                ★ Définir comme active
              </button>
            )}
            {strategies.length > 1 && (
              <button
                onClick={() => handleDeleteStrategy(currentStrategy.id)}
                className="btn btn-danger btn-sm"
                title="Supprimer cette stratégie et tous ses relais"
              >
                Supprimer
              </button>
            )}
          </div>
        </div>
      )}

      {/* Strategy description — read-only when archived */}
      {currentStrategy && archived && currentStrategy.description && (
        <div
          style={{
            marginBottom: "0.75rem",
            fontSize: "0.82rem",
            color: "var(--text-dim)",
            fontStyle: "italic",
          }}
        >
          {currentStrategy.description}
        </div>
      )}

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
            // Show effective start (with offset) so displayed time matches the engine
            value: formatDatetime(
              effectiveStartTime || teamEntry.event_start_times?.irl_start,
            ),
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

      {/* ── Per-driver stint clear ───────────────────────────────────────────
      Only shown when at least one driver has eligible stints assigned.
      Placed above the grid so the action is clearly associated with
      the planning data, not the global delete actions below. */}
      {!archived &&
        (() => {
          const driversWithEligibleStints = assignedDrivers.filter((d) =>
            calculated.some(
              (s) => s.driver_id === d.drivers?.id && isEligible(s),
            ),
          );
          if (driversWithEligibleStints.length === 0) return null;
          return (
            <div
              style={{
                marginBottom: "1rem",
                padding: "0.75rem 1rem",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: "4px",
              }}
            >
              <div
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-dim)",
                  marginBottom: "0.6rem",
                }}
              >
                Libérer les relais d&apos;un pilote
              </div>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {driversWithEligibleStints.map((d) => {
                  const eligibleCount = calculated.filter(
                    (s) => s.driver_id === d.drivers?.id && isEligible(s),
                  ).length;
                  return (
                    <button
                      key={d.drivers?.id}
                      onClick={() => clearDriverStints(d.drivers?.id)}
                      className="btn btn-secondary btn-sm"
                      style={{ borderColor: "#a06020", color: "#d4904a" }}
                      title={`Retirer ${d.drivers?.name} de ses ${eligibleCount} relais éligibles`}
                    >
                      ✕ {d.drivers?.name}{" "}
                      <span
                        className="mono"
                        style={{ fontSize: "0.72rem", opacity: 0.8 }}
                      >
                        ({eligibleCount})
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

      {/* Legend — line 1: availability dots */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          marginBottom: "0.25rem",
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
      {/* Legend — line 2: data estimation tiers, with border-tint swatch for each */}
      <div
        style={{
          display: "flex",
          gap: "1.25rem",
          marginBottom: "0.5rem",
          fontSize: "0.72rem",
          color: "var(--text-dim)",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <span style={{ fontWeight: 700, color: "var(--text)" }}>Données :</span>
        {[
          { color: "#c9a84c", marker: "*", label: "modificateur équipage" },
          {
            color: "#a07830",
            marker: "~",
            label: "sans modificateur configuré",
          },
          { color: "#4a9fd4", marker: "†", label: "moyenne équipe" },
        ].map(({ color, marker, label }) => (
          <span
            key={marker}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
          >
            {/* Colored bar matches the row left-border tint for this tier */}
            <span
              style={{
                display: "inline-block",
                width: "3px",
                height: "14px",
                background: color,
                borderRadius: "1px",
                flexShrink: 0,
              }}
            />
            <span>
              <span style={{ color }}>{marker}</span> {label}
            </span>
          </span>
        ))}
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
              <th style={{ ...TH, width: "140px" }}>Notes</th>
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
                    12 +
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

              // Left-border style — reflects worst data tier across lap and fuel.
              // Compound cases (tier 4 + subTier ≥ 2) use a background gradient strip
              // instead of border-image, which is unreliable on <tr> with border-collapse.
              // Returns { borderStyles, gradientBorder } — composed separately below.
              const stintBorderStyle = (() => {
                // Last-stint outcome always takes priority over tier tinting
                if (stint._isLastStint) {
                  return {
                    borderStyles: {
                      borderLeft: stint._doesNotCoverRaceEnd
                        ? "3px solid var(--danger)"
                        : "3px solid #2eb460",
                    },
                    gradientBorder: null,
                  };
                }
                const lapTier = stint._lapTimeTier || 0;
                const lapSub = stint._lapTimeSubTier || 0;
                const fuelTier = stint._fuelTier || 0;
                const fuelSub = stint._fuelSubTier || 0;
                const maxTier = Math.max(lapTier, fuelTier);
                // Only count subTier when the corresponding primary tier is 4
                const maxSub = Math.max(
                  lapTier === 4 ? lapSub : 0,
                  fuelTier === 4 ? fuelSub : 0,
                );
                // Compound: background gradient strip split 50/50 top-to-bottom.
                // border-image is unreliable on <tr> with border-collapse — background
                // gradient is the only cross-browser-reliable way to show two colors.
                if (maxTier >= 4 && maxSub >= 2) {
                  const subColor = maxSub >= 3 ? "#a07830" : "#c9a84c";
                  return {
                    borderStyles: { borderLeft: "none" },
                    gradientBorder: `linear-gradient(to bottom, #4a9fd4 50%, ${subColor} 50%) left / 3px 100% no-repeat`,
                  };
                }
                if (maxTier >= 4)
                  return {
                    borderStyles: { borderLeft: "3px solid #4a9fd4" },
                    gradientBorder: null,
                  };
                if (maxTier >= 3)
                  return {
                    borderStyles: { borderLeft: "3px solid #a07830" },
                    gradientBorder: null,
                  };
                return {
                  borderStyles: { borderLeft: "3px solid transparent" },
                  gradientBorder: null,
                };
              })();

              // Row background — compose gradient border strip on top of the normal row bg.
              // The strip covers only the leftmost 6px; the rest shows the row bg normally.
              const rowBg =
                dragOverIndex === i && draggingIndex !== i
                  ? "rgba(var(--accent-rgb), 0.1)"
                  : stint._isLastStint
                    ? stint._doesNotCoverRaceEnd
                      ? "rgba(224,85,85,0.15)"
                      : "rgba(46,180,96,0.12)"
                    : i % 2 === 0
                      ? "transparent"
                      : "rgba(255,255,255,0.02)";
              // First-cell border style — applied to the # <td> instead of <tr> background,
              // since <tr> background positioning is unreliable with border-collapse: collapse.
              // inset box-shadow for single colors, background gradient for compound splits.
              const firstCellBorderStyle = (() => {
                if (stintBorderStyle.gradientBorder) {
                  const subColor =
                    (stintBorderStyle.gradientBorder.match(/#[a-f0-9]+/gi) ||
                      [])[1] || "#c9a84c";
                  return {
                    backgroundImage: `linear-gradient(to bottom, #4a9fd4 50%, ${subColor} 50%)`,
                    backgroundSize: "3px 100%",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "left",
                    backgroundOrigin: "border-box",
                  };
                }
                const borderColor = (() => {
                  const b = stintBorderStyle.borderStyles?.borderLeft || "";
                  const m = b.match(/#[a-f0-9]+/i);
                  return m ? m[0] : null;
                })();
                return borderColor
                  ? { boxShadow: `inset 3px 0 0 0 ${borderColor}` }
                  : {};
              })();

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
                    background: rowBg,
                    opacity: draggingIndex === i ? 0.4 : isSaving ? 0.6 : 1,
                    cursor:
                      !archived && isEligible(stint) && !isTouchDevice
                        ? "grab"
                        : "default",
                    outline:
                      dragOverIndex === i && draggingIndex !== i
                        ? "2px solid var(--accent)"
                        : "none",
                  }}
                >
                  {/* # — firstCellBorderStyle applied here instead of <tr> for reliable alignment */}
                  <td
                    style={{
                      ...TD,
                      textAlign: "center",
                      ...firstCellBorderStyle,
                    }}
                  >
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
                    {/* Ghost label — shown when slot is empty but has a previous driver.
                    Indicates the slot is "reserved" vs truly unassigned, and hints
                    that reassigning this driver will trigger a restore modal. */}
                    {!stint.driver_id &&
                      stint.previous_driver_id &&
                      (() => {
                        const prevDriver = assignedDrivers.find(
                          (d) => d.drivers?.id === stint.previous_driver_id,
                        );
                        const prevName =
                          prevDriver?.drivers?.name || "Pilote précédent";
                        return (
                          <div
                            style={{
                              marginTop: "0.2rem",
                              fontSize: "0.68rem",
                              color: "var(--text-dim)",
                              fontStyle: "italic",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.25rem",
                            }}
                            title={`Ce créneau appartenait à ${prevName} — réassignez ce pilote pour proposer une restauration`}
                          >
                            <span style={{ opacity: 0.5 }}>↩</span>
                            <span>{prevName}</span>
                          </div>
                        );
                      })()}
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
                          // Use full fallback chain for tank-cap check
                          const fuelPerLap = selectFuelPerLap(
                            driverPerf[stint.driver_id],
                            stint.rain,
                            stint._phase === "🌑",
                          )?.value;
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
                    {/* Tier marker — only when laps are calculated (not manually set) and estimated.
                        Compound marker (e.g. †~) when team avg was itself derived via bad path. */}
                    {!stint.laps_planned &&
                      stint._lapTimeTier >= 2 &&
                      stint._laps && (
                        <div
                          style={{
                            fontSize: "0.65rem",
                            // Primary tier drives color — markers carry the compound detail
                            color: tierTextColor(stint._lapTimeTier),
                            marginTop: "0.1rem",
                          }}
                          title={
                            stint._lapTimeTier === 4
                              ? stint._lapTimeSubTier >= 3
                                ? "Tours calculés via moyenne équipe estimée sans modificateur configuré — fiabilité faible"
                                : stint._lapTimeSubTier === 2
                                  ? "Tours calculés via moyenne équipe estimée via modificateur"
                                  : "Tours calculés via moyenne équipe — données pilote manquantes"
                              : stint._lapTimeTier === 3
                                ? "Tours calculés via modificateur non configuré — fiabilité faible"
                                : "Tours calculés via modificateur équipage"
                          }
                        >
                          {markerFromTier(stint._lapTimeTier)}
                          {stint._lapTimeSubTier >= 2
                            ? markerFromTier(stint._lapTimeSubTier)
                            : ""}{" "}
                          estimé
                        </div>
                      )}
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

                  {/* Fuel — color and compound marker reflect fallback tier when data is estimated */}
                  <td style={TD}>
                    <span
                      className="mono"
                      style={{
                        fontSize: "0.72rem",
                        // Primary tier drives color — subTier detail carried by the marker
                        color: stint._fuelUsed
                          ? tierTextColor(stint._fuelTier, "var(--accent)")
                          : "var(--text-dim)",
                      }}
                      title={
                        stint._fuelTier === 4
                          ? stint._fuelSubTier >= 3
                            ? "Consommation calculée via moyenne équipe estimée sans modificateur configuré — fiabilité faible"
                            : stint._fuelSubTier === 2
                              ? "Consommation calculée via moyenne équipe estimée via modificateur"
                              : "Consommation calculée via moyenne équipe — données pilote manquantes"
                          : stint._fuelTier === 3
                            ? "Consommation calculée via modificateur non configuré — fiabilité faible"
                            : stint._fuelTier === 2
                              ? "Consommation calculée via modificateur équipage"
                              : undefined
                      }
                    >
                      {(stint._fuelUsed ?? stint.fuel_used_calc)
                        ? `${(stint._fuelUsed ?? stint.fuel_used_calc).toFixed(1)}L`
                        : "—"}
                      {/* Compound marker — †~ or †* when team avg was itself derived */}
                      {stint._fuelUsed && stint._fuelTier >= 2 && (
                        <sup style={{ fontSize: "0.65em", marginLeft: "1px" }}>
                          {markerFromTier(stint._fuelTier)}
                          {stint._fuelSubTier >= 2
                            ? markerFromTier(stint._fuelSubTier)
                            : ""}
                        </sup>
                      )}
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
                                <sup
                                  style={{
                                    fontSize: "0.65em",
                                    marginLeft: "2px",
                                    color: "#4a9fd4",
                                  }}
                                  title="Données pilote manquantes pour certains relais — moyenne équipe utilisée"
                                >
                                  †
                                </sup>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                  )}

                  {/* Notes — editable text input, truncated to fit the column */}
                  <td style={{ ...TD, maxWidth: "140px" }}>
                    <input
                      type="text"
                      value={stint.notes || ""}
                      placeholder="—"
                      onChange={(e) =>
                        updateStint(stint.id, "notes", e.target.value || null)
                      }
                      disabled={archived}
                      style={{
                        ...INPUT,
                        width: "130px",
                        opacity: archived ? 0.7 : 1,
                        color: stint.notes ? "var(--text)" : "var(--text-dim)",
                      }}
                      title={stint.notes || ""}
                    />
                  </td>

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

      {/* Shared confirm modal — used by deleteStint and clearAllStints */}
      <ConfirmModal
        modal={confirmModal}
        onConfirm={() => confirmModal?.onConfirm?.()}
        onCancel={() => setConfirmModal(null)}
      />

      {/* Activate-before-delete modal — shown when deleting the active strategy */}
      <ActivateBeforeDeleteModal
        modal={activateBeforeDeleteModal}
        strategies={strategies}
        onConfirm={commitDeleteActiveStrategy}
        onCancel={() => setActivateBeforeDeleteModal(null)}
      />

      {/* Clear driver stints confirmation modal */}
      <ClearDriverStintsModal
        modal={clearDriverModal}
        onConfirm={commitClearDriverStints}
        onCancel={() => setClearDriverModal(null)}
      />
    </div>
  );
}
