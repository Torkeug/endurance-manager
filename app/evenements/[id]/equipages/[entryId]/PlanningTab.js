"use client";
import { useState, useEffect, useRef } from "react";
import { supabaseBrowser as supabase } from "../../../../../lib/supabase-browser";
import { useTranslations, useLocale } from "next-intl";

// ─── Driver color palette ────────────────────────────────────────────────────
// Cycles when there are more than 8 drivers.
const DRIVER_COLORS = [
  "#7c6af0", // purple
  "#4a9fd4", // blue
  "#2eb460", // green
  "#c9a84c", // amber
  "#e05555", // red
  "#e0855a", // orange
  "#5ac8c8", // teal
  "#c46ab0", // pink
];

// ─── Display helpers ────────────────────────────────────────────────────────

function _formatTime(date, locale) {
  if (!date) return "—";
  return new Date(date).toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDuration(ms) {
  if (!ms || ms <= 0) return "—";
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}`;
  return `${m}min`;
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function PlanningTab({
  teamEntryId,
  teamEntry,
  assignedDrivers,
  currentDriver,
  isActive = false,
  channelSuffix = "",
  showSummary = true,
  strategyId = null,
}) {
  const t = useTranslations("planningTab");
  const locale = useLocale();
  const formatTime = (d) => _formatTime(d, locale);
  const [stints, setStints] = useState([]);
  const [availabilities, setAvailabilities] = useState([]);
  const [strategyLabel, setStrategyLabel] = useState(null);
  const [loading, setLoading] = useState(true);
  // Incremented by the realtime subscription to trigger a re-fetch
  const [refreshTick, setRefreshTick] = useState(0);
  // Hovered stint object — displayed in the detail panel below the Gantt
  const [hoveredStint, setHoveredStint] = useState(null);
  const [now, setNow] = useState(new Date());
  // Tracks whether initial fetch has completed — used to skip re-fetch when inactive
  const hasLoadedOnce = useRef(false);
  // Live clock — updates every 10s for active stint highlight
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(interval);
  }, []);

  // Realtime subscription — any stints change triggers a re-fetch so the Gantt
  // stays live for all concurrent users, not just the local user.
  useEffect(() => {
    if (!teamEntryId) return;
    const tick = () => { if (hasLoadedOnce.current) setRefreshTick((t) => t + 1); };
    const channel = supabase
      .channel(`planning-watch-${teamEntryId}${channelSuffix}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "stints", filter: `team_entry_id=eq.${teamEntryId}` }, tick)
      .on("postgres_changes", { event: "*", schema: "public", table: "strategies", filter: `team_entry_id=eq.${teamEntryId}` }, tick)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [teamEntryId]);

  // ── Fetch active strategy → stints with persisted IRL times ───────────────
  // StintGrid already writes irl_start and irl_end_planned to the DB on every
  // recalc, so we can read them directly without re-running the calc engine.
  useEffect(() => {
    if (!teamEntryId) return;

    // Skip re-fetch if not active — but always fetch on first mount
    // (isActive can be false on initial render due to React batching)
    if (!isActive && hasLoadedOnce.current) return;

    let cancelled = false;

    async function loadStints() {
      if (!hasLoadedOnce.current) setLoading(true);
      try {
        // 1. Fetch strategies and ALL stints for this team entry in parallel —
        //    avoids sequential round trips (strategy fetch → stints fetch).
        //    Stints are filtered client-side once the active strategy is known.
        const [
          { data: strategies, error: stratError },
          { data: allStints, error: stintsError },
          { data: availData },
        ] = await Promise.all([
          supabase
            .from("strategies")
            .select("id, name, description, is_active, actual_start_offset_minutes")
            .eq("team_entry_id", teamEntryId)
            .order("sort_order"),
          supabase
            .from("stints")
            .select(
              "id, strategy_id, stint_number, driver_id, driver_name_snapshot, laps_planned, laps_calc, rain, irl_start, irl_end_planned, irl_end_actual, duration_sec_calc",
            )
            .eq("team_entry_id", teamEntryId)
            .order("stint_number"),
          supabase
            .from("availabilities")
            .select("driver_id, slot_start, available")
            .eq("team_entry_id", teamEntryId),
        ]);

        if (stratError) {
          console.error("[PlanningTab] strategies fetch error:", stratError);
          return;
        }
        if (stintsError) {
          console.error("[PlanningTab] stints fetch error:", stintsError);
          return;
        }
        if (!strategies || strategies.length === 0) {
          if (!cancelled) { setStints([]); setStrategyLabel(null); }
          return;
        }

        // Prefer the marked-active strategy; fall back to first in sort order.
        // When a specific strategyId is requested but no longer exists (deleted),
        // render nothing rather than silently showing a different strategy's data.
        const strategy = strategyId
          ? strategies.find((s) => s.id === strategyId) ?? null
          : strategies.find((s) => s.is_active) ?? strategies[0];

        if (!strategy) {
          if (!cancelled) { setStints([]); setStrategyLabel(null); }
          return;
        }

        if (!cancelled)
          setStrategyLabel(strategy
            ? { name: strategy.name, isActive: strategy.is_active, description: strategy.description }
            : null);

        // Filter stints to the active strategy client-side
        const stintsData = (allStints || []).filter(
          (s) => s.strategy_id === strategy.id,
        );

        if (!cancelled) {
          setStints(stintsData);
          setAvailabilities(availData || []);
        }
      } catch (err) {
        if (!cancelled) console.error("[PlanningTab] unexpected error:", err);
      } finally {
        if (!cancelled) {
          setLoading(false);
          hasLoadedOnce.current = true;
        }
      }
    }

    loadStints();

    // Cleanup — cancels any in-flight fetch result when isActive or teamEntryId changes
    return () => {
      cancelled = true;
    };
  }, [teamEntryId, isActive, refreshTick, strategyId]);

  if (loading)
    return (
      <div className="card">
        <div className="empty">{t("loading")}</div>
      </div>
    );

  // Only render stints whose IRL times have been calculated and persisted
  const validStints = stints.filter(
    (s) => s.irl_start && (s.irl_end_planned || s.irl_end_actual),
  );

  if (stints.length === 0) {
    return (
      <div className="card">
        <div className="empty">
          {t("noStints")}
        </div>
      </div>
    );
  }

  if (validStints.length === 0) {
    return (
      <div className="card">
        <div className="empty">
          {t("noTimesCalculated")}
        </div>
      </div>
    );
  }

  // ── Race end — used to draw a finish marker and extend the timeline ──────────
  const raceEndMs = teamEntry?.event_start_times?.irl_start &&
    teamEntry?.events?.duration_minutes
    ? new Date(teamEntry.event_start_times.irl_start).getTime() +
      teamEntry.events.duration_minutes * 60 * 1000
    : null;

  // ── Timeline bounds ────────────────────────────────────────────────────────
  const timelineStart = Math.min(
    ...validStints.map((s) => new Date(s.irl_start).getTime()),
  );
  // Extend past the last bar by a small buffer so the last pill isn't flush
  // against the edge. Cap at 15 min so short races don't get a huge margin.
  const bufferMs = teamEntry?.events?.duration_minutes
    ? Math.min(teamEntry.events.duration_minutes * 60 * 1000 * 0.03, 15 * 60 * 1000)
    : 0;
  const timelineEnd = Math.max(
    ...validStints.map((s) =>
      new Date(s.irl_end_actual || s.irl_end_planned).getTime(),
    ),
    raceEndMs ? raceEndMs + bufferMs : 0,
  );
  const timelineMs = timelineEnd - timelineStart;

  // Convert an absolute timestamp to a % position on the timeline
  const toPercent = (ts) => ((ts - timelineStart) / timelineMs) * 100;

  // Position of the race-end finish marker on the timeline
  const raceEndPct = raceEndMs != null ? toPercent(raceEndMs) : null;

  // ── Driver → color map (stable index = consistent color per driver) ────────
  const driverColorMap = {};
  assignedDrivers.forEach((d, i) => {
    if (d.drivers?.id)
      driverColorMap[d.drivers.id] = DRIVER_COLORS[i % DRIVER_COLORS.length];
  });

  // ── Current driver's stints — used for the summary card ───────────────────
  const currentDriverId = currentDriver?.id;
  const myStints = validStints.filter((s) => s.driver_id === currentDriverId);

  // ── Night band computation ────────────────────────────────────────────────
  // iRacing time progresses 1:1 with IRL time, so we can compute the IRL
  // offset for any IG clock moment using: offset = (igTime - igStart) in minutes.
  const nightBands = [];
  const igStartStr = teamEntry?.events?.ig_start_time; // "HH:MM"
  const igSunsetStr = teamEntry?.events?.ig_sunset;
  const igSunriseStr = teamEntry?.events?.ig_sunrise;
  const irlRaceStart = teamEntry?.event_start_times?.irl_start;

  if (igStartStr && igSunsetStr && igSunriseStr && irlRaceStart) {
    const toMinutes = (str) => {
      const [h, m] = str.split(":").map(Number);
      return h * 60 + m;
    };
    const igStartMin = toMinutes(igStartStr);
    const sunsetMin = toMinutes(igSunsetStr);
    const sunriseMin = toMinutes(igSunriseStr);
    const irlStartMs = new Date(irlRaceStart).getTime();

    // Convert an IG minute-of-day value to an IRL timestamp
    const igMinToIrlMs = (igMin) => {
      let offsetMin = igMin - igStartMin;
      if (offsetMin < 0) offsetMin += 24 * 60; // handle midnight crossing
      return irlStartMs + offsetMin * 60 * 1000;
    };

    const sunsetIrlMs = igMinToIrlMs(sunsetMin);
    // Sunrise is always after sunset — add the gap, wrapping over midnight if needed
    const nightDurationMin = (sunriseMin - sunsetMin + 24 * 60) % (24 * 60);
    const sunriseIrlMs = sunsetIrlMs + nightDurationMin * 60 * 1000;

    // Clamp to visible timeline and only render if the band overlaps
    if (sunsetIrlMs < timelineEnd && sunriseIrlMs > timelineStart) {
      const bandStart = Math.max(sunsetIrlMs, timelineStart);
      const bandEnd = Math.min(sunriseIrlMs, timelineEnd);
      nightBands.push({
        left: toPercent(bandStart),
        width: toPercent(bandEnd) - toPercent(bandStart),
      });
    }
  }

  // ── Hour tick marks ────────────────────────────────────────────────────────
  // All hours are always labeled. On dense timelines, odd-indexed ticks are
  // shifted up so consecutive labels never overlap horizontally.
  const estPxPerHour = 450 / (timelineMs / 3600000);
  const stagger = estPxPerHour < 40; // stagger when labels would overlap

  const hourTicks = [];
  const firstHour = new Date(timelineStart);
  firstHour.setMinutes(0, 0, 0);
  if (firstHour.getTime() < timelineStart)
    firstHour.setHours(firstHour.getHours() + 1);
  let tick = firstHour.getTime();
  let tickIndex = 0;
  while (tick <= timelineEnd) {
    hourTicks.push({ ts: tick, label: formatTime(new Date(tick)), staggerUp: stagger && tickIndex % 2 === 1 });
    tick += 60 * 60 * 1000;
    tickIndex++;
  }

  // ── Gantt rows — one per assigned driver ──────────────────────────────────
  const rows = assignedDrivers.map((d) => ({
    driverId: d.drivers?.id,
    driverName: d.drivers?.name || "—",
    color: driverColorMap[d.drivers?.id] || DRIVER_COLORS[0],
    stints: validStints.filter((s) => s.driver_id === d.drivers?.id),
    isCurrentDriver: d.drivers?.id === currentDriverId,
  }));

  // Unassigned stints — rendered at the bottom of the chart
  const unassignedStints = validStints.filter((s) => !s.driver_id);

  // ── Shared row bar area renderer ───────────────────────────────────────────
  // Extracted to avoid repetition between driver rows and the unassigned row.
    const renderBarArea = (rowStints, color, isUnassigned = false, driverId = null) => (
    <div
      style={{
        position: "relative",
        flex: 1,
        height: "32px",
        background: "var(--surface-2)",
        borderRadius: "3px",
        overflow: "hidden",
      }}
    >
      {/* Availability background strips — rendered first, behind everything else */}
      {driverId && availabilities
        .filter((a) => a.driver_id === driverId)
        .map((a) => {
          const slotStart = new Date(a.slot_start).getTime();
          const slotEnd = slotStart + 30 * 60 * 1000; // 30min slots
          // Only render slots that overlap the visible timeline
          if (slotEnd <= timelineStart || slotStart >= timelineEnd) return null;
          const left = toPercent(Math.max(slotStart, timelineStart));
          const width = toPercent(Math.min(slotEnd, timelineEnd)) - left;
          const bg =
            a.available === true
              ? "rgba(46,180,96,0.18)"
              : a.available === false
                ? "rgba(224,85,85,0.18)"
                : "rgba(74,74,106,0.12)"; // null = tentative
          return (
            <div
              key={a.slot_start}
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: `${left}%`,
                width: `${width}%`,
                background: bg,
                pointerEvents: "none",
                zIndex: 0,
              }}
            />
          );
        })}

      {/* Night band overlay — rendered behind stint bars */}
      {nightBands.map((band, bi) => (
        <div
          key={bi}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${band.left}%`,
            width: `${band.width}%`,
            background: "rgba(10, 10, 30, 0.45)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
      ))}

      {/* Race-end marker — vertical line at the checkered flag moment */}
      {raceEndPct != null && (
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${raceEndPct}%`,
            width: "2px",
            background: "rgba(224, 85, 85, 0.5)",
            pointerEvents: "none",
            zIndex: 2,
          }}
        />
      )}

      {/* Stint bars */}
      {rowStints.map((stint) => {
        const startMs = new Date(stint.irl_start).getTime();
        const endMs = new Date(
          stint.irl_end_actual || stint.irl_end_planned,
        ).getTime();
        const left = toPercent(startMs);
        const isHovered = hoveredStint?.id === stint.id;
        const isPast =
          !!stint.irl_end_actual ||
          (stint.irl_end_planned && new Date(stint.irl_end_planned) <= now);
        const isActive =
          stint.irl_start &&
          stint.irl_end_planned &&
          new Date(stint.irl_start) <= now &&
          new Date(stint.irl_end_planned) > now &&
          !stint.irl_end_actual;

        // Rain stints use a blue tint instead of the driver color
        const barColor = stint.rain
          ? "rgba(74, 159, 212, 0.8)"
          : isUnassigned
            ? "rgba(120, 120, 140, 0.45)"
            : color;

        const barWidth = Math.min(Math.max(toPercent(endMs) - left, 0.5), 100 - left);

        return (
          <div
            key={stint.id}
            onMouseEnter={() =>
              setHoveredStint({ ...stint, _startMs: startMs, _endMs: endMs })
            }
            onMouseLeave={() => setHoveredStint(null)}
            style={{
              position: "absolute",
              top: "4px",
              bottom: "4px",
              left: `${left}%`,
              width: `${barWidth}%`,
              background: barColor,
              borderRadius: "3px",
              border: isUnassigned ? "1px dashed var(--border)" : "none",
              display: "flex",
              alignItems: "center",
              paddingLeft: "5px",
              overflow: "hidden",
              cursor: "default",
              boxShadow: isActive
                ? "0 0 0 2px var(--accent)"
                : isHovered
                  ? "0 0 0 2px rgba(255,255,255,0.7)"
                  : "none",
              opacity: isHovered
                ? 1
                : isActive
                  ? 1
                  : isUnassigned
                    ? 0.7
                    : isPast
                      ? 0.5
                      : 0.88,
              filter: isPast && !isUnassigned ? "saturate(0.4)" : "none",
              zIndex: 1,
              transition: "opacity 0.1s, box-shadow 0.1s",
            }}
            title={`${t("stint")} ${stint.stint_number}${stint.laps_planned ? ` · ${stint.laps_planned} ${t("laps")}` : ""}`}
          >
            <span
              style={{
                fontSize: "0.62rem",
                fontWeight: 700,
                color: isUnassigned ? "var(--text-dim)" : "#fff",
                whiteSpace: "nowrap",
                textShadow: isUnassigned ? "none" : "0 1px 2px rgba(0,0,0,0.5)",
              }}
            >
              R{stint.stint_number}
              {stint.rain ? " 🌧" : ""}
            </span>
          </div>
        );
      })}

      {/* Empty state label for rows with no stints */}
      {rowStints.length === 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            paddingLeft: "8px",
          }}
        >
          <span
            style={{
              fontSize: "0.65rem",
              color: "var(--text-dim)",
              fontStyle: "italic",
              opacity: 0.5,
            }}
          >
            {t("unassigned")}
          </span>
        </div>
      )}
    </div>
  );

  return (
    <div>
      {/* ── Summary card — current driver's stints only ──────────────────── */}
      {showSummary && myStints.length > 0 && (
        <div
          style={{
            marginBottom: "1.5rem",
            padding: "1rem 1.25rem",
            background: "rgba(var(--accent-rgb), 0.06)",
            border: "1px solid var(--accent)",
            borderRadius: "4px",
          }}
        >
          <div
            style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--accent)",
              marginBottom: "0.75rem",
            }}
          >
            {t("yourStints")}
          </div>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
          >
            {myStints.map((s) => {
              const start = new Date(s.irl_start);
              const end = s.irl_end_actual
                ? new Date(s.irl_end_actual)
                : new Date(s.irl_end_planned);
              // Prefer engine-persisted duration — avoids stale irl_start discrepancy.
              // Fall back to end - start when not yet populated.
              const durationMs = s.irl_end_actual
                ? end - start // actual: use real elapsed time
                : s.duration_sec_calc
                  ? s.duration_sec_calc * 1000
                  : end - start;
              return (
                <div
                  key={s.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                    flexWrap: "wrap",
                  }}
                >
                  {/* Stint number */}
                  <span
                    style={{
                      fontFamily: "var(--font-mono), monospace",
                      fontSize: "0.78rem",
                      color: "var(--text-dim)",
                      minWidth: "64px",
                    }}
                  >
                    {t("stint")} {s.stint_number}
                  </span>

                  {/* IRL window */}
                  <span
                    className="mono"
                    style={{ fontSize: "0.85rem", fontWeight: 600 }}
                  >
                    {formatTime(start)} → {formatTime(end)}
                  </span>

                  {/* Duration — green + "réel" label when actual end is stamped */}
                  {s.irl_end_actual ? (
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.35rem",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.85rem",
                          fontWeight: 700,
                          color: "#2eb460",
                        }}
                      >
                        {formatDuration(durationMs)}
                      </span>
                      <span
                        style={{
                          fontSize: "0.68rem",
                          color: "#2eb460",
                          opacity: 0.8,
                        }}
                      >
                        {t("actual")}
                      </span>
                    </span>
                  ) : (
                    <span
                      style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}
                    >
                      {formatDuration(durationMs)}
                    </span>
                  )}

                  {/* Laps — manually set takes priority, fall back to engine-calculated */}
                  {(s.laps_planned || s.laps_calc) && (
                    <span
                      style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}
                    >
                      · {s.laps_planned || s.laps_calc} {t("laps")}
                      {!s.laps_planned && (
                        <span style={{ opacity: 0.6 }}> *</span>
                      )}
                    </span>
                  )}

                  {/* Rain flag */}
                  {s.rain && (
                    <span style={{ fontSize: "0.8rem" }} title={t("rainTitle")}>
                      🌧
                    </span>
                  )}

                  {/* Completed badge — stamped or planned end already passed */}
                  {(s.irl_end_actual ||
                    new Date(s.irl_end_planned) <= new Date()) && (
                    <span
                      style={{
                        fontSize: "0.72rem",
                        color: "#2eb460",
                        background: "rgba(46,180,96,0.1)",
                        border: "1px solid rgba(46,180,96,0.3)",
                        borderRadius: "3px",
                        padding: "0.1rem 0.4rem",
                      }}
                    >
                      {t("completed")}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Gantt chart ──────────────────────────────────────────────────── */}
      {/* Active strategy label — only shown in standalone Planning tab */}
      {strategyId === null && strategyLabel && (
        <div
          style={{
            marginBottom: "0.75rem",
            textAlign: "center",
            fontSize: "0.78rem",
            color: "var(--text-dim)",
          }}
        >
          {t("activeStrategy")}{" "}
          <span style={{ fontWeight: 700, color: "var(--text)" }}>
            {strategyLabel.name}
          </span>
          {strategyLabel.description && (
            <span> — {strategyLabel.description}</span>
          )}
        </div>
      )}

      {/* overflowX: auto allows horizontal scroll on narrow screens and when zoomed in.
          Page max-width: 1200px means zoom-creates-scroll naturally once the
          CSS viewport drops below 1200px (~160% zoom on 1920px screens). */}
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: "600px", paddingRight: "20px" }}>
          {/* Race-end flag row — above the hour axis so it doesn't overlap ticks */}
          {raceEndPct != null && (
            <div
              style={{
                position: "relative",
                height: "14px",
                marginLeft: "130px",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: `${raceEndPct}%`,
                  transform: "translateX(-50%)",
                  fontSize: "0.72rem",
                  lineHeight: 1,
                }}
              >
                🏁
              </div>
            </div>
          )}

          {/* Hour axis — positioned above the chart rows.
              When staggering, height doubles to 36px to fit two label rows. */}
          <div
            style={{
              position: "relative",
              height: stagger ? "36px" : "20px",
              marginLeft: "130px",
              marginBottom: "4px",
            }}
          >
            {hourTicks.map(({ ts, label, staggerUp }) => (
              <div
                key={ts}
                style={{
                  position: "absolute",
                  left: `${toPercent(ts)}%`,
                  transform: "translateX(-50%)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "2px",
                  // Odd ticks sit at the top row, even at the bottom row
                  top: staggerUp ? "0" : undefined,
                  bottom: staggerUp ? undefined : "0",
                }}
              >
                <span style={{
                  fontSize: "0.65rem",
                  color: "var(--text-dim)",
                  fontFamily: "var(--font-mono), monospace",
                  whiteSpace: "nowrap",
                }}>
                  {label}
                </span>
                <div style={{
                  width: "1px",
                  height: staggerUp ? "14px" : "5px",
                  background: "var(--border)",
                }} />
              </div>
            ))}
          </div>

          {/* Driver rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {rows.map(
              ({
                driverId,
                driverName,
                color,
                stints: rowStints,
                isCurrentDriver,
              }) => (
                <div
                  key={driverId}
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  {/* Driver label — accent color + bold for current driver */}
                  <div
                    style={{
                      width: "122px",
                      flexShrink: 0,
                      fontSize: "0.78rem",
                      fontWeight: isCurrentDriver ? 700 : 400,
                      color: isCurrentDriver
                        ? "var(--accent)"
                        : "var(--text-dim)",
                      textAlign: "right",
                      paddingRight: "8px",
                      // Accent border on the right edge for the current driver row
                      borderRight: isCurrentDriver
                        ? "2px solid var(--accent)"
                        : "2px solid var(--border)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={driverName}
                  >
                    {driverName}
                  </div>

                  {/* Bar area — contains availability bg, night overlay + stint bars */}
                  {renderBarArea(rowStints, color, false, driverId)}
                </div>
              ),
            )}

            {/* Unassigned row — only rendered when stints have no driver yet */}
            {unassignedStints.length > 0 && (
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <div
                  style={{
                    width: "122px",
                    flexShrink: 0,
                    fontSize: "0.78rem",
                    color: "var(--text-dim)",
                    textAlign: "right",
                    paddingRight: "8px",
                    borderRight: "2px solid var(--border)",
                    fontStyle: "italic",
                  }}
                >
                  {t("unassigned")}
                </div>
                {renderBarArea(unassignedStints, null, true)}
              </div>
            )}
          </div>

          {/* ── Hover detail panel ──────────────────────────────────────────── */}
          {/* Shows enriched info for the currently hovered stint bar */}
          <div
            style={{
              marginTop: "0.75rem",
              minHeight: "40px",
            }}
          >
            {hoveredStint ? (
              <div
                style={{
                  padding: "0.65rem 0.9rem",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "4px",
                  fontSize: "0.82rem",
                  display: "flex",
                  gap: "1.25rem",
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <span style={{ fontWeight: 700 }}>
                  {t("stint")} {hoveredStint.stint_number}
                </span>
                <span className="mono">
                  {formatTime(new Date(hoveredStint._startMs))} →{" "}
                  {formatTime(new Date(hoveredStint._endMs))}
                </span>
                <span style={{ color: "var(--text-dim)" }}>
                  {formatDuration(hoveredStint._endMs - hoveredStint._startMs)}
                </span>
                {hoveredStint.laps_planned && (
                  <span style={{ color: "var(--text-dim)" }}>
                    {hoveredStint.laps_planned} {t("laps")}
                  </span>
                )}
                {hoveredStint.rain && <span>🌧 {t("rain")}</span>}
                {hoveredStint.irl_end_actual && (
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "#2eb460",
                      background: "rgba(46,180,96,0.1)",
                      border: "1px solid rgba(46,180,96,0.3)",
                      borderRadius: "3px",
                      padding: "0.1rem 0.4rem",
                    }}
                  >
                    {t("completed")}
                  </span>
                )}
              </div>
            ) : (
              // Placeholder so the layout doesn't shift on hover
              <div
                style={{
                  padding: "0.65rem 0.9rem",
                  fontSize: "0.75rem",
                  color: "var(--text-dim)",
                  fontStyle: "italic",
                  opacity: 0.5,
                }}
              >
                {t("hoverHint")}
              </div>
            )}
          </div>

          {/* ── Legend ──────────────────────────────────────────────────────── */}
          <div
            style={{
              marginTop: "0.75rem",
              display: "flex",
              gap: "1.25rem",
              flexWrap: "wrap",
              fontSize: "0.72rem",
              color: "var(--text-dim)",
              alignItems: "center",
            }}
          >
            {/* Availability swatches */}
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ display: "inline-block", width: "12px", height: "10px", background: "rgba(46,180,96,0.35)", border: "1px solid var(--border)", borderRadius: "2px" }} />
              {t("legendAvailable")}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ display: "inline-block", width: "12px", height: "10px", background: "rgba(224,85,85,0.35)", border: "1px solid var(--border)", borderRadius: "2px" }} />
              {t("legendUnavailable")}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ display: "inline-block", width: "12px", height: "10px", background: "rgba(74,74,106,0.35)", border: "1px solid var(--border)", borderRadius: "2px" }} />
              {t("legendUncertain")}
            </span>

            {/* Night band swatch */}
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span
                style={{
                  display: "inline-block",
                  width: "12px",
                  height: "10px",
                  background: "rgba(10,10,30,0.45)",
                  border: "1px solid var(--border)",
                  borderRadius: "2px",
                }}
              />
              {t("legendNight")}
            </span>

            {/* Rain swatch */}
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span
                style={{
                  display: "inline-block",
                  width: "12px",
                  height: "10px",
                  background: "rgba(74,159,212,0.8)",
                  borderRadius: "2px",
                }}
              />
              🌧 {t("rain")}
            </span>

            {/* Current driver highlight explanation */}
            {currentDriverId && (
              <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                {t("yourHighlight")}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
