"use client";
import { useState, useEffect, useCallback } from "react";
import { supabaseBrowser as supabase } from "../../../../../lib/supabase-browser";

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
  const h = Math.floor(absS / 3600);
  const m = Math.floor((absS % 3600) / 60);
  const s = absS % 60;
  const sign = sec < 0 ? "+" : "";
  if (h > 0)
    return `${sign}${h}h ${String(m).padStart(2, "0")}min ${String(s).padStart(2, "0")}s`;
  return `${sign}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function RaceMode({
  teamEntryId,
  teamEntry,
  assignedDrivers,
  archived,
}) {
  const [stints, setStints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Ticks every second — drives all countdowns
  const [now, setNow] = useState(new Date());

  // ── Clock tick ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Data fetch ─────────────────────────────────────────────────────────────
  const fetchStints = useCallback(async () => {
    const { data } = await supabase
      .from("stints")
      .select("*")
      .eq("team_entry_id", teamEntryId)
      .order("stint_number");
    setStints(data || []);
    setLoading(false);
  }, [teamEntryId]);

  useEffect(() => {
    fetchStints();
  }, [fetchStints]);

  // ── Realtime subscription — keeps all open tabs in sync during the race ────
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
        () => fetchStints(),
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [teamEntryId, fetchStints]);

  // ── Derived state ──────────────────────────────────────────────────────────

  // Build driver id → name lookup from assignedDrivers prop
  const driverMap = {};
  assignedDrivers.forEach((d) => {
    if (d.drivers?.id) driverMap[d.drivers.id] = d.drivers.name;
  });

  // Active = first stint with no actual end time
  const activeIndex = stints.findIndex((s) => !s.irl_end_actual);
  const activeStint = activeIndex >= 0 ? stints[activeIndex] : null;
  const nextStint = activeIndex >= 0 ? stints[activeIndex + 1] : null;
  const completedCount = stints.filter((s) => s.irl_end_actual).length;

  // Race-level timing
  const raceStart = teamEntry?.event_start_times?.irl_start
    ? new Date(teamEntry.event_start_times.irl_start)
    : null;
  const raceEnd =
    raceStart && teamEntry?.events?.duration_minutes
      ? new Date(
          raceStart.getTime() + teamEntry.events.duration_minutes * 60 * 1000,
        )
      : null;
  const raceRemainingSec = raceEnd ? Math.floor((raceEnd - now) / 1000) : null;
  const raceElapsedSec = raceStart
    ? Math.floor((now - raceStart) / 1000)
    : null;
  const raceProgressPct =
    raceStart && raceEnd
      ? Math.min(
          100,
          Math.max(0, ((now - raceStart) / (raceEnd - raceStart)) * 100),
        )
      : 0;

  // Active stint countdown
  const plannedEnd = activeStint?.irl_end_planned
    ? new Date(activeStint.irl_end_planned)
    : null;
  const stintRemainingSec = plannedEnd
    ? Math.floor((plannedEnd - now) / 1000)
    : null;
  const isOvertime = stintRemainingSec !== null && stintRemainingSec < 0;

  // Pit window: warn 5 minutes before planned end
  const inPitWindow =
    stintRemainingSec !== null &&
    stintRemainingSec >= 0 &&
    stintRemainingSec <= 300;

  // ── Actions ────────────────────────────────────────────────────────────────

  const markPitStop = async () => {
    if (!activeStint || archived || saving) return;
    setSaving(true);
    await supabase
      .from("stints")
      .update({ irl_end_actual: new Date().toISOString() })
      .eq("id", activeStint.id);
    setSaving(false);
    // fetchStints is triggered by the realtime subscription
  };

  const undoLastPit = async () => {
    if (archived || saving) return;
    // Find the last completed stint (most recent actual end)
    const last = [...stints].reverse().find((s) => s.irl_end_actual);
    if (!last) return;
    if (!confirm("Annuler le dernier arrêt au stand ?")) return;
    setSaving(true);
    await supabase
      .from("stints")
      .update({ irl_end_actual: null })
      .eq("id", last.id);
    setSaving(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

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

  // Race finished — all stints completed
  const raceFinished = activeIndex === -1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
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
            {raceRemainingSec !== null
              ? raceRemainingSec > 0
                ? `−${formatCountdown(raceRemainingSec)}`
                : "Course terminée"
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
              background: raceProgressPct >= 100 ? "#2eb460" : "var(--accent)",
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
            {Math.round(raceProgressPct)}%
          </span>
          <span>{raceEnd ? formatTime(raceEnd) : "—"}</span>
        </div>
      </div>

      {/* ── Stint progress pills ───────────────────────────────────────── */}
      <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
        {stints.map((s, i) => {
          const isActive = i === activeIndex;
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

      {raceFinished ? (
        /* ── Race finished state ────────────────────────────────────────── */
        <div
          className="card"
          style={{
            textAlign: "center",
            padding: "2rem",
            borderColor: "#2eb460",
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🏁</div>
          <div
            style={{
              fontFamily: "var(--font-rajdhani), sans-serif",
              fontSize: "1.4rem",
              fontWeight: 700,
              color: "#2eb460",
              marginBottom: "0.25rem",
            }}
          >
            Course terminée
          </div>
          <div style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>
            {completedCount} relais complétés
          </div>
          {!archived && (
            <button
              onClick={undoLastPit}
              className="btn btn-secondary"
              style={{ marginTop: "1rem", fontSize: "0.82rem" }}
              disabled={saving}
            >
              ↩ Annuler dernier arrêt
            </button>
          )}
        </div>
      ) : (
        <>
          {/* ── Active stint card ──────────────────────────────────────── */}
          <div
            className="card"
            style={{
              borderColor: isOvertime
                ? "var(--danger)"
                : inPitWindow
                  ? "#f59e0b"
                  : "var(--accent-dim)",
              background: isOvertime
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
                color: isOvertime
                  ? "var(--danger)"
                  : inPitWindow
                    ? "#f59e0b"
                    : "var(--accent)",
                marginBottom: "0.75rem",
              }}
            >
              {isOvertime
                ? "⚠️ Dépassement — Arrêt au stand"
                : inPitWindow
                  ? "🟡 Fenêtre de stand"
                  : `🟢 En course — Relais ${activeStint.stint_number} / ${stints.length}`}
            </div>

            {/* Driver name */}
            <div
              style={{
                fontFamily: "var(--font-rajdhani), sans-serif",
                fontSize: "2rem",
                fontWeight: 700,
                color: "var(--text)",
                lineHeight: 1,
                marginBottom: "0.5rem",
              }}
            >
              {driverMap[activeStint.driver_id] || (
                <span style={{ color: "var(--text-dim)" }}>À définir</span>
              )}
            </div>

            {/* Stint timing */}
            <div
              style={{
                display: "flex",
                gap: "1.5rem",
                flexWrap: "wrap",
                marginBottom: "1.25rem",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "0.65rem",
                    color: "var(--text-dim)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: "0.15rem",
                  }}
                >
                  Départ relais
                </div>
                <div
                  className="mono"
                  style={{ fontSize: "0.95rem", color: "var(--text)" }}
                >
                  {activeStint.irl_start
                    ? formatTime(activeStint.irl_start)
                    : "—"}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: "0.65rem",
                    color: "var(--text-dim)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: "0.15rem",
                  }}
                >
                  Fin prévue
                </div>
                <div
                  className="mono"
                  style={{ fontSize: "0.95rem", color: "var(--text)" }}
                >
                  {plannedEnd ? formatTime(plannedEnd) : "—"}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: "0.65rem",
                    color: "var(--text-dim)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: "0.15rem",
                  }}
                >
                  {isOvertime ? "Dépassement" : "Temps restant"}
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: 700,
                    color: isOvertime
                      ? "var(--danger)"
                      : inPitWindow
                        ? "#f59e0b"
                        : "var(--text)",
                    lineHeight: 1,
                  }}
                >
                  {stintRemainingSec !== null
                    ? formatCountdown(stintRemainingSec)
                    : "—"}
                </div>
              </div>
            </div>

            {/* Pit stop button */}
            {!archived && (
              <button
                onClick={markPitStop}
                disabled={saving}
                style={{
                  width: "100%",
                  padding: "1rem",
                  fontSize: "1rem",
                  fontFamily: "var(--font-rajdhani), sans-serif",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  background: isOvertime
                    ? "var(--danger)"
                    : inPitWindow
                      ? "#d97706"
                      : "var(--accent)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  cursor: saving ? "wait" : "pointer",
                  opacity: saving ? 0.7 : 1,
                  transition: "all 0.15s",
                }}
              >
                {saving ? "Enregistrement…" : "⏱ Marquer arrêt au stand"}
              </button>
            )}
          </div>

          {/* ── Next stint card ────────────────────────────────────────── */}
          {nextStint && (
            <div
              className="card"
              style={{ opacity: 0.75, borderColor: "var(--border)" }}
            >
              <div
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--text-dim)",
                  marginBottom: "0.5rem",
                }}
              >
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
                {driverMap[nextStint.driver_id] || (
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
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    marginTop: "0.5rem",
                  }}
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

          {/* ── Undo button ─────────────────────────────────────────────── */}
          {!archived && completedCount > 0 && (
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
        </>
      )}

      {/* ── Completed stints summary ───────────────────────────────────── */}
      {completedCount > 0 && (
        <div className="card" style={{ padding: "0.75rem 1rem" }}>
          <div
            style={{
              fontSize: "0.65rem",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--text-dim)",
              marginBottom: "0.5rem",
            }}
          >
            Relais complétés ({completedCount})
          </div>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}
          >
            {stints
              .filter((s) => s.irl_end_actual)
              .map((s) => (
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
                      {driverMap[s.driver_id] || "—"}
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
    </div>
  );
}
