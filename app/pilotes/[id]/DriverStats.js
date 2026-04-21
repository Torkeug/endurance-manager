"use client";
import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format lap time in seconds to M:SS.mmm */
function formatLapTime(sec) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(3);
  return `${m}:${String(s).padStart(6, "0")}`;
}

/** Mirror of StintGrid's getIGTime — offset from race IRL start */
function getIGTime(irlTime, raceIrlStart, igStartTimeStr) {
  if (!igStartTimeStr || !raceIrlStart || !irlTime) return null;
  const [igH, igM] = igStartTimeStr.split(":").map(Number);
  const irlStart = new Date(raceIrlStart);
  const igStart = new Date(irlStart);
  igStart.setHours(igH, igM, 0, 0);
  return new Date(igStart.getTime() + (new Date(irlTime) - irlStart));
}

/** Mirror of StintGrid's getPhase */
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

/** Returns true if a stint started during night conditions */
function isNightStint(stint) {
  const event = stint.team_entries?.events;
  const raceStart = stint.team_entries?.event_start_times?.irl_start;
  if (!event?.ig_start_time || !raceStart || !stint.irl_start) return false;
  const igTime = getIGTime(stint.irl_start, raceStart, event.ig_start_time);
  return getPhase(igTime, event.ig_sunrise, event.ig_sunset) === "🌑";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Summary stat card */
function StatCard({ label, value, sub, color }) {
  return (
    <div
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderRadius: "4px",
        padding: "0.75rem 1rem",
        flex: 1,
        minWidth: "100px",
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
        style={{
          fontSize: "1.1rem",
          fontWeight: 700,
          color: color || "var(--text)",
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontSize: "0.72rem",
            color: "var(--text-dim)",
            marginTop: "0.1rem",
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

/** Horizontal bar with label and count */
function MiniBar({ value, label, count, color }) {
  return (
    <div style={{ marginBottom: "0.6rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "0.78rem",
          marginBottom: "0.25rem",
        }}
      >
        <span style={{ color: "var(--text-dim)" }}>{label}</span>
        <span className="mono" style={{ color }}>
          {Math.round(value)}%{" "}
          <span style={{ color: "var(--text-dim)", fontSize: "0.72rem" }}>
            ({count} relais)
          </span>
        </span>
      </div>
      <div
        style={{
          height: "6px",
          background: "var(--border)",
          borderRadius: "3px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${Math.min(100, value)}%`,
            background: color,
            borderRadius: "3px",
            transition: "width 0.4s",
          }}
        />
      </div>
    </div>
  );
}

/** Section label */
function SectionHeader({ title }) {
  return (
    <div
      style={{
        fontSize: "0.7rem",
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "var(--text-dim)",
        marginBottom: "0.75rem",
      }}
    >
      {title}
    </div>
  );
}

// ─── iRating chart tooltip ───────────────────────────────────────────────────

function IRatingTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { irating, recorded_at } = payload[0].payload;
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "4px",
        padding: "0.5rem 0.75rem",
        fontSize: "0.78rem",
      }}
    >
      <div
        className="mono"
        style={{ color: "var(--accent)", fontWeight: 700, fontSize: "0.95rem" }}
      >
        {irating} iR
      </div>
      <div style={{ color: "var(--text-dim)", marginTop: "0.1rem" }}>
        {new Date(recorded_at).toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })}
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function DriverStats({
  stints,
  driverPerfData,
  teamPerfData,
  teammatesData,
  signups,
  iratingHistory = [],
  currentIrating = null,
}) {
  const [showAllTeammates, setShowAllTeammates] = useState(false);

  // ── Totals ─────────────────────────────────────────────────────────────────
  const totalRaces = new Set(
    (signups || []).map((s) => s.events?.id).filter(Boolean),
  ).size;

  const totalChampionships = new Set(
    (signups || []).map((s) => s.events?.championship_id).filter(Boolean),
  ).size;

  const totalStints = (stints || []).length;

  // Sum laps_planned — best approximation without re-running the calc engine
  const totalLaps = (stints || []).reduce(
    (sum, s) => sum + (s.laps_planned || 0),
    0,
  );

  const rainStints = (stints || []).filter((s) => s.rain).length;
  const rainPct = totalStints > 0 ? (rainStints / totalStints) * 100 : 0;

  const nightStintsCount = (stints || []).filter(isNightStint).length;
  const nightPct = totalStints > 0 ? (nightStintsCount / totalStints) * 100 : 0;

  // ── Most used circuits ─────────────────────────────────────────────────────
  const circuitCounts = {};
  (signups || []).forEach((s) => {
    const name = s.events?.circuits?.name;
    if (!name) return;
    circuitCounts[name] = (circuitCounts[name] || 0) + 1;
  });
  const sortedCircuits = Object.entries(circuitCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // ── Most used cars ─────────────────────────────────────────────────────────
  const carCounts = {};
  (signups || []).forEach((s) => {
    const name = s.team_entries?.cars?.name;
    if (!name) return;
    carCounts[name] = (carCounts[name] || 0) + 1;
  });
  const sortedCars = Object.entries(carCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // ── Lap times by circuit ───────────────────────────────────────────────────
  // Group performance records by circuit, keep best (lowest) lap times per condition
  const circuitMap = {};
  (driverPerfData || []).forEach((p) => {
    const circuit = p.team_entries?.events?.circuits?.name;
    if (!circuit) return;
    if (!circuitMap[circuit])
      circuitMap[circuit] = { dry: [], wet: [], nightDry: [], nightWet: [] };
    if (p.lap_time_dry) circuitMap[circuit].dry.push(p.lap_time_dry);
    if (p.lap_time_wet) circuitMap[circuit].wet.push(p.lap_time_wet);
    if (p.lap_time_night_dry)
      circuitMap[circuit].nightDry.push(p.lap_time_night_dry);
    if (p.lap_time_night_wet)
      circuitMap[circuit].nightWet.push(p.lap_time_night_wet);
  });

  const circuitStats = Object.entries(circuitMap)
    .map(([name, times]) => ({
      name,
      bestDry: times.dry.length > 0 ? Math.min(...times.dry) : null,
      bestWet: times.wet.length > 0 ? Math.min(...times.wet) : null,
      bestNightDry:
        times.nightDry.length > 0 ? Math.min(...times.nightDry) : null,
      bestNightWet:
        times.nightWet.length > 0 ? Math.min(...times.nightWet) : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // ── Fuel efficiency vs team average ───────────────────────────────────────
  // Compare driver's fuel consumption against the average of all teammates
  // for the same team entry and condition
  const fuelRows = (driverPerfData || [])
    .filter((p) => p.fuel_dry || p.fuel_wet)
    .map((p) => {
      const teammates = (teamPerfData || []).filter(
        (t) => t.team_entry_id === p.team_entry_id,
      );

      const teamDryFuels = teammates.map((t) => t.fuel_dry).filter(Boolean);
      const teamAvgDry =
        teamDryFuels.length > 0
          ? teamDryFuels.reduce((s, f) => s + f, 0) / teamDryFuels.length
          : null;

      const teamWetFuels = teammates.map((t) => t.fuel_wet).filter(Boolean);
      const teamAvgWet =
        teamWetFuels.length > 0
          ? teamWetFuels.reduce((s, f) => s + f, 0) / teamWetFuels.length
          : null;

      return {
        teamEntryId: p.team_entry_id,
        eventName: p.team_entries?.events?.name || "—",
        circuit: p.team_entries?.events?.circuits?.name || "—",
        driverFuelDry: p.fuel_dry,
        driverFuelWet: p.fuel_wet,
        teamAvgDry,
        teamAvgWet,
        // Positive diff = driver uses more fuel than team average
        diffDry: p.fuel_dry && teamAvgDry ? p.fuel_dry - teamAvgDry : null,
        diffWet: p.fuel_wet && teamAvgWet ? p.fuel_wet - teamAvgWet : null,
      };
    });

  // ── Teammates ──────────────────────────────────────────────────────────────
  // Count how many times each driver has shared a team entry with this driver
  const teammateCounts = {};
  (teammatesData || []).forEach((t) => {
    const driverId = t.drivers?.id;
    const name = t.drivers?.name;
    if (!driverId || !name) return;
    if (!teammateCounts[driverId])
      teammateCounts[driverId] = { name, count: 0 };
    teammateCounts[driverId].count++;
  });

  const sortedTeammates = Object.values(teammateCounts).sort(
    (a, b) => b.count - a.count,
  );
  const displayedTeammates = showAllTeammates
    ? sortedTeammates
    : sortedTeammates.slice(0, 5);

  // ── iRating chart data ─────────────────────────────────────────────────────
  // Merge history with current iRating for display.
  // If current iRating differs from the last history entry, append it as "now".
  const chartData = (() => {
    if (iratingHistory.length === 0 && !currentIrating) return [];
    const points = iratingHistory.map((h) => ({
      irating: h.irating,
      recorded_at: h.recorded_at,
    }));
    // Append current value if it differs from last recorded or history is empty
    const last = points[points.length - 1];
    if (currentIrating && (!last || last.irating !== currentIrating)) {
      points.push({
        irating: currentIrating,
        recorded_at: new Date().toISOString(),
      });
    }
    return points;
  })();

  // Y axis domain with padding
  const iratingValues = chartData.map((p) => p.irating);
  const iratingMin = iratingValues.length > 0 ? Math.min(...iratingValues) : 0;
  const iratingMax =
    iratingValues.length > 0 ? Math.max(...iratingValues) : 2000;
  const yPadding = Math.max(100, Math.round((iratingMax - iratingMin) * 0.2));
  const yDomain = [Math.max(0, iratingMin - yPadding), iratingMax + yPadding];

  // ── Empty state ────────────────────────────────────────────────────────────
  if (totalStints === 0 && (driverPerfData || []).length === 0) {
    return (
      <div className="card">
        <div className="empty">
          Aucune donnée statistique disponible pour ce pilote.
        </div>
      </div>
    );
  }

  const TH = {
    background: "var(--surface-2)",
    color: "var(--text-dim)",
    fontSize: "0.65rem",
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    padding: "0.5rem 0.75rem",
    borderBottom: "2px solid var(--border)",
    whiteSpace: "nowrap",
    textAlign: "left",
  };

  const TD = {
    padding: "0.4rem 0.75rem",
    borderBottom: "1px solid var(--border)",
    fontSize: "0.82rem",
    verticalAlign: "middle",
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* ── Summary cards ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <StatCard label="Courses" value={totalRaces} />
        {totalChampionships > 0 && (
          <StatCard label="Championnats" value={totalChampionships} />
        )}
        <StatCard label="Relais" value={totalStints} />
        <StatCard
          label="Tours"
          value={totalLaps > 0 ? totalLaps : "—"}
          sub={totalLaps > 0 ? "estimés" : null}
        />
      </div>

      {/* ── iRating history ───────────────────────────────────────────── */}
      {chartData.length > 1 ? (
        <div className="card">
          <SectionHeader title="Évolution iRating" />
          <div style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
              >
                <XAxis
                  dataKey="recorded_at"
                  tickFormatter={(val) =>
                    new Date(val).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                    })
                  }
                  tick={{ fill: "var(--text-dim)", fontSize: 10 }}
                  axisLine={{ stroke: "var(--border)" }}
                  tickLine={false}
                  minTickGap={40}
                />
                <YAxis
                  domain={yDomain}
                  tick={{ fill: "var(--text-dim)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  tickFormatter={(v) => `${v}`}
                />
                <Tooltip content={<IRatingTooltip />} />
                {/* Reference line at current iRating */}
                {currentIrating && (
                  <ReferenceLine
                    y={currentIrating}
                    stroke="var(--accent)"
                    strokeDasharray="4 3"
                    strokeOpacity={0.4}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="irating"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={{ fill: "var(--accent)", r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "var(--accent)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {/* Min / max annotation */}
          {iratingValues.length > 1 && (
            <div
              style={{
                display: "flex",
                gap: "1rem",
                marginTop: "0.5rem",
                fontSize: "0.72rem",
                color: "var(--text-dim)",
                flexWrap: "wrap",
              }}
            >
              <span>
                Min :{" "}
                <span className="mono" style={{ color: "var(--text)" }}>
                  {iratingMin} iR
                </span>
              </span>
              <span>
                Max :{" "}
                <span className="mono" style={{ color: "var(--text)" }}>
                  {iratingMax} iR
                </span>
              </span>
              <span>
                Δ :{" "}
                <span
                  className="mono"
                  style={{
                    color:
                      iratingMax - iratingMin === 0
                        ? "var(--text-dim)"
                        : chartData[chartData.length - 1]?.irating >
                            chartData[0]?.irating
                          ? "#2eb460"
                          : "var(--danger)",
                  }}
                >
                  {chartData[chartData.length - 1]?.irating >
                  chartData[0]?.irating
                    ? "+"
                    : ""}
                  {(chartData[chartData.length - 1]?.irating ?? 0) -
                    (chartData[0]?.irating ?? 0)}{" "}
                  iR
                </span>
              </span>
              <span style={{ marginLeft: "auto" }}>
                {chartData.length} point{chartData.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      ) : currentIrating ? (
        // Single data point — just show current iRating, no graph yet
        <div className="card">
          <SectionHeader title="Évolution iRating" />
          <div style={{ color: "var(--text-dim)", fontSize: "0.82rem" }}>
            Pas encore assez de données pour afficher un graphique. Le graphique
            apparaîtra après plusieurs synchronisations.
          </div>
        </div>
      ) : null}

      {/* ── Conditions ────────────────────────────────────────────────── */}
      {totalStints > 0 && (rainStints > 0 || nightStintsCount > 0) && (
        <div className="card">
          <SectionHeader title="Conditions" />
          {rainStints > 0 && (
            <MiniBar
              value={rainPct}
              label="Pluie 💧"
              count={rainStints}
              color="#4a9fd4"
            />
          )}
          {nightStintsCount > 0 && (
            <MiniBar
              value={nightPct}
              label="Nuit 🌑"
              count={nightStintsCount}
              color="#8b5cf6"
            />
          )}
        </div>
      )}

      {/* ── Lap times by circuit ──────────────────────────────────────── */}
      {circuitStats.length > 0 && (
        <div>
          <SectionHeader title="Chronos par circuit" />
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: "4px",
              overflow: "hidden",
              overflowX: "auto",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "400px",
              }}
            >
              <thead>
                <tr>
                  <th style={TH}>Circuit</th>
                  <th style={{ ...TH, textAlign: "right" }}>Sec ☀️</th>
                  <th style={{ ...TH, textAlign: "right" }}>Pluie 💧</th>
                  <th style={{ ...TH, textAlign: "right" }}>Nuit sec 🌑</th>
                  <th style={{ ...TH, textAlign: "right" }}>Nuit pluie</th>
                </tr>
              </thead>
              <tbody>
                {circuitStats.map((c, i) => (
                  <tr
                    key={c.name}
                    style={{
                      background:
                        i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                    }}
                  >
                    <td style={{ ...TD, fontWeight: 600 }}>{c.name}</td>
                    <td
                      style={{
                        ...TD,
                        textAlign: "right",
                        fontFamily: "var(--font-mono), monospace",
                        color: c.bestDry ? "var(--accent)" : "var(--text-dim)",
                      }}
                    >
                      {formatLapTime(c.bestDry)}
                    </td>
                    <td
                      style={{
                        ...TD,
                        textAlign: "right",
                        fontFamily: "var(--font-mono), monospace",
                        color: c.bestWet ? "#4a9fd4" : "var(--text-dim)",
                      }}
                    >
                      {formatLapTime(c.bestWet)}
                    </td>
                    <td
                      style={{
                        ...TD,
                        textAlign: "right",
                        fontFamily: "var(--font-mono), monospace",
                        color: c.bestNightDry ? "#8b5cf6" : "var(--text-dim)",
                      }}
                    >
                      {formatLapTime(c.bestNightDry)}
                    </td>
                    <td
                      style={{
                        ...TD,
                        textAlign: "right",
                        fontFamily: "var(--font-mono), monospace",
                        color: c.bestNightWet ? "#6366f1" : "var(--text-dim)",
                      }}
                    >
                      {formatLapTime(c.bestNightWet)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Fuel efficiency ───────────────────────────────────────────── */}
      {fuelRows.length > 0 && (
        <div>
          <SectionHeader title="Consommation vs équipe" />
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: "4px",
              overflow: "hidden",
              overflowX: "auto",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "560px",
              }}
            >
              <thead>
                <tr>
                  <th style={TH}>Événement</th>
                  <th style={TH}>Circuit</th>
                  <th style={{ ...TH, textAlign: "right" }}>Pilote ☀️</th>
                  <th style={{ ...TH, textAlign: "right" }}>Équipe ☀️</th>
                  <th style={{ ...TH, textAlign: "right" }}>Écart</th>
                  <th style={{ ...TH, textAlign: "right" }}>Pilote 💧</th>
                  <th style={{ ...TH, textAlign: "right" }}>Équipe 💧</th>
                  <th style={{ ...TH, textAlign: "right" }}>Écart</th>
                </tr>
              </thead>
              <tbody>
                {fuelRows.map((r, i) => {
                  const dryDiffColor =
                    r.diffDry === null
                      ? "var(--text-dim)"
                      : Math.abs(r.diffDry) < 0.05
                        ? "#2eb460"
                        : r.diffDry > 0
                          ? "var(--danger)"
                          : "#2eb460";
                  const wetDiffColor =
                    r.diffWet === null
                      ? "var(--text-dim)"
                      : Math.abs(r.diffWet) < 0.05
                        ? "#2eb460"
                        : r.diffWet > 0
                          ? "var(--danger)"
                          : "#2eb460";
                  return (
                    <tr
                      key={r.teamEntryId}
                      style={{
                        background:
                          i % 2 === 0
                            ? "transparent"
                            : "rgba(255,255,255,0.02)",
                      }}
                    >
                      <td style={{ ...TD, fontWeight: 600 }}>{r.eventName}</td>
                      <td style={{ ...TD, color: "var(--text-dim)" }}>
                        {r.circuit}
                      </td>
                      <td
                        style={{
                          ...TD,
                          textAlign: "right",
                          fontFamily: "var(--font-mono), monospace",
                        }}
                      >
                        {r.driverFuelDry
                          ? `${r.driverFuelDry.toFixed(2)}L`
                          : "—"}
                      </td>
                      <td
                        style={{
                          ...TD,
                          textAlign: "right",
                          fontFamily: "var(--font-mono), monospace",
                          color: "var(--text-dim)",
                        }}
                      >
                        {r.teamAvgDry ? `${r.teamAvgDry.toFixed(2)}L` : "—"}
                      </td>
                      <td
                        style={{
                          ...TD,
                          textAlign: "right",
                          fontFamily: "var(--font-mono), monospace",
                          fontWeight: 700,
                          color: dryDiffColor,
                        }}
                      >
                        {r.diffDry !== null
                          ? `${r.diffDry > 0 ? "+" : ""}${r.diffDry.toFixed(2)}L`
                          : "—"}
                      </td>
                      <td
                        style={{
                          ...TD,
                          textAlign: "right",
                          fontFamily: "var(--font-mono), monospace",
                        }}
                      >
                        {r.driverFuelWet
                          ? `${r.driverFuelWet.toFixed(2)}L`
                          : "—"}
                      </td>
                      <td
                        style={{
                          ...TD,
                          textAlign: "right",
                          fontFamily: "var(--font-mono), monospace",
                          color: "var(--text-dim)",
                        }}
                      >
                        {r.teamAvgWet ? `${r.teamAvgWet.toFixed(2)}L` : "—"}
                      </td>
                      <td
                        style={{
                          ...TD,
                          textAlign: "right",
                          fontFamily: "var(--font-mono), monospace",
                          fontWeight: 700,
                          color: wetDiffColor,
                        }}
                      >
                        {r.diffWet !== null
                          ? `${r.diffWet > 0 ? "+" : ""}${r.diffWet.toFixed(2)}L`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Teammates ─────────────────────────────────────────────────── */}
      {sortedTeammates.length > 0 && (
        <div>
          <SectionHeader title="Équipiers fréquents" />
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.5rem",
              marginBottom: "0.5rem",
            }}
          >
            {displayedTeammates.map((t) => (
              <div
                key={t.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.3rem 0.6rem",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "3px",
                  fontSize: "0.82rem",
                }}
              >
                <span style={{ fontWeight: 600 }}>{t.name}</span>
                <span
                  className="mono"
                  style={{ fontSize: "0.72rem", color: "var(--accent)" }}
                >
                  ×{t.count}
                </span>
              </div>
            ))}
          </div>
          {sortedTeammates.length > 5 && (
            <button
              onClick={() => setShowAllTeammates((p) => !p)}
              className="btn btn-secondary btn-sm"
            >
              {showAllTeammates
                ? "Voir moins"
                : `Voir tous (${sortedTeammates.length})`}
            </button>
          )}
        </div>
      )}

      {/* ── Most used circuits ────────────────────────────────────────── */}
      {sortedCircuits.length > 0 && (
        <div>
          <SectionHeader title="Circuits" />
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {sortedCircuits.map((c) => (
              <div
                key={c.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.3rem 0.6rem",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "3px",
                  fontSize: "0.82rem",
                }}
              >
                <span style={{ fontWeight: 600 }}>{c.name}</span>
                <span
                  className="mono"
                  style={{ fontSize: "0.72rem", color: "var(--accent)" }}
                >
                  ×{c.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Most used cars ────────────────────────────────────────────── */}
      {sortedCars.length > 0 && (
        <div>
          <SectionHeader title="Voitures" />
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {sortedCars.map((c) => (
              <div
                key={c.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.3rem 0.6rem",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "3px",
                  fontSize: "0.82rem",
                }}
              >
                <span style={{ fontWeight: 600 }}>{c.name}</span>
                <span
                  className="mono"
                  style={{ fontSize: "0.72rem", color: "var(--accent)" }}
                >
                  ×{c.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
