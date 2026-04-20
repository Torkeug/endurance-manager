"use client";

import { useState, useEffect, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Returns the car display name: snapshot first, then cars join, then '—' */
function carName(entry) {
  return entry.car_name_snapshot || entry.cars?.name || "—";
}

/** Returns true if all entries in a group share the same car_number value */
function isConsistent(entries) {
  const nums = entries.map((e) => e.car_number);
  return nums.every((n) => n === nums[0]);
}

/** Groups an array into a Map by a key function, preserving insertion order */
function groupBy(arr, keyFn) {
  const map = new Map();
  for (const item of arr) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// CarNumberInput — inline editable input, saves on blur
// ─────────────────────────────────────────────────────────────────────────────

function CarNumberInput({ value, onSave }) {
  const [val, setVal] = useState(value ?? "");

  useEffect(() => setVal(value ?? ""), [value]);

  return (
    <input
      type="number"
      min={0}
      max={999}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => onSave(val)}
      onClick={(e) => e.stopPropagation()}
      style={{
        width: "4rem",
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderRadius: "3px",
        padding: "0.25rem 0.5rem",
        fontSize: "0.85rem",
        color: "var(--accent)",
        fontFamily: "var(--font-mono), monospace",
        textAlign: "center",
        appearance: "textfield",
      }}
      placeholder="—"
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ExpandableRow — reusable row used in both views
// ─────────────────────────────────────────────────────────────────────────────

function ExpandableRow({
  label,
  sublabel,
  car,
  cls,
  entries,
  events,
  expandKey,
  expanded,
  autoExpanded,
  onToggle,
  onSave,
}) {
  const consistent = isConsistent(entries);
  const sharedNumber = consistent ? entries[0].car_number : null;
  const isOpen = autoExpanded || expanded;

  return (
    <div style={{ borderBottom: "1px solid var(--border)" }}>
      {/* ── Collapsed row ─────────────────────────────────────────────── */}
      <div
        onClick={() => onToggle(expandKey)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.6rem 1rem",
          cursor: "pointer",
          fontSize: "0.88rem",
          userSelect: "none",
          transition: "background 0.1s",
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.background = "var(--surface-2)")
        }
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        {/* Chevron */}
        <span
          style={{
            color: "var(--text-dim)",
            fontSize: "0.65rem",
            width: "0.75rem",
            flexShrink: 0,
          }}
        >
          {isOpen ? "▼" : "▶"}
        </span>

        {/* Team / championship label */}
        <span
          style={{
            fontWeight: 600,
            color: "var(--text)",
            width: "11rem",
            flexShrink: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>

        {sublabel && (
          <span
            style={{
              color: "var(--text-dim)",
              fontSize: "0.8rem",
              flexShrink: 0,
            }}
          >
            {sublabel}
          </span>
        )}

        {/* Car name */}
        <span
          style={{
            color: "var(--text-dim)",
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {car}
        </span>

        {/* Class */}
        <span
          style={{
            color: "var(--text-dim)",
            fontSize: "0.8rem",
            width: "4rem",
            textAlign: "right",
            flexShrink: 0,
          }}
        >
          {cls || "—"}
        </span>

        {/* Car number */}
        <span
          style={{
            width: "4rem",
            textAlign: "right",
            flexShrink: 0,
            fontFamily: "var(--font-mono), monospace",
          }}
        >
          {consistent ? (
            <span
              style={{
                color:
                  sharedNumber != null ? "var(--accent)" : "var(--text-dim)",
              }}
            >
              {sharedNumber != null ? `#${sharedNumber}` : "—"}
            </span>
          ) : (
            <span
              style={{
                color: "#f59e0b",
                fontSize: "0.78rem",
                fontStyle: "italic",
              }}
            >
              varie
            </span>
          )}
        </span>
      </div>

      {/* ── Expanded: per-round rows ───────────────────────────────────── */}
      {isOpen && (
        <div
          style={{ background: "var(--surface-2)", paddingBottom: "0.25rem" }}
        >
          {entries.map((entry) => {
            const event = events.find((ev) => ev.id === entry.event_id);
            const roundLabel = event
              ? `Round ${event.round_number} · ${event.name}`
              : "—";

            return (
              <div
                key={entry.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.4rem 1rem 0.4rem 2.5rem",
                  fontSize: "0.85rem",
                }}
              >
                <span
                  style={{
                    color: "var(--text-dim)",
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {roundLabel}
                </span>
                <CarNumberInput
                  value={entry.car_number}
                  onSave={(val) => onSave(entry.id, val)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ChampionshipView
// ─────────────────────────────────────────────────────────────────────────────

function ChampionshipView({
  championships,
  events,
  entries,
  expandedTop,
  toggleTop,
  expandedRow,
  toggleRow,
  onSave,
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {championships.map((champ) => {
        const champEventIds = events
          .filter((ev) => ev.championship_id === champ.id)
          .map((ev) => ev.id);
        const champEntries = entries.filter((e) =>
          champEventIds.includes(e.event_id),
        );

        // Skip championships with no team entries
        if (champEntries.length === 0) return null;

        const byTeam = groupBy(champEntries, (e) => e.crew_name);
        const isChampOpen = expandedTop[champ.id] !== false;

        return (
          <div
            key={champ.id}
            style={{
              border: "1px solid var(--border)",
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            {/* Championship header */}
            <div
              onClick={() => toggleTop(champ.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.75rem 1rem",
                background: "var(--surface-2)",
                borderBottom: isChampOpen ? "1px solid var(--border)" : "none",
                cursor: "pointer",
                userSelect: "none",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              <span style={{ color: "var(--text-dim)", fontSize: "0.65rem" }}>
                {isChampOpen ? "▼" : "▶"}
              </span>
              <span
                style={{
                  fontWeight: 700,
                  color: "var(--text)",
                  fontFamily: "var(--font-rajdhani), sans-serif",
                  letterSpacing: "0.04em",
                  fontSize: "0.95rem",
                }}
              >
                {champ.name}
              </span>
              {champ.season && (
                <span style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>
                  · Saison {champ.season}
                </span>
              )}
              <span
                style={{
                  marginLeft: "auto",
                  color: "var(--text-dim)",
                  fontSize: "0.78rem",
                }}
              >
                {byTeam.size} équipe{byTeam.size !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Team rows */}
            {isChampOpen && (
              <div>
                {[...byTeam.entries()].map(([crewName, teamEntries]) => {
                  const rowKey = `champ-${champ.id}-team-${crewName}`;
                  return (
                    <ExpandableRow
                      key={rowKey}
                      label={crewName}
                      car={carName(teamEntries[0])}
                      cls={teamEntries[0].class}
                      entries={teamEntries}
                      events={events}
                      expandKey={rowKey}
                      expanded={expandedRow[rowKey]}
                      autoExpanded={!isConsistent(teamEntries)}
                      onToggle={toggleRow}
                      onSave={onSave}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TeamView
// ─────────────────────────────────────────────────────────────────────────────

function TeamView({
  championships,
  events,
  entries,
  expandedTop,
  toggleTop,
  expandedRow,
  toggleRow,
  onSave,
}) {
  const byTeam = groupBy(entries, (e) => e.crew_name);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {[...byTeam.entries()].map(([crewName, teamEntries]) => {
        const teamKey = `team-${crewName}`;
        const isTeamOpen = expandedTop[teamKey] !== false;

        // Group by championship_id — skip entries where the event or championship can't be resolved
        const byChamp = groupBy(
          teamEntries.filter((e) => {
            const ev = events.find((ev) => ev.id === e.event_id);
            return ev?.championship_id != null;
          }),
          (e) => events.find((ev) => ev.id === e.event_id)?.championship_id,
        );

        if (byChamp.size === 0) return null;

        return (
          <div
            key={crewName}
            style={{
              border: "1px solid var(--border)",
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            {/* Team header */}
            <div
              onClick={() => toggleTop(teamKey)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.75rem 1rem",
                background: "var(--surface-2)",
                borderBottom: isTeamOpen ? "1px solid var(--border)" : "none",
                cursor: "pointer",
                userSelect: "none",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              <span style={{ color: "var(--text-dim)", fontSize: "0.65rem" }}>
                {isTeamOpen ? "▼" : "▶"}
              </span>
              <span
                style={{
                  fontWeight: 700,
                  color: "var(--text)",
                  fontFamily: "var(--font-rajdhani), sans-serif",
                  letterSpacing: "0.04em",
                  fontSize: "0.95rem",
                }}
              >
                {crewName}
              </span>
              <span
                style={{
                  marginLeft: "auto",
                  color: "var(--text-dim)",
                  fontSize: "0.78rem",
                }}
              >
                {byChamp.size} championnat{byChamp.size !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Championship rows */}
            {isTeamOpen && (
              <div>
                {[...byChamp.entries()].map(([champId, champEntries]) => {
                  const champ = championships.find((c) => c.id === champId);
                  // Guard: skip if championship not found (shouldn't happen after filter above)
                  if (!champ) return null;
                  const rowKey = `team-${crewName}-champ-${champId}`;
                  return (
                    <ExpandableRow
                      key={rowKey}
                      label={champ.name}
                      sublabel={
                        champ.season ? `· Saison ${champ.season} ·` : undefined
                      }
                      car={carName(champEntries[0])}
                      cls={champEntries[0].class}
                      entries={champEntries}
                      events={events}
                      expandKey={rowKey}
                      expanded={expandedRow[rowKey]}
                      autoExpanded={!isConsistent(champEntries)}
                      onToggle={toggleRow}
                      onSave={onSave}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

export default function ChampionshipTeamsManager() {
  const [championships, setChampionships] = useState([]);
  const [events, setEvents] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("team");
  const [expandedTop, setExpandedTop] = useState({});
  const [expandedRow, setExpandedRow] = useState({});

  const fetchData = useCallback(async () => {
    const { data: champs, error: champErr } = await supabaseBrowser
      .from("championships")
      .select("id, name, season")
      .eq("archived", false)
      .order("season", { ascending: false });

    if (champErr || !champs?.length) {
      setLoading(false);
      return;
    }

    const champIds = champs.map((c) => c.id);

    const { data: evs } = await supabaseBrowser
      .from("events")
      .select("id, name, weekend_start_date, round_number, championship_id")
      .in("championship_id", champIds)
      .order("weekend_start_date");

    if (!evs?.length) {
      setChampionships(champs);
      setLoading(false);
      return;
    }

    const eventIds = evs.map((e) => e.id);

    const { data: ents } = await supabaseBrowser
      .from("team_entries")
      .select(
        "id, crew_name, car_number, class, car_name_snapshot, event_id, cars(name)",
      )
      .in("event_id", eventIds)
      .order("crew_name");

    setChampionships(champs);
    setEvents(evs);
    setEntries(ents || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async (entryId, rawVal) => {
    const number = rawVal === "" ? null : parseInt(rawVal, 10);
    if (rawVal !== "" && isNaN(number)) return;
    const { error } = await supabaseBrowser
      .from("team_entries")
      .update({ car_number: number })
      .eq("id", entryId);
    if (!error) {
      setEntries((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, car_number: number } : e)),
      );
    }
  };

  const toggleTop = (key) =>
    setExpandedTop((prev) => ({
      ...prev,
      [key]: prev[key] !== false ? false : true,
    }));

  const toggleRow = (key) =>
    setExpandedRow((prev) => ({ ...prev, [key]: !prev[key] }));

  if (loading)
    return (
      <p style={{ color: "var(--text-dim)", padding: "1rem" }}>Chargement...</p>
    );
  if (!championships.length)
    return (
      <p style={{ color: "var(--text-dim)", padding: "1rem" }}>
        Aucun championnat actif.
      </p>
    );
  if (!entries.length)
    return (
      <p style={{ color: "var(--text-dim)", padding: "1rem" }}>
        Aucune équipe inscrite dans les championnats actifs.
      </p>
    );

  const sharedProps = {
    championships,
    events,
    entries,
    expandedTop,
    toggleTop,
    expandedRow,
    toggleRow,
    onSave: handleSave,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* ── View toggle ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: "0.5rem" }}>
        {[
          { key: "team", label: "Par équipe" },
          { key: "championship", label: "Par championnat" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setView(key)}
            style={{
              padding: "0.35rem 1rem",
              borderRadius: "999px",
              border: "1px solid",
              borderColor: view === key ? "var(--accent)" : "var(--border)",
              background: view === key ? "var(--accent-dim)" : "transparent",
              color: view === key ? "var(--accent)" : "var(--text-dim)",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Active view ─────────────────────────────────────────────────── */}
      {view === "championship" ? (
        <ChampionshipView {...sharedProps} />
      ) : (
        <TeamView {...sharedProps} />
      )}
    </div>
  );
}
