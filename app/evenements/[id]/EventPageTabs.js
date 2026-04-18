"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import StartTimesManager from "./StartTimesManager";
import EventInventoryTab from "./EventInventoryTab";
import { formatTimeInZone } from "../../../lib/timezone";

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

// Colored pill for an équipage name. Works on light and dark themes.
function CrewPill({ name }) {
  if (!name) return <span style={{ color: "var(--text-dim)" }}>—</span>;
  const { bg, border } = getCrewColor(name);
  return (
    <span
      style={{
        padding: "0.15rem 0.5rem",
        borderRadius: "3px",
        background: bg,
        border: `1px solid ${border}`,
        color: border,
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
}) {
  const [activeTab, setActiveTab] = useState("inscriptions");

  // Persist tab state per event — read in useEffect to avoid hydration mismatch.
  useEffect(() => {
    const saved = localStorage.getItem(`event-tab-${event.id}`);
    if (saved && TAB_IDS.includes(saved)) setActiveTab(saved);
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
    const carNames = (signup.preferred_car_ids || [])
      .map((cid) => carsMap[cid])
      .filter(Boolean);
    const parts = [...classes, ...carNames];
    return parts.length > 0 ? parts.join(", ") : "—";
  };

  const signupCount = event.signups?.length ?? 0;
  const teamCount = event.team_entries?.length ?? 0;

  const tabs = [
    { id: "inscriptions", label: "Inscriptions", count: signupCount },
    { id: "equipages", label: "Équipages", count: teamCount },
    { id: "horaires", label: "Horaires de départ" },
    { id: "inventaire", label: "Inventaire" },
  ];

  const tz = event.timezone || "Europe/Paris";

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
            {tab.count !== undefined && tab.count > 0 && (
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "1rem",
            }}
          >
            <div style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>
              {signupCount} pilote{signupCount !== 1 ? "s" : ""} inscrit
              {signupCount !== 1 ? "s" : ""}
            </div>
            {/* Engineers don't sign up — they're staff, not drivers */}
            {!event.archived && !engineer && (
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
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Pilote</th>
                    <th>iRating</th>
                    <th>Équipe</th>
                    <th>Préférences</th>
                    <th>Créneaux</th>
                    <th>Notes</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(event.signups || [])
                    // External drivers can only see their own signup row
                    .filter(
                      (s) => !isExternal || s.drivers?.id === currentDriver?.id,
                    )
                    .sort((a, b) =>
                      (a.drivers?.name || "").localeCompare(
                        b.drivers?.name || "",
                      ),
                    )
                    .map((s) => (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 600 }}>
                          {(event.archived ? s.driver_name_snapshot : null) ||
                            s.drivers?.name ||
                            "—"}
                        </td>
                        <td
                          className="mono"
                          style={{
                            color: "var(--accent)",
                            fontSize: "0.85rem",
                          }}
                        >
                          {s.drivers?.irating ?? "—"}
                        </td>
                        {/* Colored crew name pill */}
                        <td>
                          <CrewPill name={s.team_entries?.crew_name} />
                        </td>
                        <td
                          style={{
                            color: "var(--text-dim)",
                            fontSize: "0.85rem",
                            maxWidth: "200px",
                          }}
                        >
                          {formatPreferences(s)}
                        </td>
                        <td style={{ fontSize: "0.85rem" }}>
                          {(s.preferred_start_time_ids || []).length > 0 ? (
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
                            <span style={{ color: "var(--text-dim)" }}>—</span>
                          )}
                        </td>
                        <td
                          style={{
                            color: "var(--text-dim)",
                            fontSize: "0.85rem",
                            maxWidth: "160px",
                          }}
                        >
                          {s.notes || "—"}
                        </td>
                        <td>
                          {!event.archived &&
                            (admin || currentDriver?.id === s.drivers?.id) &&
                            s.drivers?.id && (
                              <Link
                                href={`/evenements/${event.id}/inscription?driver=${s.drivers?.id}`}
                                className="btn btn-secondary btn-sm"
                              >
                                Gérer
                              </Link>
                            )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Équipages ─────────────────────────────────────────────── */}
      {activeTab === "equipages" && (
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "1rem",
            }}
          >
            <div style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>
              {teamCount} équipage{teamCount !== 1 ? "s" : ""} engagé
              {teamCount !== 1 ? "s" : ""}
            </div>
            {/* Engineers cannot create team entries — admin only action */}
            {!event.archived && admin && !engineer && (
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
                        {/* Colored crew name pill */}
                        <td style={{ fontWeight: 600 }}>
                          <CrewPill name={entry.crew_name} />
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
                          {entry.stream_url ? (
                            <a
                              href={entry.stream_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: "#9147ff",
                                fontSize: "0.85rem",
                              }}
                            >
                              Twitch ↗
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          {(admin ||
                            engineer ||
                            (entry.signups || []).some(
                              (s) => s.drivers?.id === currentDriver?.id,
                            )) && (
                            <Link
                              href={`/evenements/${event.id}/equipages/${entry.id}`}
                              className="btn btn-secondary btn-sm"
                            >
                              {/* Engineers always see "Voir" — they manage stints but not the entry itself */}
                              {event.archived || engineer ? "Voir" : "Gérer"}
                            </Link>
                          )}
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
      {activeTab === "inventaire" && (
        <EventInventoryTab
          teamEntries={event.team_entries || []}
          archived={event.archived}
        />
      )}
    </div>
  );
}
