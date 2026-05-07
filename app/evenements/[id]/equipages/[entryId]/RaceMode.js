"use client";
import { useState, useEffect, useCallback } from "react";
import { supabaseBrowser as supabase } from "../../../../../lib/supabase-browser";

// markerFromTier — superscript character for a given fallback tier.
// Keep in sync with StintGrid.js.
function markerFromTier(tier) {
  if (tier === 2) return "*";
  if (tier === 3) return "~";
  if (tier === 4) return "†";
  return "";
}

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

// ─── Formatting helpers ──────────────────────────────────────────────────────

function formatTime(date) {
  if (!date) return "—";
  return new Date(date).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatCountdown(sec) {
  if (sec === null || sec === undefined) return "—";
  const absS = Math.abs(sec);
  const d = Math.floor(absS / 86400);
  const h = Math.floor((absS % 86400) / 3600);
  const m = Math.floor((absS % 3600) / 60);
  const s = absS % 60;
  const sign = sec < 0 ? "+" : ""; // negative remaining time = overtime, displayed as positive
  if (d > 0)
    return `${sign}${d}j ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}min ${String(s).padStart(2, "0")}s`;
  if (h > 0)
    return `${sign}${h}h ${String(m).padStart(2, "0")}min ${String(s).padStart(2, "0")}s`;
  return `${sign}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatDuration(sec) {
  if (!sec) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}min`;
  return `${m} min`;
}

// ─── Phase helpers (mirrors StintGrid logic) ─────────────────────────────────

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

// ─── Fuel per lap — mirrors selectFuelPerLap in StintGrid ───────────────────
// Returns { value, tier } or null. Tier: 1=specific, 2=proxy.
// Keep in sync with StintGrid.js when modifying chains.

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
    if (val != null)
      return { value: val, tier: i === 0 ? 1 : 2, subTier: null };
  }
  return null;
}

// ─── Lap time per driver — mirrors resolveLapTimeCalc in StintGrid ────────────
// Returns { value, tier } or null.
// Keep in sync with StintGrid.js when modifying chains.

function selectLapTime(
  perf,
  rain,
  isNight,
  dayWetAdd,
  nightDryAdd,
  nightWetAdd,
) {
  if (!perf) return null;
  const condition = rain ? (isNight ? "NW" : "DW") : isNight ? "ND" : "DD";
  const tryPath = (source, mods = []) => {
    if (source == null) return null;
    const val = source + mods.reduce((s, m) => s + m, 0);
    if (val <= 0) return null;
    if (mods.length === 0) return { value: val, tier: 1, subTier: null };
    // subTier: null — RaceMode has no team-average fallback so subTier is never populated
    return {
      value: val,
      tier: mods.some((m) => m === 0) ? 3 : 2,
      subTier: null,
    };
  };
  const dw = dayWetAdd,
    nd = nightDryAdd,
    nw = nightWetAdd;
  switch (condition) {
    case "DD":
      return (
        tryPath(perf.lap_time_dry) ||
        tryPath(perf.lap_time_wet, [-dw]) ||
        tryPath(perf.lap_time_night_dry, [-nd]) ||
        tryPath(perf.lap_time_night_wet, [-dw, -nw]) ||
        null
      );
    case "DW":
      return (
        tryPath(perf.lap_time_wet) ||
        tryPath(perf.lap_time_dry, [dw]) ||
        tryPath(perf.lap_time_night_wet, [-nw]) ||
        tryPath(perf.lap_time_night_dry, [dw, -nd]) ||
        null
      );
    case "ND":
      return (
        tryPath(perf.lap_time_night_dry) ||
        tryPath(perf.lap_time_dry, [nd]) ||
        tryPath(perf.lap_time_wet, [-dw, nd]) ||
        tryPath(perf.lap_time_night_wet, [-dw, -nw, nd]) ||
        null
      );
    case "NW":
      return (
        tryPath(perf.lap_time_night_wet) ||
        tryPath(perf.lap_time_wet, [nw]) ||
        tryPath(perf.lap_time_dry, [dw, nw]) ||
        tryPath(perf.lap_time_night_dry, [-nd, dw, nw]) ||
        null
      );
    default:
      return null;
  }
}

// ─── Compute actual fuel stats for a completed stint ────────────────────────

function calcActualFuel(stint, driverPerf, teamEntry, offsetRaceStart = null) {
  // Accept time-elapsed stints (no irl_end_actual) using planned end as fallback
  const effectiveEnd = stint.irl_end_actual || stint.irl_end_planned;
  if (!effectiveEnd || !stint.irl_start) return null;

  const perf = driverPerf[stint.driver_id];
  // Use offset-adjusted start as IG time baseline — mirrors the fix in StintGrid.
  // Falls back to raw event start when no offset is provided.
  const raceStart = offsetRaceStart ?? teamEntry?.event_start_times?.irl_start;
  const igStartTime = teamEntry?.events?.ig_start_time;
  const igSunrise = teamEntry?.events?.ig_sunrise;
  const igSunset = teamEntry?.events?.ig_sunset;
  const dayWetAdd = teamEntry?.day_wet_add_seconds || 0;
  const nightDryAdd = teamEntry?.night_dry_add_seconds || 0;
  const nightWetAdd = teamEntry?.night_wet_add_seconds || 0;

  const igTime = getIGTime(stint.irl_start, raceStart, igStartTime);
  const phase = getPhase(igTime, igSunrise, igSunset);
  const isNight = phase === "🌑";

  // Both helpers now return { value, tier } or null
  const resolvedLap = selectLapTime(
    perf,
    stint.rain,
    isNight,
    dayWetAdd,
    nightDryAdd,
    nightWetAdd,
  );
  const resolvedFuel = selectFuelPerLap(perf, stint.rain, isNight);
  const lapTimeSec = resolvedLap?.value ?? null;
  const fuelPerLapVal = resolvedFuel?.value ?? null;

  const actualDurationSec =
    (new Date(effectiveEnd) - new Date(stint.irl_start)) / 1000;
  const actualLaps =
    lapTimeSec && actualDurationSec > 0
      ? Math.round(actualDurationSec / lapTimeSec)
      : null;
  const actualFuel =
    actualLaps !== null && fuelPerLapVal ? actualLaps * fuelPerLapVal : null;
  const plannedFuel = stint.fuel_used_calc ?? null;
  const drift =
    actualFuel !== null && plannedFuel !== null
      ? actualFuel - plannedFuel
      : null;

  // Worst tier and subTier across lap and fuel — drives compound marker in fuel summary.
  // RaceMode has no team-average fallback so maxSubTier will always be 0 here —
  // kept for structural consistency with StintGrid so the fuel summary rendering
  // can use the same compound-marker logic in both components.
  const maxTier = Math.max(resolvedLap?.tier || 0, resolvedFuel?.tier || 0);
  const maxSubTier = Math.max(
    resolvedLap?.subTier || 0,
    resolvedFuel?.subTier || 0,
  );

  return {
    actualLaps,
    actualFuel,
    plannedFuel,
    drift,
    actualDurationSec,
    maxTier, // 0=no data, 1=specific, 2=modifier, 3=zero-modifier
    maxSubTier, // sub-resolution tier when team avg was used (always 0 in RaceMode)
    hasPerfData: !!(lapTimeSec && fuelPerLapVal),
  };
}

// ─── Race state ──────────────────────────────────────────────────────────────

function getRaceState(now, raceStart, raceEnd, stints) {
  if (!raceStart) return "PRE_RACE";
  if (now < raceStart) return "PRE_RACE";
  if (stints.length > 0 && stints.every((s) => s.irl_end_actual))
    return "FINISHED";
  if (raceEnd && now >= raceEnd) return "FINISHED";
  return "IN_RACE";
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function RaceMode({
  teamEntryId,
  teamEntry,
  assignedDrivers,
  archived,
  // activeStrategy: set via StintGrid's "Définir comme active" — drives which stints Race Mode uses
  activeStrategy = null,
  onRequestRecalc = null,
}) {
  const [stints, setStints] = useState([]);
  const [driverPerf, setDriverPerf] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(new Date());
  const [confirmModal, setConfirmModal] = useState(null);

  // Dev-only state override
  const [devState, setDevState] = useState(null);

  // ── Clock tick ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Data fetch ─────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    // No active strategy → clear stints and bail out
    if (!activeStrategy?.id) {
      setStints([]);
      setDriverPerf({});
      setLoading(false);
      return;
    }
    const [{ data: stintsData }, { data: perfData }] = await Promise.all([
      // Filter stints by the active strategy — Race Mode only operates on one strategy
      supabase
        .from("stints")
        .select("*")
        .eq("strategy_id", activeStrategy.id)
        .order("stint_number"),
      supabase
        .from("driver_performance")
        .select("*")
        .eq("team_entry_id", teamEntryId),
    ]);

    const perfMap = {};
    (perfData || []).forEach((p) => {
      perfMap[p.driver_id] = p;
    });

    setStints(stintsData || []);
    setDriverPerf(perfMap);
    setLoading(false);
  }, [teamEntryId, activeStrategy?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Realtime subscription ──────────────────────────────────────────────────
  useEffect(() => {
    if (!activeStrategy?.id) return;
    const channel = supabase
      .channel(`race-mode-${teamEntryId}-${activeStrategy.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "stints",
          filter: `strategy_id=eq.${activeStrategy.id}`,
        },
        () => fetchData(),
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [teamEntryId, activeStrategy?.id, fetchData]);

  // ── Derived: timing ────────────────────────────────────────────────────────
  // Apply strategy start offset — mirrors calculateAllStints logic in StintGrid
  const raceStart = teamEntry?.event_start_times?.irl_start
    ? new Date(
        new Date(teamEntry.event_start_times.irl_start).getTime() +
          (activeStrategy?.actual_start_offset_minutes || 0) * 60 * 1000,
      )
    : null;
  const raceEnd =
    raceStart && teamEntry?.events?.duration_minutes
      ? new Date(
          raceStart.getTime() + teamEntry.events.duration_minutes * 60 * 1000,
        )
      : null;

  // ── Derived: race state ────────────────────────────────────────────────────
  const raceState = devState ?? getRaceState(now, raceStart, raceEnd, stints);
  const isPreRace = raceState === "PRE_RACE";
  const isFinished = raceState === "FINISHED";
  const isInRace = raceState === "IN_RACE";

  // ── Derived: driver map ────────────────────────────────────────────────────
  const driverMap = {};
  assignedDrivers.forEach((d) => {
    if (d.drivers?.id) driverMap[d.drivers.id] = d.drivers.name;
  });

  // ── Derived: active stint (IRL-time based) ─────────────────────────────────
  // lastStampedIndex — used to exclude already-stamped stints from active detection.
  // Prevents findLast from cycling backwards to previous unstamped stints after stamping.
  const lastStampedIndex = stints.reduce(
    (max, s, i) => (s.irl_end_actual ? i : max),
    -1,
  );

  // activeStint = latest started unstamped stint that comes AFTER the last stamped one.
  // findLast gives us the correct current stint in overtime (multiple started, one running).
  // The index guard prevents backward cycling after each stamp.
  const activeStint = isInRace
    ? (stints.findLast(
        (s, i) =>
          i > lastStampedIndex &&
          s.irl_start &&
          new Date(s.irl_start) <= now &&
          !s.irl_end_actual,
      ) ?? null)
    : null;

  // overdueStint = earliest unstamped started stint that comes BEFORE activeStint.
  // These are stints that were skipped over (race auto-advanced past them)
  // and need to be retroactively stamped via the secondary button.
  const activeIndex = activeStint
    ? stints.findIndex((s) => s.id === activeStint.id)
    : -1;
  // overdueStint = the stint immediately before the active one, if unstamped.
  // Only one at a time — user stamps backwards one by one if multiple were skipped.
  const previousStint = activeIndex > 0 ? stints[activeIndex - 1] : null;
  const overdueStint =
    isInRace && previousStint && !previousStint.irl_end_actual
      ? previousStint
      : null;
  const hasOverdue = !!overdueStint;

  const nextStint = activeIndex >= 0 ? (stints[activeIndex + 1] ?? null) : null;
  const completedStints = stints.filter(
    (s) =>
      s.irl_end_actual ||
      (s.irl_end_planned && new Date(s.irl_end_planned) <= now),
  );

  // ── Derived: race progress ─────────────────────────────────────────────────
  const raceProgressPct =
    raceStart && raceEnd && !isPreRace
      ? Math.min(
          100,
          Math.max(0, ((now - raceStart) / (raceEnd - raceStart)) * 100),
        )
      : 0;

  const raceRemainingSec =
    raceEnd && !isPreRace ? Math.floor((raceEnd - now) / 1000) : null;

  const preRaceCountdownSec =
    isPreRace && raceStart ? Math.floor((raceStart - now) / 1000) : null;

  // ── Derived: active stint countdown ───────────────────────────────────────
  const plannedEnd = activeStint?.irl_end_planned
    ? new Date(activeStint.irl_end_planned)
    : null;
  const stintRemainingSec = plannedEnd
    ? Math.floor((plannedEnd - now) / 1000)
    : null;
  const isOvertime = stintRemainingSec !== null && stintRemainingSec < 0;
  const inPitWindow =
    stintRemainingSec !== null &&
    stintRemainingSec >= 0 &&
    stintRemainingSec <= 300; // 5-minute window — standard pit window alert threshold

  // ── Derived: fuel to add at next pit stop ─────────────────────────────────
  // fuel_remaining_calc is persisted by StintGrid — it represents how much
  // fuel is left in the tank at the end of this stint.
  // Fuel to add = tankSize − fuelRemaining (capped at tankSize).
  const carTankSize = teamEntry?.cars?.tank_size_litres;
  const tankSize =
    carTankSize && teamEntry?.bop_tank_size_percent
      ? carTankSize * (teamEntry.bop_tank_size_percent / 100) // BOP reduces usable tank capacity
      : (carTankSize ?? null);
  const fuelToAdd =
    activeStint?.fuel_remaining_calc != null && tankSize != null
      ? Math.max(0, tankSize - activeStint.fuel_remaining_calc)
      : null;

  // ── Derived: fuel stats for completed stints ──────────────────────────────
  const completedWithFuel = completedStints.map((s) => ({
    ...s,
    // Pass offset-adjusted raceStart so IG time baseline matches StintGrid
    _fuel: calcActualFuel(s, driverPerf, teamEntry, raceStart),
  }));

  // != null catches both null (_fuel is null — no irl_end_actual) and undefined
  const fuelDriftStints = completedWithFuel.filter(
    (s) => s._fuel?.drift != null,
  );
  const cumulativeDrift =
    fuelDriftStints.length > 0
      ? fuelDriftStints.reduce((sum, s) => sum + s._fuel.drift, 0)
      : null;
  const hasFuelData = fuelDriftStints.length > 0;

  // ── Actions ────────────────────────────────────────────────────────────────

  const markPitStop = async (stint) => {
    if (!stint || archived || saving || !isInRace) return;
    setSaving(true);
    const actualEnd = new Date().toISOString();

    // Compute pit stop duration to propagate the stamp to the next stint's irl_start.
    // Uses fixed refuel fallback — StintGrid will correct variable-rate cars on next Relais open.
    const pitLane = teamEntry?.events?.circuits?.pit_lane_time_seconds || 0;
    const tyreChange = teamEntry?.tyre_change_time_seconds || 0;
    const refuel = teamEntry?.refuel_time_seconds || 0;
    const pitStopSec = pitLane + refuel + (stint.tyre_change ? tyreChange : 0);
    const stintIndex = stints.findIndex((s) => s.id === stint.id);
    const nextStint = stintIndex >= 0 ? (stints[stintIndex + 1] ?? null) : null;
    const nextIrlStart = nextStint
      ? new Date(new Date(actualEnd).getTime() + pitStopSec * 1000).toISOString()
      : null;

    // Optimistic update — instant UI response before DB confirms
    setStints((prev) =>
      prev.map((s) => {
        if (s.id === stint.id) return { ...s, irl_end_actual: actualEnd };
        if (nextStint && s.id === nextStint.id) return { ...s, irl_start: nextIrlStart };
        return s;
      }),
    );

    await supabase
      .from("stints")
      .update({ irl_end_actual: actualEnd })
      .eq("id", stint.id);

    if (nextStint && nextIrlStart) {
      await supabase
        .from("stints")
        .update({ irl_start: nextIrlStart })
        .eq("id", nextStint.id);
    }

    setSaving(false);
  };

  const undoLastPit = () => {
    if (archived) return;
    const last = [...stints].reverse().find((s) => s.irl_end_actual);
    if (!last) return;
    setConfirmModal({
      title: "Annuler le dernier arrêt",
      message: "L'arrêt au stand sera annulé et le relais repassera en cours.",
      confirmLabel: "Annuler l'arrêt",
      onConfirm: async () => {
        setConfirmModal(null);
        setSaving(true);
        setStints((prev) =>
          prev.map((s) =>
            s.id === last.id ? { ...s, irl_end_actual: null } : s,
          ),
        );
        await supabase
          .from("stints")
          .update({ irl_end_actual: null })
          .eq("id", last.id);
        setSaving(false);
      },
    });
  };

  // ── Shared styles ──────────────────────────────────────────────────────────
  const labelStyle = {
    fontSize: "0.65rem",
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "var(--text-dim)",
    marginBottom: "0.15rem",
  };

  // ── Render guards ──────────────────────────────────────────────────────────
  // No active strategy — prompt user to set one in StintGrid
  if (!activeStrategy) {
    return (
      <div className="card">
        <div className="empty">
          Aucune stratégie active — définissez une stratégie comme active dans
          l&apos;onglet Relais.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="card">
        <div className="empty">Chargement…</div>
      </div>
    );
  }

  if (stints.length === 0) {
    return (
      <div className="card">
        <div className="empty">
          Aucun relais planifié — configurez les relais d&apos;abord.
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <ConfirmModal
        modal={confirmModal}
        onConfirm={() => confirmModal?.onConfirm?.()}
        onCancel={() => setConfirmModal(null)}
      />
      {/* ── Race progress bar ──────────────────────────────────────────── */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "0.75rem",
            color: "var(--text-dim)",
            marginBottom: "0.35rem",
          }}
        >
          <span>Progression de la course</span>
          <span className="mono">
            {isPreRace
              ? preRaceCountdownSec !== null
                ? `Départ dans ${formatCountdown(preRaceCountdownSec)}`
                : "—"
              : isFinished
                ? "Course terminée"
                : raceRemainingSec !== null
                  ? `−${formatCountdown(raceRemainingSec)}`
                  : "—"}
          </span>
        </div>
        <div
          style={{
            height: "8px",
            background: "var(--surface-2)",
            borderRadius: "4px",
            overflow: "hidden",
            border: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${raceProgressPct}%`,
              background: isFinished ? "#2eb460" : "var(--accent)",
              borderRadius: "4px",
              transition: "width 1s linear",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "0.72rem",
            color: "var(--text-dim)",
            marginTop: "0.25rem",
          }}
        >
          <span>{raceStart ? formatTime(raceStart) : "—"}</span>
          <span
            className="mono"
            style={{ color: "var(--accent)", fontSize: "0.8rem" }}
          >
            {isPreRace ? "Avant départ" : `${Math.round(raceProgressPct)}%`}
          </span>
          <span>{raceEnd ? formatTime(raceEnd) : "—"}</span>
        </div>
      </div>
      {/* ── Stint progress pills ───────────────────────────────────────── */}
      <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
        {stints.map((s) => {
          const isActive = s.id === activeStint?.id;
          const isDone =
            !!s.irl_end_actual ||
            (s.irl_end_planned && new Date(s.irl_end_planned) <= now);
          return (
            <div
              key={s.id}
              title={`Relais ${s.stint_number} — ${driverMap[s.driver_id] || "À définir"}`}
              style={{
                flex: 1,
                minWidth: "24px",
                height: "6px",
                borderRadius: "3px",
                background: isDone
                  ? "#2eb460"
                  : isActive
                    ? "var(--accent)"
                    : "var(--surface-2)",
                border: `1px solid ${isActive ? "var(--accent)" : "var(--border)"}`,
                transition: "background 0.3s",
              }}
            />
          );
        })}
      </div>
      {/* ── Main active stint card ─────────────────────────────────────── */}
      <div
        className="card"
        style={{
          borderColor: isFinished
            ? "#2eb460"
            : isPreRace
              ? "var(--border)"
              : isOvertime
                ? "var(--danger)"
                : inPitWindow
                  ? "#f59e0b"
                  : "var(--accent-dim)",
          background: isFinished
            ? "rgba(46,180,96,0.06)"
            : isPreRace
              ? "var(--surface)"
              : isOvertime
                ? "rgba(224,85,85,0.06)"
                : inPitWindow
                  ? "rgba(245,158,11,0.06)"
                  : "var(--surface)",
        }}
      >
        {/* Status label */}
        <div
          style={{
            fontSize: "0.68rem",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: isFinished
              ? "#2eb460"
              : isPreRace
                ? "var(--text-dim)"
                : isOvertime
                  ? "var(--danger)"
                  : inPitWindow
                    ? "#f59e0b"
                    : "var(--accent)",
            marginBottom: "0.75rem",
          }}
        >
          {isFinished
            ? "🏁 Course terminée"
            : isPreRace
              ? "⏳ Avant course"
              : isOvertime
                ? `⚠️ Dépassement — Relais ${activeStint?.stint_number ?? "?"} / ${stints.length}`
                : inPitWindow
                  ? `🟡 Fenêtre de stand — Relais ${activeStint?.stint_number ?? "?"} / ${stints.length}`
                  : `🟢 En course — Relais ${activeStint?.stint_number ?? "?"} / ${stints.length}`}
        </div>

        {/* Driver name */}
        <div
          style={{
            fontFamily: "var(--font-rajdhani), sans-serif",
            fontSize: "2rem",
            fontWeight: 700,
            color: isPreRace || isFinished ? "var(--text-dim)" : "var(--text)",
            lineHeight: 1,
            marginBottom: "0.5rem",
          }}
        >
          {isFinished
            ? `${completedStints.length} relais complétés`
            : isPreRace
              ? driverMap[stints[0]?.driver_id] || (
                  <span style={{ color: "var(--text-dim)" }}>À définir</span>
                )
              : driverMap[activeStint?.driver_id] ||
                activeStint?.driver_name_snapshot || (
                  <span style={{ color: "var(--text-dim)" }}>À définir</span>
                )}
        </div>

        {/* Timing row */}
        {!isFinished && (
          <div
            style={{
              display: "flex",
              gap: "1.5rem",
              flexWrap: "wrap",
              marginBottom: "1.25rem",
            }}
          >
            {isPreRace ? (
              <>
                <div>
                  <div style={labelStyle}>Départ course</div>
                  <div className="mono" style={{ fontSize: "0.95rem" }}>
                    {raceStart ? formatTime(raceStart) : "—"}
                  </div>
                </div>
                <div>
                  <div style={labelStyle}>Départ dans</div>
                  <div
                    className="mono"
                    style={{
                      fontSize: "1.5rem",
                      fontWeight: 700,
                      lineHeight: 1,
                    }}
                  >
                    {preRaceCountdownSec !== null
                      ? formatCountdown(preRaceCountdownSec)
                      : "—"}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <div style={labelStyle}>Départ relais</div>
                  <div className="mono" style={{ fontSize: "0.95rem" }}>
                    {activeStint?.irl_start
                      ? formatTime(activeStint.irl_start)
                      : "—"}
                  </div>
                </div>
                <div>
                  <div style={labelStyle}>Fin prévue</div>
                  <div className="mono" style={{ fontSize: "0.95rem" }}>
                    {plannedEnd ? formatTime(plannedEnd) : "—"}
                  </div>
                </div>
                <div>
                  <div style={labelStyle}>
                    {isOvertime ? "Dépassement" : "Temps restant"}
                  </div>
                  <div
                    className="mono"
                    style={{
                      fontSize: "1.5rem",
                      fontWeight: 700,
                      lineHeight: 1,
                      color: isOvertime
                        ? "var(--danger)"
                        : inPitWindow
                          ? "#f59e0b"
                          : "var(--text)",
                    }}
                  >
                    {stintRemainingSec !== null
                      ? formatCountdown(stintRemainingSec)
                      : "—"}
                  </div>
                </div>
                {/* Fuel to add at next pit stop */}
                {fuelToAdd !== null && (
                  <div>
                    <div style={labelStyle}>Carburant prochain arrêt</div>
                    <div
                      className="mono"
                      style={{ fontSize: "0.95rem", color: "var(--accent)" }}
                    >
                      ~{fuelToAdd.toFixed(1)}L
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Undo last pit — inside the card, above the pit button, only when relevant */}
        {!archived && completedStints.length > 0 && (
          <div style={{ textAlign: "right", marginBottom: "0.5rem" }}>
            <button
              onClick={undoLastPit}
              className="btn btn-danger"
              disabled={saving}
              style={{ fontSize: "0.78rem" }}
            >
              ↩ Annuler dernier arrêt
            </button>
          </div>
        )}

        {/* Pit stop buttons */}
        {!archived && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
          >
            {/* Main button — stamps the current active (auto-advanced) stint */}
            <button
              onClick={() => markPitStop(activeStint)}
              disabled={saving || isPreRace || isFinished || !activeStint}
              style={{
                width: "100%",
                padding: "1rem",
                fontSize: "1rem",
                fontFamily: "var(--font-rajdhani), sans-serif",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                background:
                  isPreRace || isFinished || !activeStint
                    ? "var(--surface-2)"
                    : isOvertime
                      ? "var(--danger)"
                      : inPitWindow
                        ? "#d97706"
                        : "var(--accent)",
                color:
                  isPreRace || isFinished || !activeStint
                    ? "var(--text-dim)"
                    : "#fff",
                border: `1px solid ${
                  isPreRace || isFinished || !activeStint
                    ? "var(--border)"
                    : "transparent"
                }`,
                borderRadius: "4px",
                cursor:
                  saving || isPreRace || isFinished || !activeStint
                    ? "not-allowed"
                    : "pointer",
                opacity: saving ? 0.7 : 1,
                transition: "all 0.15s",
              }}
            >
              {saving
                ? "Enregistrement…"
                : isFinished
                  ? "Course terminée"
                  : isPreRace
                    ? "Course non démarrée"
                    : "⏱ Marquer arrêt au stand"}
            </button>

            {/* Secondary button — only shown when a previous stint was never stamped.
                Lets the user retroactively record the actual end of an overdue stint
                without disrupting the auto-advanced active display. */}
            {hasOverdue && (
              <button
                onClick={() => markPitStop(overdueStint)}
                disabled={saving}
                style={{
                  width: "100%",
                  padding: "0.6rem 1rem",
                  fontSize: "0.82rem",
                  fontFamily: "var(--font-rajdhani), sans-serif",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  background: "rgba(90,200,200,0.08)",
                  color: "#5ac8c8",
                  border: "1px solid rgba(90,200,200,0.4)",
                  borderRadius: "4px",
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.7 : 1,
                  transition: "all 0.15s",
                }}
              >
                ⏱ Marquer fin relais précédent
              </button>
            )}
          </div>
        )}
      </div>
      {/* ── Next stint card ────────────────────────────────────────────── */}
      {nextStint && isInRace && (
        <div
          className="card"
          style={{ opacity: 0.75, borderColor: "var(--border)" }}
        >
          <div style={{ ...labelStyle, marginBottom: "0.5rem" }}>
            Prochain — Relais {nextStint.stint_number}
          </div>
          <div
            style={{
              fontFamily: "var(--font-rajdhani), sans-serif",
              fontSize: "1.25rem",
              fontWeight: 700,
              color: "var(--text-dim)",
            }}
          >
            {driverMap[nextStint.driver_id] ||
              nextStint?.driver_name_snapshot || (
                <span style={{ color: "var(--text-dim)" }}>À définir</span>
              )}
          </div>
          {nextStint.irl_start && (
            <div
              className="mono"
              style={{
                fontSize: "0.82rem",
                color: "var(--accent)",
                marginTop: "0.25rem",
              }}
            >
              Départ prévu : {formatTime(nextStint.irl_start)}
            </div>
          )}
          {(nextStint.rain || nextStint.tyre_change) && (
            <div
              style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}
            >
              {nextStint.rain && (
                <span
                  style={{
                    fontSize: "0.75rem",
                    padding: "0.1rem 0.4rem",
                    background: "rgba(74,159,212,0.12)",
                    border: "1px solid #4a9fd4",
                    borderRadius: "3px",
                    color: "#4a9fd4",
                  }}
                >
                  💧 Pluie
                </span>
              )}
              {nextStint.tyre_change && (
                <span
                  style={{
                    fontSize: "0.75rem",
                    padding: "0.1rem 0.4rem",
                    background: "rgba(var(--accent-rgb),0.12)",
                    border: "1px solid var(--accent)",
                    borderRadius: "3px",
                    color: "var(--accent)",
                  }}
                >
                  🛞 Chgt pneus
                </span>
              )}
            </div>
          )}
        </div>
      )}
      {/* ── Recalc strategy card — only during race with completed stints ── */}
      {!archived &&
        onRequestRecalc &&
        isInRace &&
        completedStints.length > 0 && (
          <div
            onClick={onRequestRecalc}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.65rem 1rem",
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
                {completedStints.length} relais complétés · voir l&apos;onglet
                Relais
              </div>
            </div>
            <span style={{ color: "var(--accent)", fontSize: "0.85rem" }}>
              →
            </span>
          </div>
        )}
      {/* ── Fuel summary ──────────────────────────────────────────────── */}
      {hasFuelData && (
        <div className="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.75rem",
            }}
          >
            <div style={labelStyle}>Bilan carburant</div>
            {cumulativeDrift !== null && (
              <span
                style={{
                  fontSize: "0.75rem",
                  fontFamily: "var(--font-mono), monospace",
                  fontWeight: 700,
                  padding: "0.15rem 0.5rem",
                  borderRadius: "3px",
                  background:
                    Math.abs(cumulativeDrift) < 0.5
                      ? "rgba(46,180,96,0.12)"
                      : cumulativeDrift > 0
                        ? "rgba(224,85,85,0.12)"
                        : "rgba(46,180,96,0.12)",
                  border: `1px solid ${
                    Math.abs(cumulativeDrift) < 0.5
                      ? "#2eb460"
                      : cumulativeDrift > 0
                        ? "var(--danger)"
                        : "#2eb460"
                  }`,
                  color:
                    Math.abs(cumulativeDrift) < 0.5
                      ? "#2eb460"
                      : cumulativeDrift > 0
                        ? "var(--danger)"
                        : "#2eb460",
                }}
              >
                Écart total : {cumulativeDrift > 0 ? "+" : ""}
                {cumulativeDrift.toFixed(1)}L
              </span>
            )}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.4rem",
              width: "100%",
            }}
          >
            {completedWithFuel
              .filter((s) => s._fuel)
              .map((s) => {
                const f = s._fuel;
                const driftColor =
                  f.drift === null
                    ? "var(--text-dim)"
                    : Math.abs(f.drift) < 0.5
                      ? "#2eb460"
                      : f.drift > 0
                        ? "var(--danger)"
                        : "#2eb460";
                return (
                  <div
                    key={s.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "2fr 0.8fr 0.8fr 1.8fr 0.5fr 0.1fr",
                      alignItems: "center",
                      padding: "0.4rem 0.6rem",
                      background: "var(--surface-2)",
                      borderRadius: "3px",
                      fontSize: "0.82rem",
                      gap: "0.5rem",
                      width: "100%",
                      boxSizing: "border-box",
                    }}
                  >
                    {/* Stint # + driver */}
                    <span style={{ color: "var(--text-dim)" }}>
                      #{s.stint_number}{" "}
                      <span style={{ color: "var(--text)", fontWeight: 600 }}>
                        {driverMap[s.driver_id] ||
                          s.driver_name_snapshot ||
                          "—"}
                      </span>
                    </span>

                    {/* Duration */}
                    <span
                      className="mono"
                      style={{ color: "var(--text-dim)", fontSize: "0.75rem" }}
                    >
                      {formatDuration(f.actualDurationSec)}
                    </span>

                    {/* Laps */}
                    <span
                      className="mono"
                      style={{ color: "var(--text-dim)", fontSize: "0.75rem" }}
                    >
                      {f.actualLaps !== null ? `${f.actualLaps} tours` : "—"}
                    </span>

                    {/* Fuel actual / planned */}
                    <span className="mono" style={{ fontSize: "0.75rem" }}>
                      {f.actualFuel !== null ? (
                        <>
                          <span style={{ color: "var(--accent)" }}>
                            {f.actualFuel.toFixed(1)}L
                          </span>
                          {f.plannedFuel !== null && (
                            <span style={{ color: "var(--text-dim)" }}>
                              {" / "}
                              {f.plannedFuel.toFixed(1)}L prévu
                            </span>
                          )}
                        </>
                      ) : (
                        <span style={{ color: "var(--text-dim)" }}>— L</span>
                      )}
                    </span>

                    {/* Drift */}
                    <span
                      className="mono"
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        color: driftColor,
                        textAlign: "right",
                      }}
                    >
                      {f.drift !== null
                        ? `${f.drift > 0 ? "+" : ""}${f.drift.toFixed(1)}L`
                        : "—"}
                    </span>

                    {/* Tier marker / warning — always occupies the last column */}
                    <span style={{ textAlign: "center" }}>
                      {f.maxTier >= 2 ? (
                        <sup
                          style={{
                            fontSize: "0.7em",
                            color: f.maxTier >= 3 ? "#a07830" : "#c9a84c",
                          }}
                          title={
                            f.maxTier === 4
                              ? f.maxSubTier >= 3
                                ? "Estimé via moyenne équipe sans modificateur configuré — fiabilité faible"
                                : f.maxSubTier === 2
                                  ? "Estimé via moyenne équipe + modificateur"
                                  : "Estimé via moyenne équipe"
                              : f.maxTier === 3
                                ? "Estimé — modificateur non configuré"
                                : "Estimé via modificateur équipage"
                          }
                        >
                          {markerFromTier(f.maxTier)}
                          {f.maxSubTier >= 2
                            ? markerFromTier(f.maxSubTier)
                            : ""}
                        </sup>
                      ) : !f.hasPerfData ? (
                        <span
                          title="Données de performance manquantes"
                          style={{ fontSize: "0.75rem" }}
                        >
                          ⚠️
                        </span>
                      ) : null}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
      {/* ── Completed stints log ───────────────────────────────────────── */}
      {completedStints.length > 0 && (
        <div className="card" style={{ padding: "0.75rem 1rem" }}>
          <div style={{ ...labelStyle, marginBottom: "0.5rem" }}>
            Relais complétés ({completedStints.length})
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
            }}
          >
            {completedStints.map((s) => (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.82rem",
                }}
              >
                <span style={{ color: "var(--text-dim)" }}>
                  #{s.stint_number}{" "}
                  <span style={{ color: "var(--text)", fontWeight: 600 }}>
                    {driverMap[s.driver_id] || s.driver_name_snapshot || "—"}
                  </span>
                </span>
                <span
                  className="mono"
                  style={{ fontSize: "0.75rem", color: "#2eb460" }}
                >
                  ✓ {formatTime(s.irl_end_actual || s.irl_end_planned)}
                  <span
                    style={{
                      opacity: 0.5,
                      fontSize: "0.68rem",
                      marginLeft: "0.3rem",
                    }}
                  >
                    {s.irl_end_actual ? "réel" : "prévu"}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* ── Dev state override ─────────────────────────────────────────── */}
      {process.env.NODE_ENV === "development" && (
        <div
          style={{
            marginTop: "0.5rem",
            padding: "0.75rem 1rem",
            border: "1px dashed #555",
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: "0.7rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#555",
            }}
          >
            DEV
          </span>
          {[
            { key: null, label: "Réel" },
            { key: "PRE_RACE", label: "Avant course" },
            { key: "IN_RACE", label: "En course" },
            { key: "FINISHED", label: "Terminée" },
          ].map(({ key, label }) => (
            <button
              key={String(key)}
              onClick={() => setDevState(key)}
              style={{
                padding: "0.2rem 0.6rem",
                fontSize: "0.75rem",
                borderRadius: "3px",
                border: `1px solid ${devState === key ? "var(--accent)" : "#555"}`,
                background:
                  devState === key ? "var(--accent-dim)" : "transparent",
                color: devState === key ? "var(--accent)" : "#555",
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
