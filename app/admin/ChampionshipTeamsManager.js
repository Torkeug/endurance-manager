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

  // Sync when external value changes (e.g. after a save from another row)
  useEffect(() => setVal(value ?? ""), [value]);

  return (
    <input
      type="number"
      min={0}
      max={999}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => onSave(val)}
      // Stop click from bubbling up to the row toggle
      onClick={(e) => e.stopPropagation()}
      className="w-16 bg-gray-700 border border-gray-600 rounded px-2 py-0.5 text-sm
                 text-white text-center focus:outline-none focus:border-kronos-accent
                 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none
                 [&::-webkit-inner-spin-button]:appearance-none"
      placeholder="—"
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ExpandableRow — reusable row used in both views
// Props:
//   label        — main left label (crew name or championship name)
//   sublabel     — secondary label (season, etc.)
//   car          — car display string
//   cls          — class string
//   entries      — team_entries array for this group
//   events       — all events (to resolve round labels)
//   expandKey    — unique string key for expand state
//   expanded     — bool from parent state
//   autoExpanded — bool, true when car numbers vary (forces open)
//   onToggle     — function(expandKey) to toggle expand state
//   onSave       — function(entryId, rawVal) to save car number
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

  // Auto-expanded if inconsistent; otherwise driven by expand state
  const isOpen = autoExpanded || expanded;

  return (
    <div className="border-b border-gray-700/50 last:border-0">
      {/* ── Collapsed row ─────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-700/30 cursor-pointer text-sm select-none"
        onClick={() => onToggle(expandKey)}
      >
        {/* Expand / collapse chevron */}
        <span className="text-gray-500 text-xs w-3 shrink-0">
          {isOpen ? "▼" : "▶"}
        </span>

        {/* Team / championship label */}
        <span className="font-medium text-white w-44 truncate">{label}</span>
        {sublabel && (
          <span className="text-gray-500 text-xs shrink-0">{sublabel}</span>
        )}

        {/* Car name */}
        <span className="text-gray-400 flex-1 truncate">{car}</span>

        {/* Class */}
        <span className="text-gray-500 text-xs w-16 text-right shrink-0">
          {cls || "—"}
        </span>

        {/* Car number — consistent shows value, inconsistent shows warning */}
        <span className="w-16 text-right shrink-0">
          {consistent ? (
            <span className="text-kronos-accent font-mono text-sm">
              {sharedNumber != null ? (
                `#${sharedNumber}`
              ) : (
                <span className="text-gray-600">—</span>
              )}
            </span>
          ) : (
            <span className="text-yellow-500 text-xs italic">varie</span>
          )}
        </span>
      </div>

      {/* ── Expanded: per-round rows ───────────────────────────────────── */}
      {isOpen && (
        <div className="bg-gray-800/40 pb-1">
          {entries.map((entry) => {
            const event = events.find((ev) => ev.id === entry.event_id);
            const roundLabel = event
              ? `Round ${event.round_number} · ${event.name}`
              : "—";

            return (
              <div
                key={entry.id}
                className="flex items-center gap-3 px-4 py-1.5 text-sm pl-10"
              >
                <span className="text-gray-500 flex-1 truncate">
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
// ChampionshipView — groups by championship, then by team within each
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
    <div className="space-y-4">
      {championships.map((champ) => {
        // Entries belonging to this championship's events
        const champEventIds = events
          .filter((ev) => ev.championship_id === champ.id)
          .map((ev) => ev.id);
        const champEntries = entries.filter((e) =>
          champEventIds.includes(e.event_id),
        );

        // Group by crew_name within this championship
        const byTeam = groupBy(champEntries, (e) => e.crew_name);

        // Default open (undefined = open, false = closed)
        const isChampOpen = expandedTop[champ.id] !== false;

        return (
          <div
            key={champ.id}
            className="bg-gray-800 rounded-lg overflow-hidden"
          >
            {/* Championship header row */}
            <div
              className="flex items-center gap-3 px-4 py-3 bg-gray-700/60 cursor-pointer
                         hover:bg-gray-700/80 select-none"
              onClick={() => toggleTop(champ.id)}
            >
              <span className="text-gray-400 text-xs">
                {isChampOpen ? "▼" : "▶"}
              </span>
              <span className="font-semibold text-white">{champ.name}</span>
              <span className="text-gray-500 text-sm">· {champ.season}</span>
              <span className="ml-auto text-gray-500 text-xs">
                {byTeam.size} équipe{byTeam.size !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Team rows */}
            {isChampOpen && (
              <div>
                {[...byTeam.entries()].map(([crewName, teamEntries]) => {
                  const rowKey = `champ-${champ.id}-team-${crewName}`;
                  const consistent = isConsistent(teamEntries);
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
                      autoExpanded={!consistent}
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
// TeamView — groups by team, then by championship within each team
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
  // Group all entries by crew_name
  const byTeam = groupBy(entries, (e) => e.crew_name);

  return (
    <div className="space-y-4">
      {[...byTeam.entries()].map(([crewName, teamEntries]) => {
        // Default open (undefined = open, false = closed)
        const teamKey = `team-${crewName}`;
        const isTeamOpen = expandedTop[teamKey] !== false;

        // Group this team's entries by championship_id
        const byChamp = groupBy(teamEntries, (e) => {
          const ev = events.find((ev) => ev.id === e.event_id);
          return ev?.championship_id;
        });

        return (
          <div
            key={crewName}
            className="bg-gray-800 rounded-lg overflow-hidden"
          >
            {/* Team header row */}
            <div
              className="flex items-center gap-3 px-4 py-3 bg-gray-700/60 cursor-pointer
                         hover:bg-gray-700/80 select-none"
              onClick={() => toggleTop(teamKey)}
            >
              <span className="text-gray-400 text-xs">
                {isTeamOpen ? "▼" : "▶"}
              </span>
              <span className="font-semibold text-white">{crewName}</span>
              <span className="ml-auto text-gray-500 text-xs">
                {byChamp.size} championnat{byChamp.size !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Championship rows within this team */}
            {isTeamOpen && (
              <div>
                {[...byChamp.entries()].map(([champId, champEntries]) => {
                  const champ = championships.find((c) => c.id === champId);
                  if (!champ) return null;
                  const rowKey = `team-${crewName}-champ-${champId}`;
                  const consistent = isConsistent(champEntries);
                  return (
                    <ExpandableRow
                      key={rowKey}
                      label={champ.name}
                      sublabel={`· ${champ.season}`}
                      car={carName(champEntries[0])}
                      cls={champEntries[0].class}
                      entries={champEntries}
                      events={events}
                      expandKey={rowKey}
                      expanded={expandedRow[rowKey]}
                      autoExpanded={!consistent}
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

  // 'championship' | 'team'
  const [view, setView] = useState("championship");

  // Top-level group headers: undefined = expanded, false = collapsed
  const [expandedTop, setExpandedTop] = useState({});
  // Inner rows: undefined/false = collapsed, true = expanded
  const [expandedRow, setExpandedRow] = useState({});

  // ── Data fetch ─────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    // 1. Active (non-archived) championships only
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

    // 2. Events belonging to these championships
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

    // 3. Team entries for those events, with car name join as fallback
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

  // ── Car number save ────────────────────────────────────────────────────────
  const handleSave = async (entryId, rawVal) => {
    const number = rawVal === "" ? null : parseInt(rawVal, 10);

    // Reject non-numeric input (but allow clearing to null)
    if (rawVal !== "" && isNaN(number)) return;

    const { error } = await supabaseBrowser
      .from("team_entries")
      .update({ car_number: number })
      .eq("id", entryId);

    if (!error) {
      // Optimistic local update
      setEntries((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, car_number: number } : e)),
      );
    }
  };

  // ── Expand toggles ─────────────────────────────────────────────────────────

  // Top-level: default open (undefined = open), toggle to false/true
  const toggleTop = (key) =>
    setExpandedTop((prev) => ({
      ...prev,
      [key]: prev[key] !== false ? false : true,
    }));

  // Inner rows: default closed (undefined = false)
  const toggleRow = (key) =>
    setExpandedRow((prev) => ({ ...prev, [key]: !prev[key] }));

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return <p className="text-sm text-gray-400 p-4">Chargement...</p>;
  }

  if (!championships.length) {
    return (
      <p className="text-sm text-gray-400 p-4">Aucun championnat actif.</p>
    );
  }

  if (!entries.length) {
    return (
      <p className="text-sm text-gray-400 p-4">
        Aucune équipe inscrite dans les championnats actifs.
      </p>
    );
  }

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
    <div className="space-y-6">
      {/* ── View toggle ─────────────────────────────────────────────────── */}
      <div className="flex gap-2">
        {[
          { key: "championship", label: "Par championnat" },
          { key: "team", label: "Par équipe" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              view === key
                ? "bg-kronos-accent text-white"
                : "bg-gray-700 text-gray-400 hover:text-white"
            }`}
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
