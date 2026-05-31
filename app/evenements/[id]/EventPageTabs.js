"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import StartTimesManager from "./StartTimesManager";
import EventInventoryTab from "./EventInventoryTab";
import { formatTimeInZone } from "../../../lib/timezone";
import { useSearchParams } from "next/navigation";

// ── Crew name coloring ────────────────────────────────────────────────────────
// Deterministic hash → one of 8 palette entries. Colors are chosen to be legible
// on both light and dark themes: border and text share the same saturated hue,
// background is a very low-opacity tint so it doesn't clash with either theme.
const CREW_PALETTE = [
  { bg: "rgba(99,102,241,0.12)", border: "#6366f1" }, // indigo
  { bg: "rgba(236,72,153,0.12)", border: "#ec4899" }, // pink
  { bg: "rgba(245,158,11,0.12)", border: "#f59e0b" }, // amber
  { bg: "rgba(16,185,129,0.12)", border: "#10b981" }, // emerald
  { bg: "rgba(239,68,68,0.12)", border: "#ef4444" }, // red
  { bg: "rgba(139,92,246,0.12)", border: "#8b5cf6" }, // violet
  { bg: "rgba(6,182,212,0.12)", border: "#06b6d4" }, // cyan
  { bg: "rgba(249,115,22,0.12)", border: "#f97316" }, // orange
];

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

function getCrewColor(name) {
  if (!name) return CREW_PALETTE[0];
  return CREW_PALETTE[hashString(name) % CREW_PALETTE.length];
}

// Convert a hex color to its relative luminance (0 = black, 1 = white).
// Used to decide whether the color is safe as text on both light and dark themes.
function hexLuminance(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const toLinear = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

// Returns true when a hex color is mid-range enough to be legible as text
// on both a light and a dark background.
// Below 0.08 = too dark (invisible on dark theme).
// Above 0.70 = too light (invisible on light theme).
function isSafeTextColor(hex) {
  const lum = hexLuminance(hex);
  return lum > 0.08 && lum < 0.7;
}

// Colored pill for an équipage name.
// `color` is an explicit hex from the DB; falls back to the hash palette when absent.
// Text color uses the hex only when luminance is mid-range — otherwise falls back to
// var(--text) so the pill stays readable on both light and dark themes.
function CrewPill({ name, color }) {
  if (!name) return <span style={{ color: "var(--text-dim)" }}>—</span>;
  const border = color || getCrewColor(name).border;
  // 8-digit hex (color + "20") gives ~12% alpha — subtle tint on any background
  const bg = color ? `${color}20` : getCrewColor(name).bg;
  // Only use the color as text when it's legible on both themes
  const textColor = color && isSafeTextColor(color) ? color : "var(--text)";
  return (
    <span
      style={{
        padding: "0.15rem 0.5rem",
        borderRadius: "3px",
        background: bg,
        border: `1px solid ${border}`,
        color: textColor,
        fontSize: "0.82rem",
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {name}
    </span>
  );
}

// ── Tab definitions ───────────────────────────────────────────────────────────
const TAB_IDS = ["inscriptions", "equipages", "horaires", "inventaire"];

export default function EventPageTabs({
  event,
  allCars,
  admin,
  isExternal,
  engineer,
  currentDriver,
  crewColorsMap = {},
}) {
  const [activeTab, setActiveTab] = useState("inscriptions");
  const searchParams = useSearchParams();

  // Tracks which driver group is hovered — shared across all rows in the group
  const [hoveredGroup, setHoveredGroup] = useState(null);

  // Inscriptions table sort
  const [sortField, setSortField] = useState("name");
  const [sortDir, setSortDir] = useState("asc");

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "irating" ? "desc" : "asc");
    }
  };

  const signupCount = event.signups?.length ?? 0;
  const teamCount = event.team_entries?.length ?? 0;
  const uniqueDriverCount = new Set(
    (event.signups || []).map((s) => s.drivers?.id || s.driver_name_snapshot),
  ).size;

  const tabs = [
    { id: "inscriptions", label: "Inscriptions", count: uniqueDriverCount },
    { id: "equipages", label: "Équipages", count: teamCount },
    { id: "horaires", label: "Horaires de départ" },
    ...(!isExternal ? [{ id: "inventaire", label: "Inventaire" }] : []),
  ];

  // Persist tab state per event — read in useEffect to avoid hydration mismatch.
  useEffect(() => {
    // Query param takes priority over persisted tab (e.g. ?tab=horaires from a redirect)
    const paramTab = searchParams.get("tab");
    if (paramTab && tabs.some((t) => t.id === paramTab)) {
      setActiveTab(paramTab);
      return;
    }
    const saved = localStorage.getItem(`event-tab-${event.id}`);
    if (saved && tabs.some((t) => t.id === saved)) {
      setActiveTab(saved);
    }
  }, [event.id]);

  const switchTab = (tabId) => {
    setActiveTab(tabId);
    localStorage.setItem(`event-tab-${event.id}`, tabId);
  };

  // Build a car id → name lookup so the inscriptions tab can display preferred car names.
  // Cars are stored as IDs in preferred_car_ids, not names.
  const carsMap = useMemo(
    () =>
      (allCars || []).reduce((acc, car) => {
        acc[car.id] = car.name;
        return acc;
      }, {}),
    [allCars],
  );

  const formatPreferences = (signup) => {
    const classes = signup.preferred_class || [];
    // For archived events, use the snapshotted car names if available —
    // the live carsMap may be incomplete if cars were deleted since archiving.
    // Fall back to live resolution for non-archived events or pre-feature archives.
    const carNames =
      event.archived && signup.preferred_car_names_snapshot != null
        ? signup.preferred_car_names_snapshot
        : (signup.preferred_car_ids || [])
            .map((cid) => carsMap[cid])
            .filter(Boolean);
    const parts = [...classes, ...carNames];
    return parts.length > 0 ? parts.join(", ") : "—";
  };

  const tz = event.timezone || "Europe/Paris";

  const isInEvent = (event.signups || []).some(
    (s) => s.drivers?.id === currentDriver?.id,
  );

  return (
    <div>
      {/* ── Tab bar ────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          gap: "0.25rem",
          borderBottom: "1px solid var(--border)",
          marginBottom: "1.5rem",
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => switchTab(tab.id)}
            style={{
              padding: "0.6rem 1.25rem",
              background: "transparent",
              border: "none",
              borderBottom:
                activeTab === tab.id
                  ? "2px solid var(--accent)"
                  : "2px solid transparent",
              color: activeTab === tab.id ? "var(--accent)" : "var(--text-dim)",
              fontFamily: "var(--font-rajdhani), sans-serif",
              fontSize: "0.9rem",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: "pointer",
              transition: "color 0.15s",
              marginBottom: "-1px",
              whiteSpace: "nowrap",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            {tab.label}
            {/* Count badge on Inscriptions and Équipages tabs */}
            {!isExternal && tab.count !== undefined && tab.count > 0 && (
              <span
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  padding: "0.05rem 0.35rem",
                  borderRadius: "10px",
                  background:
                    activeTab === tab.id ? "var(--accent)" : "var(--surface-2)",
                  color: activeTab === tab.id ? "#fff" : "var(--text-dim)",
                  border:
                    activeTab === tab.id ? "none" : "1px solid var(--border)",
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Inscriptions ──────────────────────────────────────────── */}
      {activeTab === "inscriptions" && (
        <div>
          {event.archived && (
            <div style={{ marginBottom: "1.25rem", padding: "0.65rem 0.9rem", background: "rgba(224,85,85,0.08)", border: "1px solid var(--danger)", borderRadius: "3px", fontSize: "0.82rem", color: "var(--danger)" }}>
              📦 Cet événement est archivé — toutes les données sont en lecture seule.
            </div>
          )}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "1rem",
            }}
          >
            <div style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>
              {isExternal
                ? "Inscriptions"
                : `${uniqueDriverCount} pilote${uniqueDriverCount !== 1 ? "s" : ""} inscrit${
                    uniqueDriverCount !== 1 ? "s" : ""
                  }`}
            </div>
            {/* Engineers don't sign up — they're staff, not drivers, externals cannot sign up by themselves */}
            {!event.archived && !engineer && !isExternal && (
              <Link
                href={`/evenements/${event.id}/inscription`}
                className="btn btn-primary"
              >
                + S&apos;inscrire
              </Link>
            )}
          </div>

          {signupCount === 0 ? (
            <div className="table-wrap">
              <div className="empty">
                Aucun pilote inscrit pour l&apos;instant.
              </div>
            </div>
          ) : (
            <div className="table-wrap inscriptions-table">
              <table>
                <thead>
                  <tr>
                    <th
                      onClick={() => toggleSort("name")}
                      style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
                    >
                      Pilote{" "}
                      <span style={{ opacity: sortField === "name" ? 1 : 0.3, fontSize: "0.75em" }}>
                        {sortField === "name" && sortDir === "desc" ? "▼" : "▲"}
                      </span>
                    </th>
                    <th
                      onClick={() => toggleSort("irating")}
                      style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
                    >
                      iRating{" "}
                      <span style={{ opacity: sortField === "irating" ? 1 : 0.3, fontSize: "0.75em" }}>
                        {sortField === "irating" && sortDir === "asc" ? "▲" : "▼"}
                      </span>
                    </th>
                    <th>Équipe</th>
                    <th>Préférences</th>
                    <th>Créneaux</th>
                    <th>Tags</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Group signups by driver — drivers with multiple signups
                    // (one per team entry) are merged into a single row.
                    const filtered = (event.signups || []).filter(
                      (s) => !isExternal || s.drivers?.id === currentDriver?.id,
                    );

                    // Build ordered map: driverId → [signups]
                    const grouped = [];
                    const seen = new Map();
                    for (const s of filtered) {
                      const key =
                        s.drivers?.id || s.driver_name_snapshot || s.id;
                      if (!seen.has(key)) {
                        seen.set(key, []);
                        grouped.push({ key, signups: seen.get(key) });
                      }
                      seen.get(key).push(s);
                    }

                    grouped.sort((a, b) => {
                      if (sortField === "irating") {
                        const aR = a.signups[0]?.drivers?.irating ?? -1;
                        const bR = b.signups[0]?.drivers?.irating ?? -1;
                        return sortDir === "asc" ? aR - bR : bR - aR;
                      }
                      const cmp = (a.signups[0]?.drivers?.name || "").localeCompare(
                        b.signups[0]?.drivers?.name || "",
                      );
                      return sortDir === "asc" ? cmp : -cmp;
                    });

                    return grouped.flatMap(
                      ({ key, signups: group }, groupIdx) => {
                        const first = group[0];
                        const driverName =
                          (event.archived
                            ? first.driver_name_snapshot
                            : null) ||
                          first.drivers?.name ||
                          "—";
                        // Stronger top border separates driver groups visually
                        const groupBorder =
                          groupIdx > 0 ? "2px solid var(--border)" : undefined;

                        return group.map((s, rowIdx) => {
                          const isFirstRow = rowIdx === 0;
                          // Within a group, suppress the border between rows so they read as one block.
                          // The group separator (groupBorder) is applied on the first row's cells only.
                          const cellBorderTop = isFirstRow
                            ? groupBorder
                            : "none";

                          return (
                            <tr
                              key={s.id}
                              onMouseEnter={() => setHoveredGroup(key)}
                              onMouseLeave={() => setHoveredGroup(null)}
                              style={{
                                background:
                                  hoveredGroup === key
                                    ? "var(--surface-2)"
                                    : "transparent",
                              }}
                            >
                              {/* Pilote — content only in first row, empty cell otherwise */}
                              <td
                                style={{
                                  fontWeight: 600,
                                  borderTop: cellBorderTop,
                                }}
                              >
                                {isFirstRow ? driverName : ""}
                              </td>
                              {/* iRating — content only in first row */}
                              <td
                                className="mono"
                                style={{
                                  color: "var(--accent)",
                                  fontSize: "0.85rem",
                                  borderTop: cellBorderTop,
                                }}
                              >
                                {isFirstRow
                                  ? (first.drivers?.irating ?? "—")
                                  : ""}
                              </td>
                              {/* Per-signup columns — rendered on every row */}
                              <td style={{ borderTop: cellBorderTop }}>
                                <CrewPill
                                  name={s.team_entries?.crew_name}
                                  color={
                                    crewColorsMap[s.team_entries?.crew_name]
                                  }
                                />
                              </td>
                              <td
                                style={{
                                  color: "var(--text-dim)",
                                  fontSize: "0.85rem",
                                  maxWidth: "200px",
                                  borderTop: cellBorderTop,
                                }}
                              >
                                {formatPreferences(s)}
                              </td>
                              <td
                                style={{
                                  fontSize: "0.85rem",
                                  borderTop: cellBorderTop,
                                }}
                              >
                                {(s.preferred_start_time_ids || []).length >
                                0 ? (
                                  (s.preferred_start_time_ids || [])
                                    .map((stId) =>
                                      (event.event_start_times || []).find(
                                        (st) => st.id === stId,
                                      ),
                                    )
                                    .filter(Boolean)
                                    .map((st) => (
                                      <div key={st.id}>
                                        <div style={{ fontWeight: 600 }}>
                                          {st.label}
                                        </div>
                                        <div
                                          className="mono"
                                          style={{
                                            fontSize: "0.78rem",
                                            color: "var(--accent)",
                                          }}
                                        >
                                          Départ à{" "}
                                          {formatTimeInZone(st.irl_start, tz)}
                                        </div>
                                      </div>
                                    ))
                                ) : (
                                  <span style={{ color: "var(--text-dim)" }}>
                                    —
                                  </span>
                                )}
                              </td>
                              <td style={{ borderTop: cellBorderTop }}>
                                {(s.tags || []).length > 0 ? (
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                                    {[...(s.tags || [])].sort().map((tag) => (
                                      <span key={tag} style={{ fontSize: "0.72rem", fontWeight: 600, padding: "0.1rem 0.45rem", borderRadius: "3px", background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-dim)", whiteSpace: "nowrap" }}>
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span style={{ color: "var(--text-dim)" }}>—</span>
                                )}
                              </td>
                              {/* Gérer — content only in first row */}
                              <td style={{ borderTop: cellBorderTop }}>
                                {isFirstRow &&
                                  !event.archived &&
                                  (admin ||
                                    currentDriver?.id === first.drivers?.id) &&
                                  first.drivers?.id && (
                                    <Link
                                      href={`/evenements/${event.id}/inscription?driver=${first.drivers.id}`}
                                      className="btn btn-secondary btn-sm"
                                    >
                                      {isExternal === true ? "Voir" : "Gérer"}
                                    </Link>
                                  )}
                              </td>
                            </tr>
                          );
                        });
                      },
                    );
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Équipages ─────────────────────────────────────────────── */}
      {activeTab === "equipages" && (
        <div>
          {event.archived && (
            <div style={{ marginBottom: "1.25rem", padding: "0.65rem 0.9rem", background: "rgba(224,85,85,0.08)", border: "1px solid var(--danger)", borderRadius: "3px", fontSize: "0.82rem", color: "var(--danger)" }}>
              📦 Cet événement est archivé — toutes les données sont en lecture seule.
            </div>
          )}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "1rem",
            }}
          >
            <div style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>
              {isExternal
                ? "Équipages"
                : `${teamCount} équipage${teamCount !== 1 ? "s" : ""} engagé${
                    teamCount !== 1 ? "s" : ""
                  }`}
            </div>
            {/* Engineers and external drivers cannot create team entries */}
            {!event.archived && !engineer && !isExternal && (
              <Link
                href={`/evenements/${event.id}/equipages/nouveau`}
                className="btn btn-primary"
              >
                + Ajouter un équipage
              </Link>
            )}
          </div>

          {teamCount === 0 ? (
            <div className="table-wrap">
              <div className="empty">
                Aucun équipage engagé pour cet événement.
              </div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Équipage</th>
                    <th>Voiture</th>
                    <th>Classe</th>
                    {event.championship_id && <th>#</th>}
                    <th>Pilotes</th>
                    <th>SoF</th>
                    <th>Départ IRL</th>
                    <th>Stream</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(event.team_entries || [])
                    .filter(
                      (entry) =>
                        !isExternal ||
                        (entry.signups || []).some(
                          (s) => s.drivers?.id === currentDriver?.id,
                        ),
                    )
                    .map((entry) => (
                      <tr key={entry.id}>
                        {/* Colored crew name pill — DB color takes priority over hash */}
                        <td style={{ fontWeight: 600 }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.4rem",
                              flexWrap: "wrap",
                            }}
                          >
                            <CrewPill
                              name={entry.crew_name}
                              color={crewColorsMap[entry.crew_name]}
                            />
                            {/* Inscrit badge — mirrors the event list badge, shown when the current
                            driver is assigned to this specific team entry */}
                            {(entry.signups || []).some(
                              (s) => s.drivers?.id === currentDriver?.id,
                            ) && (
                              <span
                                style={{
                                  fontSize: "0.65rem",
                                  fontWeight: 700,
                                  letterSpacing: "0.08em",
                                  textTransform: "uppercase",
                                  padding: "0.1rem 0.45rem",
                                  background: "rgba(80,200,120,0.12)",
                                  border: "1px solid #50c878",
                                  borderRadius: "3px",
                                  color: "#50c878",
                                }}
                              >
                                Inscrit ✓
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ color: "var(--text-dim)" }}>
                          {(event.archived ? entry.car_name_snapshot : null) ||
                            entry.cars?.name ||
                            "—"}
                        </td>
                        <td>
                          {entry.class && (
                            <span className="badge badge-driver">
                              {entry.class}
                            </span>
                          )}
                        </td>
                        {event.championship_id && (
                          <td
                            className="mono"
                            style={{
                              color: "var(--accent)",
                              fontSize: "0.85rem",
                            }}
                          >
                            {entry.car_number != null
                              ? `#${entry.car_number}`
                              : "—"}
                          </td>
                        )}
                        <td>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "0.25rem",
                            }}
                          >
                            {(entry.signups || [])
                              .filter(
                                (s) => s.drivers || s.driver_name_snapshot,
                              )
                              .map((s) => (
                                <span
                                  key={s.drivers?.id || s.driver_name_snapshot}
                                  style={{
                                    fontSize: "0.75rem",
                                    padding: "0.1rem 0.4rem",
                                    background: "var(--surface-2)",
                                    border: "1px solid var(--border)",
                                    borderRadius: "2px",
                                    color: "var(--text-dim)",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {(event.archived
                                    ? s.driver_name_snapshot
                                    : null) || s.drivers?.name}
                                </span>
                              ))}
                            {(entry.signups || []).filter(
                              (s) => s.drivers || s.driver_name_snapshot,
                            ).length === 0 && (
                              <span
                                style={{
                                  color: "var(--text-dim)",
                                  fontSize: "0.85rem",
                                }}
                              >
                                —
                              </span>
                            )}
                          </div>
                        </td>
                        <td
                          className="mono"
                          style={{
                            fontSize: "0.85rem",
                            color: "var(--accent)",
                          }}
                        >
                          {(() => {
                            // SoF = average iRating of drivers with a known iRating in this team entry
                            const drivers = (entry.signups || []).filter(
                              (s) => s.drivers?.irating,
                            );
                            if (drivers.length === 0) return "—";
                            return (
                              Math.round(
                                drivers.reduce(
                                  (sum, s) => sum + s.drivers.irating,
                                  0,
                                ) / drivers.length,
                              ) + " iR"
                            );
                          })()}
                        </td>
                        <td>
                          {entry.event_start_times ? (
                            <>
                              <div style={{ fontWeight: 600 }}>
                                {entry.event_start_times.label}
                              </div>
                              <div
                                className="mono"
                                style={{
                                  fontSize: "0.82rem",
                                  color: "var(--accent)",
                                  marginTop: "0.1rem",
                                }}
                              >
                                Départ à{" "}
                                {formatTimeInZone(
                                  entry.event_start_times.irl_start,
                                  tz,
                                )}
                              </div>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          {/* Prefer stream_urls array */}
                          {(() => {
                            const urls = (entry.stream_urls || []).filter(
                              Boolean,
                            );
                            if (urls.length === 0) return "—";
                            return (
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "0.2rem",
                                }}
                              >
                                {urls.map((url, i) => {
                                  const username =
                                    url.match(
                                      /twitch\.tv\/([a-zA-Z0-9_]+)/i,
                                    )?.[1] || `Stream ${i + 1}`;
                                  return (
                                    <a
                                      key={url}
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{
                                        color: "#9147ff",
                                        fontSize: "0.82rem",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {username} ↗
                                    </a>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </td>
                        <td>
                          {(() => {
                            const driverId = currentDriver?.id;

                            const isInEvent = (event.signups || []).some(
                              (s) => s.drivers?.id === driverId,
                            );

                            const isInTeam = (entry.signups || []).some(
                              (s) => s.drivers?.id === driverId,
                            );

                            const canAccess = admin || engineer || isInEvent;

                            if (!canAccess) return null;

                            // Archived events are fully read-only — always show "Voir" regardless
                            // of role or team membership. "Gérer" implies write access which is blocked.
                            const label = event.archived
                              ? "Voir"
                              : admin
                                ? "Gérer"
                                : engineer
                                  ? "Voir"
                                  : isInTeam
                                    ? "Gérer"
                                    : "Voir";

                            return (
                              <Link
                                href={`/evenements/${event.id}/equipages/${entry.id}`}
                                className="btn btn-secondary btn-sm"
                              >
                                {label}
                              </Link>
                            );
                          })()}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Horaires de départ ────────────────────────────────────── */}
      {activeTab === "horaires" && (
        <StartTimesManager
          eventId={event.id}
          initialStartTimes={event.event_start_times || []}
          timezone={tz}
          isSpecial={event.is_special}
          isAdmin={admin}
          archived={event.archived}
        />
      )}

      {/* ── Tab: Inventaire ───────────────────────────────────────────── */}
      {!isExternal && activeTab === "inventaire" && (
        <EventInventoryTab
          eventSignups={event.signups || []}
          archived={event.archived}
          eventFormat={event.format}
          // Passed down so the current driver's column can be highlighted
          currentDriverId={currentDriver?.id}
        />
      )}
    </div>
  );
}
