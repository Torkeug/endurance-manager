"use client";
import { useState, useEffect, useCallback } from "react";
import { supabaseBrowser as supabase } from "../../../../../lib/supabase-browser";

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
  const sign = sec < 0 ? "+" : "";
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

// ─── Lap time per driver — mirrors calcStint priority in StintGrid ───────────

function selectLapTime(perf, rain, isNight, nightDryAdd, nightWetAdd) {
  if (!perf) return null;
  if (rain) {
    return isNight
      ? perf.lap_time_night_wet ||
          (perf.lap_time_wet ? perf.lap_time_wet + nightWetAdd : null) ||
          (perf.lap_time_dry ? perf.lap_time_dry + nightWetAdd : null) ||
          null
      : perf.lap_time_wet || perf.lap_time_dry || null;
  }
  return isNight
    ? perf.lap_time_night_dry ||
        (perf.lap_time_dry ? perf.lap_time_dry + nightDryAdd : null) ||
        (perf.lap_time_wet ? perf.lap_time_wet + nightDryAdd : null) ||
        null
    : perf.lap_time_dry || perf.lap_time_wet || null;
}

// ─── Compute actual fuel stats for a completed stint ────────────────────────

function calcActualFuel(stint, driverPerf, teamEntry) {
  if (!stint.irl_end_actual || !stint.irl_start) return null;

  const perf = driverPerf[stint.driver_id];
  const raceStart = teamEntry?.event_start_times?.irl_start;
  const igStartTime = teamEntry?.events?.ig_start_time;
  const igSunrise = teamEntry?.events?.ig_sunrise;
  const igSunset = teamEntry?.events?.ig_sunset;
  const nightDryAdd = teamEntry?.night_dry_add_seconds || 0;
  const nightWetAdd = teamEntry?.night_wet_add_seconds || 0;

  const igTime = getIGTime(stint.irl_start, raceStart, igStartTime);
  const phase = getPhase(igTime, igSunrise, igSunset);
  const isNight = phase === "🌑";

  const lapTimeSec = selectLapTime(
    perf,
    stint.rain,
    isNight,
    nightDryAdd,
    nightWetAdd,
  );
  const fuelPerLap = selectFuelPerLap(perf, stint.rain, isNight);

  const actualDurationSec =
    (new Date(stint.irl_end_actual) - new Date(stint.irl_start)) / 1000;
  const actualLaps =
    lapTimeSec && actualDurationSec > 0
      ? Math.round(actualDurationSec / lapTimeSec)
      : null;
  const actualFuel =
    actualLaps !== null && fuelPerLap ? actualLaps * fuelPerLap : null;
  const plannedFuel = stint.fuel_used_calc ?? null;
  const drift =
    actualFuel !== null && plannedFuel !== null
      ? actualFuel - plannedFuel
      : null;

  return {
    actualLaps,
    actualFuel,
    plannedFuel,
    drift,
    actualDurationSec,
    hasPerfData: !!(lapTimeSec && fuelPerLap),
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
    const [{ data: stintsData }, { data: perfData }] = await Promise.all([
      supabase
        .from("stints")
        .select("*")
        .eq("team_entry_id", teamEntryId)
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
  }, [teamEntryId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Realtime subscription ──────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`race-mode-${teamEntryId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "stints",
          filter: `team_entry_id=eq.${teamEntryId}`,
        },
        () => fetchData(),
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [teamEntryId, fetchData]);

  // ── Derived: timing ────────────────────────────────────────────────────────
  const raceStart = teamEntry?.event_start_times?.irl_start
    ? new Date(teamEntry.event_start_times.irl_start)
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
  const activeStint = isInRace
    ? (stints.find(
        (s) => s.irl_start && new Date(s.irl_start) <= now && !s.irl_end_actual,
      ) ?? null)
    : null;

  const activeIndex = activeStint
    ? stints.findIndex((s) => s.id === activeStint.id)
    : -1;

  const nextStint = activeIndex >= 0 ? (stints[activeIndex + 1] ?? null) : null;
  const completedStints = stints.filter((s) => s.irl_end_actual);

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
    stintRemainingSec <= 300;

  // ── Derived: fuel to add at next pit stop ─────────────────────────────────
  // fuel_remaining_calc is persisted by StintGrid — it represents how much
  // fuel is left in the tank at the end of this stint.
  // Fuel to add = tankSize − fuelRemaining (capped at tankSize).
  const carTankSize = teamEntry?.cars?.tank_size_litres;
  const tankSize =
    carTankSize && teamEntry?.bop_tank_size_percent
      ? carTankSize * (teamEntry.bop_tank_size_percent / 100)
      : (carTankSize ?? null);
  const fuelToAdd =
    activeStint?.fuel_remaining_calc != null && tankSize != null
      ? Math.max(0, tankSize - activeStint.fuel_remaining_calc)
      : null;

  // ── Derived: fuel stats for completed stints ──────────────────────────────
  const completedWithFuel = completedStints.map((s) => ({
    ...s,
    _fuel: calcActualFuel(s, driverPerf, teamEntry),
  }));

  const fuelDriftStints = completedWithFuel.filter(
    (s) => s._fuel?.drift !== null,
  );
  const cumulativeDrift =
    fuelDriftStints.length > 0
      ? fuelDriftStints.reduce((sum, s) => sum + s._fuel.drift, 0)
      : null;
  const hasFuelData = fuelDriftStints.length > 0;

  // ── Actions ────────────────────────────────────────────────────────────────

  const markPitStop = async () => {
    if (!activeStint || archived || saving || !isInRace) return;
    setSaving(true);
    const actualEnd = new Date().toISOString();
    // Optimistic update — instant UI response before realtime confirms
    setStints((prev) =>
      prev.map((s) =>
        s.id === activeStint.id ? { ...s, irl_end_actual: actualEnd } : s,
      ),
    );
    await supabase
      .from("stints")
      .update({ irl_end_actual: actualEnd })
      .eq("id", activeStint.id);
    setSaving(false);
  };

  const undoLastPit = () => {
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
          const isDone = !!s.irl_end_actual;
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

        {/* Pit stop button */}
        {!archived && (
          <button
            onClick={markPitStop}
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
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.4rem 0.6rem",
                      background: "var(--surface-2)",
                      borderRadius: "3px",
                      fontSize: "0.82rem",
                      gap: "0.5rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ color: "var(--text-dim)", flexShrink: 0 }}>
                      #{s.stint_number}{" "}
                      <span style={{ color: "var(--text)", fontWeight: 600 }}>
                        {driverMap[s.driver_id] ||
                          s.driver_name_snapshot ||
                          "—"}
                      </span>
                    </span>
                    <span
                      className="mono"
                      style={{ color: "var(--text-dim)", fontSize: "0.75rem" }}
                    >
                      {formatDuration(f.actualDurationSec)}
                    </span>
                    {f.actualLaps !== null && (
                      <span
                        className="mono"
                        style={{
                          color: "var(--text-dim)",
                          fontSize: "0.75rem",
                        }}
                      >
                        {f.actualLaps} tours
                      </span>
                    )}
                    <span className="mono" style={{ fontSize: "0.75rem" }}>
                      {f.actualFuel !== null ? (
                        <>
                          <span style={{ color: "var(--accent)" }}>
                            {f.actualFuel.toFixed(1)}L
                          </span>
                          {f.plannedFuel !== null && (
                            <span style={{ color: "var(--text-dim)" }}>
                              {" "}
                              / {f.plannedFuel.toFixed(1)}L prévu
                            </span>
                          )}
                        </>
                      ) : (
                        <span style={{ color: "var(--text-dim)" }}>— L</span>
                      )}
                    </span>
                    {f.drift !== null && (
                      <span
                        className="mono"
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          color: driftColor,
                          flexShrink: 0,
                        }}
                      >
                        {f.drift > 0 ? "+" : ""}
                        {f.drift.toFixed(1)}L
                      </span>
                    )}
                    {!f.hasPerfData && (
                      <span
                        title="Données de performance manquantes"
                        style={{ fontSize: "0.75rem" }}
                      >
                        ⚠️
                      </span>
                    )}
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
                  ✓ {formatTime(s.irl_end_actual)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* ── Undo button ────────────────────────────────────────────────── */}
      {!archived && completedStints.length > 0 && (
        <div style={{ textAlign: "right" }}>
          <button
            onClick={undoLastPit}
            className="btn btn-secondary"
            disabled={saving}
            style={{ fontSize: "0.78rem" }}
          >
            ↩ Annuler dernier arrêt
          </button>
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
