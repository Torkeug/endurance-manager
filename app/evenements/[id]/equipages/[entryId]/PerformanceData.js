"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { supabaseBrowser as supabase } from "../../../../../lib/supabase-browser";
import { useTranslations, useLocale } from "next-intl";

// ── Lap time helpers ───────────────────────────────────────

function secToDisplay(sec) {
  if (!sec && sec !== 0) return "";
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(3).padStart(6, "0"); // 6 = "SS.mmm" — ensures leading zero on single-digit seconds
  return `${m}:${s}`;
}

function displayToSec(str) {
  if (!str || !str.trim()) return null;
  const match = str.trim().match(/^(\d+):([0-5]\d)\.(\d{1,3})$/);
  if (!match) return null;
  return (
    parseInt(match[1]) * 60 +
    parseInt(match[2]) +
    parseFloat(`0.${match[3].padEnd(3, "0")}`) // padEnd: "3" → "300" (300 ms), not "003" (3 ms) — fractional, not leading zeros
  );
}

// Format an ISO timestamp to a human-readable date+time string
// e.g. "12 avril 2026 à 14:32"
function formatUpdatedAt(isoStr, locale = "fr") {
  if (!isoStr) return null;
  return new Date(isoStr).toLocaleString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Condition fallback resolvers ────────────────────────────────────────────
// Each resolver mirrors the exact priority chain used in StintGrid's calcStint,
// so the Performances table always shows the value that would actually be used
// in strategy calculations for each condition.
//
// Tiers:
//   1 — specific:  driver's own exact-condition field, no computation
//   2 — derived:   another field + all non-zero modifiers applied (or raw fuel proxy)
//   3 — zero-mod:  derived path where ≥1 modifier in the chain is 0/unset
//   (4 — team avg: added in Part B / StintGrid)

function resolveLapTime(
  perf,
  condition,
  { dayWetAdd = 0, nightDryAdd = 0, nightWetAdd = 0 } = {},
) {
  if (!perf) return null;

  // Attempt one fallback path.
  // source: raw driver perf field.
  // mods:   array of deltas to sum onto source (negative = subtraction).
  // Returns { value, tier, marker } or null if source is null or result ≤ 0.
  const tryPath = (source, mods = []) => {
    if (source == null) return null;
    const val = source + mods.reduce((s, m) => s + m, 0);
    if (val <= 0) return null; // prevents nonsensical lap time when a subtracted modifier overshoots the source
    if (mods.length === 0) return { value: val, tier: 1, marker: "" };
    // Tier 3 when any modifier used in this path is zero/unset
    const tier = mods.some((m) => m === 0) ? 3 : 2;
    return { value: val, tier, marker: tier === 2 ? "*" : "~" };
  };

  switch (condition) {
    case "DD": // Day dry — origin condition, all paths are subtractive
      return (
        tryPath(perf.lap_time_dry) ||
        tryPath(perf.lap_time_wet, [-dayWetAdd]) ||
        tryPath(perf.lap_time_night_dry, [-nightDryAdd]) ||
        tryPath(perf.lap_time_night_wet, [-dayWetAdd, -nightWetAdd]) ||
        null
      );
    case "DW": // Day wet
      return (
        tryPath(perf.lap_time_wet) ||
        tryPath(perf.lap_time_dry, [dayWetAdd]) ||
        tryPath(perf.lap_time_night_wet, [-nightWetAdd]) ||
        tryPath(perf.lap_time_night_dry, [dayWetAdd, -nightDryAdd]) ||
        null
      );
    case "ND": // Night dry
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
    case "NW": // Night wet
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

// Fuel fallbacks use same-precip priority — no modifiers exist for fuel,
// so cross-condition values are raw proxies (tier 2), not computed.
// Priority: exact → same-precip different-time → opposite-precip same-time → full opposite.
function resolveFuel(perf, condition) {
  if (!perf) return null;

  // Specific — driver's own field for this exact condition
  const specific = (source) =>
    source != null ? { value: source, tier: 1, marker: "" } : null;

  // Proxy — raw value from a related condition (tier 2, amber marker)
  const proxy = (source) =>
    source != null ? { value: source, tier: 2, marker: "*" } : null;

  switch (condition) {
    case "DD":
      return (
        specific(perf.fuel_dry) ||
        proxy(perf.fuel_night_dry) ||
        proxy(perf.fuel_wet) ||
        proxy(perf.fuel_night_wet) ||
        null
      );
    case "DW":
      return (
        specific(perf.fuel_wet) ||
        proxy(perf.fuel_night_wet) ||
        proxy(perf.fuel_dry) ||
        proxy(perf.fuel_night_dry) ||
        null
      );
    case "ND":
      return (
        specific(perf.fuel_night_dry) ||
        proxy(perf.fuel_dry) ||
        proxy(perf.fuel_night_wet) ||
        proxy(perf.fuel_wet) ||
        null
      );
    case "NW":
      return (
        specific(perf.fuel_night_wet) ||
        proxy(perf.fuel_wet) ||
        proxy(perf.fuel_night_dry) ||
        proxy(perf.fuel_dry) ||
        null
      );
    default:
      return null;
  }
}

// Maps a fallback tier to a display color. baseColor is used for tier 1 (specific).
function tierColor(tier, baseColor) {
  if (tier === 1) return baseColor;
  if (tier === 2) return "#c9a84c"; // amber — modifier-derived or raw fuel proxy
  if (tier === 3) return "#a07830"; // dim amber — zero/unset modifier used
  if (tier === 4) return "#4a9fd4"; // blue — team average (Part B)
  return "var(--text-dim)";
}

// ── Shared styles ──────────────────────────────────────────

const thStyle = {
  background: "var(--surface-2)",
  color: "var(--text-dim)",
  fontSize: "0.72rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  padding: "0.6rem 1rem",
  textAlign: "left",
  borderBottom: "1px solid var(--border)",
  whiteSpace: "nowrap",
};

const tdStyle = { padding: "0.6rem 1rem" };

// ── Resolved cell renderer ────────────────────────────────────────────────────
// Renders a lap time or fuel value resolved via the fallback chain.
// Color and marker convey the confidence tier. Returns "—" when nothing resolved.
function ResolvedCell({ resolved, formatter, baseColor = "var(--text)" }) {
  const t = useTranslations("performanceData");
  if (!resolved) return <span style={{ color: "var(--text-dim)" }}>—</span>;
  return (
    <span
      className="mono"
      style={{ color: tierColor(resolved.tier, baseColor) }}
      title={
        resolved.tier === 2
          ? t("estimatedModifier")
          : resolved.tier === 3
            ? t("estimatedNoModifier")
            : undefined
      }
    >
      {formatter(resolved.value)}
      {resolved.marker && (
        <sup style={{ fontSize: "0.65em", marginLeft: "1px" }}>
          {resolved.marker}
        </sup>
      )}
    </span>
  );
}

// ── Row component ──────────────────────────────────────────

// ── Garage61 helpers ──────────────────────────────────────────────────────────

const SESSION_LABELS = { 1: "P", 2: "Q", 3: "R" };

function lapConditionLabel(lap) {
  return lap.trackWetness === 0 && lap.precipitation < 0.01 ? "☀️" : "💧";
}


function DriverRow({
  signup,
  initialData,
  teamEntryId,
  onSaved,
  archived,
  dayWetAdd,
  nightDryAdd,
  nightWetAdd,
  iracingTrackId,
  currentDriverId,
  entryCarName,
  g61Linked,
}) {
  const driver = signup.drivers;
  const t = useTranslations("performanceData");
  const locale = useLocale();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [lapDryError, setLapDryError] = useState(false);
  const [lapWetError, setLapWetError] = useState(false);
  const [lapNightDryError, setLapNightDryError] = useState(false);
  const [lapNightWetError, setLapNightWetError] = useState(false);

  // Garage61 import state
  const [g61Panel, setG61Panel] = useState(false);
  const [g61Laps, setG61Laps] = useState(null); // null = not yet fetched
  const [g61Loading, setG61Loading] = useState(false);
  const [g61Error, setG61Error] = useState(null);
  const [g61Filter, setG61Filter] = useState("all"); // "all" | "dry" | "wet"
  const [g61Track, setG61Track] = useState(null);
  const [g61SessionFilter, setG61SessionFilter] = useState([]); // [] = all; else ["1"], ["3"], ["1","3"], etc.
  const [g61SameCarOnly, setG61SameCarOnly] = useState(true);
  const [g61DateFrom, setG61DateFrom] = useState("");
  const [g61DateTo, setG61DateTo] = useState("");
  const [g61DatePreset, setG61DatePreset] = useState("");
  const [g61MinFuel, setG61MinFuel] = useState("");
  const [g61MaxFuel, setG61MaxFuel] = useState("");
  const [g61MinTemp, setG61MinTemp] = useState("");
  const [g61MaxTemp, setG61MaxTemp] = useState("");
  const [g61MinWetness, setG61MinWetness] = useState("");
  const [g61MaxWetness, setG61MaxWetness] = useState("");
  const [g61Imported, setG61Imported] = useState({}); // lapField → lapId of last import

  const applyPreset = (preset) => {
    if (preset === "") {
      setG61DateFrom("");
      setG61DateTo("");
    } else {
      const today = new Date();
      const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
      const from = new Date(today);
      from.setDate(from.getDate() - days);
      setG61DateFrom(from.toISOString().slice(0, 10));
      setG61DateTo(today.toISOString().slice(0, 10));
    }
    setG61DatePreset(preset);
  };

  const toForm = (data) => ({
    lap_time_dry: secToDisplay(data?.lap_time_dry),
    lap_time_wet: secToDisplay(data?.lap_time_wet),
    fuel_dry: data?.fuel_dry != null ? String(data.fuel_dry) : "",
    fuel_wet: data?.fuel_wet != null ? String(data.fuel_wet) : "",
    setup_notes_dry: data?.setup_notes_dry || "",
    setup_notes_wet: data?.setup_notes_wet || "",
    lap_time_night_dry: secToDisplay(data?.lap_time_night_dry),
    lap_time_night_wet: secToDisplay(data?.lap_time_night_wet),
    fuel_night_dry:
      data?.fuel_night_dry != null ? String(data.fuel_night_dry) : "",
    fuel_night_wet:
      data?.fuel_night_wet != null ? String(data.fuel_night_wet) : "",
    setup_notes_night_dry: data?.setup_notes_night_dry || "",
    setup_notes_night_wet: data?.setup_notes_night_wet || "",
  });

  const [form, setForm] = useState(toForm(initialData));
  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  // Reusable blur handler — normalises lap time format on blur
  const makeLapBlur = (field, setErr) => () => {
    if (!form[field].trim()) {
      setErr(false);
      return;
    }
    const sec = displayToSec(form[field]);
    if (sec !== null) {
      setForm((prev) => ({ ...prev, [field]: secToDisplay(sec) }));
      setErr(false);
    } else {
      setErr(true);
    }
  };

  const handleSave = async () => {
    if (archived) return;
    if (form.lap_time_dry.trim() && displayToSec(form.lap_time_dry) === null) {
      setLapDryError(true);
      return;
    }
    if (form.lap_time_wet.trim() && displayToSec(form.lap_time_wet) === null) {
      setLapWetError(true);
      return;
    }
    if (
      form.lap_time_night_dry.trim() &&
      displayToSec(form.lap_time_night_dry) === null
    ) {
      setLapNightDryError(true);
      return;
    }
    if (
      form.lap_time_night_wet.trim() &&
      displayToSec(form.lap_time_night_wet) === null
    ) {
      setLapNightWetError(true);
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      team_entry_id: teamEntryId,
      driver_id: driver.id,
      lap_time_dry: displayToSec(form.lap_time_dry),
      lap_time_wet: displayToSec(form.lap_time_wet),
      fuel_dry: form.fuel_dry ? parseFloat(form.fuel_dry) : null,
      fuel_wet: form.fuel_wet ? parseFloat(form.fuel_wet) : null,
      setup_notes_dry: form.setup_notes_dry.trim() || null,
      setup_notes_wet: form.setup_notes_wet.trim() || null,
      lap_time_night_dry: displayToSec(form.lap_time_night_dry),
      lap_time_night_wet: displayToSec(form.lap_time_night_wet),
      fuel_night_dry: form.fuel_night_dry
        ? parseFloat(form.fuel_night_dry)
        : null,
      fuel_night_wet: form.fuel_night_wet
        ? parseFloat(form.fuel_night_wet)
        : null,
      setup_notes_night_dry: form.setup_notes_night_dry.trim() || null,
      setup_notes_night_wet: form.setup_notes_night_wet.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error: err } = await supabase
      .from("driver_performance")
      .upsert(payload, { onConflict: "team_entry_id,driver_id" })
      .select()
      .single();

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }
    setForm(toForm(data));
    setEditing(false);
    setSaving(false);
    onSaved && onSaved(data);
  };

  const handleCancel = () => {
    setForm(toForm(initialData));
    setEditing(false);
    setError(null);
    setLapDryError(false);
    setLapWetError(false);
    setLapNightDryError(false);
    setLapNightWetError(false);
    setG61Panel(false);
  };

  // ── Garage61 import handlers ───────────────────────────────────────────────

  const fetchG61Laps = async (forceRefresh = false) => {
    if (!forceRefresh && g61Laps !== null) { setG61Panel(true); return; } // use cache
    setG61Loading(true);
    setG61Error(null);
    try {
      const params = new URLSearchParams({ iracing_track_id: iracingTrackId });
      if (driver.id !== currentDriverId) params.set("driver_id", driver.id);
      const res = await fetch(`/api/garage61-sync?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setG61Error(data.error ?? t("g61ErrorUnknown"));
      } else {
        setG61Track(data.track);
        setG61Laps(data.laps ?? []);
        setG61Panel(true);
      }
    } catch {
      setG61Error(t("g61ErrorNetwork"));
    } finally {
      setG61Loading(false);
    }
  };

  const openG61 = () => { setEditing(true); fetchG61Laps(); };

  // Fill a lap time (and matching fuel) field from a Garage61 lap and close the panel
  const applyG61Lap = (lap, lapField) => {
    const fuelFieldMap = {
      lap_time_dry: "fuel_dry",
      lap_time_wet: "fuel_wet",
      lap_time_night_dry: "fuel_night_dry",
      lap_time_night_wet: "fuel_night_wet",
    };
    const fuelField = fuelFieldMap[lapField];
    setForm((prev) => ({
      ...prev,
      [lapField]: secToDisplay(lap.lapTime),
      ...(fuelField && lap.fuelUsed != null
        ? { [fuelField]: String(parseFloat(lap.fuelUsed.toFixed(3))) }
        : {}),
    }));
    if (lapField === "lap_time_dry") setLapDryError(false);
    if (lapField === "lap_time_wet") setLapWetError(false);
    if (lapField === "lap_time_night_dry") setLapNightDryError(false);
    if (lapField === "lap_time_night_wet") setLapNightWetError(false);
    setG61Imported((prev) => ({ ...prev, [lapField]: lap.id }));
  };

  if (!editing) {
    // Resolve all 8 conditions via the full fallback chains —
    // matches exactly what calcStint uses, so the table reflects real strategy values.
    const mods = { dayWetAdd, nightDryAdd, nightWetAdd };
    const rDD = resolveLapTime(initialData, "DD", mods);
    const rDW = resolveLapTime(initialData, "DW", mods);
    const rND = resolveLapTime(initialData, "ND", mods);
    const rNW = resolveLapTime(initialData, "NW", mods);
    const fDD = resolveFuel(initialData, "DD");
    const fDW = resolveFuel(initialData, "DW");
    const fND = resolveFuel(initialData, "ND");
    const fNW = resolveFuel(initialData, "NW");

    // Fuel display — strip trailing zeros, max 3 decimal places
    const fuelFmt = (v) => `${parseFloat(v.toFixed(3))}L`;

    return (
      <>
        {/* ── Day row ── */}
        <tr>
          <td
            style={{
              fontWeight: 600,
              padding: "0.6rem 1rem",
              borderBottom: "none",
            }}
          >
            {driver?.name || "—"}
            {/* Show last update timestamp — helps drivers confirm data is recent enough */}
            {initialData?.updated_at && (
              <div
                style={{
                  fontSize: "0.68rem",
                  fontWeight: 400,
                  color: "var(--text-dim)",
                  marginTop: "0.2rem",
                }}
              >
                {t("updatedOn")} {formatUpdatedAt(initialData.updated_at, locale)}
              </div>
            )}
          </td>
          {/* Dry lap time — resolves DD chain */}
          <td style={{ ...tdStyle, borderBottom: "none" }}>
            <ResolvedCell resolved={rDD} formatter={secToDisplay} />
          </td>
          {/* Wet lap time — resolves DW chain */}
          <td style={{ ...tdStyle, borderBottom: "none" }}>
            <ResolvedCell resolved={rDW} formatter={secToDisplay} />
          </td>
          {/* Dry fuel — resolves DD fuel chain */}
          <td style={{ ...tdStyle, borderBottom: "none" }}>
            <ResolvedCell
              resolved={fDD}
              formatter={fuelFmt}
              baseColor="var(--accent)"
            />
          </td>
          {/* Wet fuel — resolves DW fuel chain */}
          <td style={{ ...tdStyle, borderBottom: "none" }}>
            <ResolvedCell
              resolved={fDW}
              formatter={fuelFmt}
              baseColor="var(--accent)"
            />
          </td>
          {/* Setup notes — informational only, no fallback */}
          <td
            style={{
              ...tdStyle,
              borderBottom: "none",
              fontSize: "0.8rem",
              color: "var(--text-dim)",
              maxWidth: "180px",
            }}
          >
            {initialData?.setup_notes_dry || "—"}
          </td>
          <td
            style={{
              ...tdStyle,
              borderBottom: "none",
              fontSize: "0.8rem",
              color: "var(--text-dim)",
              maxWidth: "180px",
            }}
          >
            {initialData?.setup_notes_wet || "—"}
          </td>
          {/* Edit + Garage61 import — spans day + night rows */}
          <td style={{ ...tdStyle, borderBottom: "none" }} rowSpan={2}>
            {!archived && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <button
                  onClick={() => setEditing(true)}
                  className="btn btn-secondary btn-sm"
                >
                  {t("edit")}
                </button>
                {iracingTrackId && g61Linked &&
                  (driver.id === currentDriverId || !!driver.garage61_slug) && (
                  <button
                    onClick={openG61}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: "0.72rem" }}
                    disabled={g61Loading}
                  >
                    {g61Loading ? "…" : t("importGarage61")}
                  </button>
                )}
              </div>
            )}
          </td>
        </tr>

        {/* ── Night row ── */}
        <tr style={{ background: "rgba(60,60,100,0.08)" }}>
          <td
            style={{
              padding: "0.4rem 1rem",
              fontSize: "0.78rem",
              color: "var(--text-dim)",
              fontStyle: "italic",
            }}
          >
            {t("night")}
          </td>
          {/* Night dry lap — resolves ND chain (shows fallback with marker if needed) */}
          <td style={{ ...tdStyle, padding: "0.4rem 1rem" }}>
            <ResolvedCell resolved={rND} formatter={secToDisplay} />
          </td>
          {/* Night wet lap — resolves NW chain */}
          <td style={{ ...tdStyle, padding: "0.4rem 1rem" }}>
            <ResolvedCell resolved={rNW} formatter={secToDisplay} />
          </td>
          {/* Night dry fuel — resolves ND fuel chain */}
          <td style={{ ...tdStyle, padding: "0.4rem 1rem" }}>
            <ResolvedCell
              resolved={fND}
              formatter={fuelFmt}
              baseColor="var(--accent)"
            />
          </td>
          {/* Night wet fuel — resolves NW fuel chain */}
          <td style={{ ...tdStyle, padding: "0.4rem 1rem" }}>
            <ResolvedCell
              resolved={fNW}
              formatter={fuelFmt}
              baseColor="var(--accent)"
            />
          </td>
          {/* Night setup notes — informational only, no fallback */}
          <td
            style={{
              ...tdStyle,
              padding: "0.4rem 1rem",
              fontSize: "0.8rem",
              color: "var(--text-dim)",
              maxWidth: "180px",
            }}
          >
            {initialData?.setup_notes_night_dry || "—"}
          </td>
          <td
            style={{
              ...tdStyle,
              padding: "0.4rem 1rem",
              fontSize: "0.8rem",
              color: "var(--text-dim)",
              maxWidth: "180px",
            }}
          >
            {initialData?.setup_notes_night_wet || "—"}
          </td>
        </tr>
      </>
    );
  }

  // ── Garage61 filter helpers (computed once, used in edit mode panel) ────────
  const filteredLaps = (g61Laps ?? []).filter((lap) => {
    if (g61Filter === "dry" && lapConditionLabel(lap) !== "☀️") return false;
    if (g61Filter === "wet" && lapConditionLabel(lap) !== "💧") return false;
    if (g61SessionFilter.length > 0 && !g61SessionFilter.includes(String(lap.sessionType))) return false;
    if (g61SameCarOnly && entryCarName && lap.car) {
      const a = lap.car.toLowerCase();
      const b = entryCarName.toLowerCase();
      if (!a.includes(b) && !b.includes(a)) return false;
    }
    if (g61DateFrom && lap.startTime.slice(0, 10) < g61DateFrom) return false;
    if (g61DateTo && lap.startTime.slice(0, 10) > g61DateTo) return false;
    if (g61MinFuel !== "" && lap.fuelLevel != null && lap.fuelLevel < parseFloat(g61MinFuel)) return false;
    if (g61MaxFuel !== "" && lap.fuelLevel != null && lap.fuelLevel > parseFloat(g61MaxFuel)) return false;
    if (g61MinTemp !== "" && lap.trackTemp != null && lap.trackTemp < parseFloat(g61MinTemp)) return false;
    if (g61MaxTemp !== "" && lap.trackTemp != null && lap.trackTemp > parseFloat(g61MaxTemp)) return false;
    if (g61MinWetness !== "" && lap.trackWetness < parseFloat(g61MinWetness)) return false;
    if (g61MaxWetness !== "" && lap.trackWetness > parseFloat(g61MaxWetness)) return false;
    return true;
  }).sort((a, b) => a.lapTime - b.lapTime);

  const avgLapTime = filteredLaps.length > 0
    ? filteredLaps.reduce((s, l) => s + l.lapTime, 0) / filteredLaps.length
    : null;
  const fuelLaps = filteredLaps.filter((l) => l.fuelUsed != null);
  const avgFuelUsed = fuelLaps.length > 0
    ? fuelLaps.reduce((s, l) => s + l.fuelUsed, 0) / fuelLaps.length
    : null;
  const fuelLevelLaps = filteredLaps.filter((l) => l.fuelLevel != null);
  const avgFuelLevel = fuelLevelLaps.length > 0
    ? fuelLevelLaps.reduce((s, l) => s + l.fuelLevel, 0) / fuelLevelLaps.length
    : null;
  const trackTempLaps = filteredLaps.filter((l) => l.trackTemp != null);
  const avgTrackTemp = trackTempLaps.length > 0
    ? trackTempLaps.reduce((s, l) => s + l.trackTemp, 0) / trackTempLaps.length
    : null;
  const avgTrackWetness = filteredLaps.length > 0
    ? filteredLaps.reduce((s, l) => s + (l.trackWetness ?? 0), 0) / filteredLaps.length
    : null;

  const fBtnStyle = (active) => ({
    fontSize: "0.7rem",
    padding: "0.15rem 0.5rem",
    background: active ? "var(--accent)" : "var(--surface-2)",
    color: active ? "#000" : "var(--text-dim)",
    border: "1px solid var(--border)",
  });

  // ── Edit mode ──────────────────────────────────────────────
  return (
    <tr style={{ background: "var(--surface-2)" }}>
      <td colSpan={8} style={{ padding: "1rem" }}>
        <div
          style={{
            fontWeight: 700,
            marginBottom: "1rem",
            color: "var(--accent)",
          }}
        >
          {driver?.name}
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
            {error}
          </div>
        )}

        {/* ── ☀️ Sec / 💧 Pluie ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1.25rem",
            marginBottom: "1.25rem",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "0.72rem",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--text-dim)",
                marginBottom: "0.75rem",
              }}
            >
              {t("dry")}
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label>{t("lapTimePlaceholder")}</label>
                <input
                  type="text"
                  value={form.lap_time_dry}
                  onChange={(e) => {
                    set("lap_time_dry")(e);
                    setLapDryError(false);
                  }}
                  onBlur={makeLapBlur("lap_time_dry", setLapDryError)}
                  placeholder={t("lapTimeExample")}
                  style={{
                    borderColor: lapDryError ? "var(--danger)" : undefined,
                  }}
                />
                {lapDryError && (
                  <span style={{ fontSize: "0.75rem", color: "var(--danger)" }}>
                    {t("lapTimeInvalid")}
                  </span>
                )}
              </div>
              <div className="form-group">
                <label>{t("fuelPerLap")}</label>
                <input
                  type="number"
                  value={form.fuel_dry}
                  onChange={set("fuel_dry")}
                  placeholder={t("fuelExample")}
                  min="0"
                  max="20"
                  step="0.001"
                />
              </div>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label>{t("settingsDry")}</label>
                <input
                  type="text"
                  value={form.setup_notes_dry}
                  onChange={set("setup_notes_dry")}
                  placeholder={t("settingsExample")}
                />
              </div>
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: "0.72rem",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--text-dim)",
                marginBottom: "0.75rem",
              }}
            >
              {t("wet")}
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label>{t("lapTimePlaceholder")}</label>
                <input
                  type="text"
                  value={form.lap_time_wet}
                  onChange={(e) => {
                    set("lap_time_wet")(e);
                    setLapWetError(false);
                  }}
                  onBlur={makeLapBlur("lap_time_wet", setLapWetError)}
                  placeholder={t("wetLapExample")}
                  style={{
                    borderColor: lapWetError ? "var(--danger)" : undefined,
                  }}
                />
                {lapWetError && (
                  <span style={{ fontSize: "0.75rem", color: "var(--danger)" }}>
                    {t("lapTimeInvalid")}
                  </span>
                )}
              </div>
              <div className="form-group">
                <label>{t("fuelPerLap")}</label>
                <input
                  type="number"
                  value={form.fuel_wet}
                  onChange={set("fuel_wet")}
                  placeholder={t("wetFuelExample")}
                  min="0"
                  max="20"
                  step="0.001"
                />
              </div>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label>{t("settingsWet")}</label>
                <input
                  type="text"
                  value={form.setup_notes_wet}
                  onChange={set("setup_notes_wet")}
                  placeholder={t("settingsWetExample")}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── 🌙 Nuit ── */}
        <div
          style={{
            borderTop: "1px solid var(--border)",
            paddingTop: "1rem",
            marginBottom: "1.25rem",
          }}
        >
          <div
            style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--text-dim)",
              marginBottom: "0.75rem",
            }}
          >
            {t("nightSection")}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1.25rem",
            }}
          >
            {/* Night dry */}
            <div>
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "var(--text-dim)",
                  marginBottom: "0.5rem",
                }}
              >
                {t("nightDry")}
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>{t("lapTimePlaceholder")}</label>
                  <input
                    type="text"
                    value={form.lap_time_night_dry}
                    onChange={(e) => {
                      set("lap_time_night_dry")(e);
                      setLapNightDryError(false);
                    }}
                    onBlur={makeLapBlur(
                      "lap_time_night_dry",
                      setLapNightDryError,
                    )}
                    placeholder={t("nightDryLapExample")}
                    style={{
                      borderColor: lapNightDryError
                        ? "var(--danger)"
                        : undefined,
                    }}
                  />
                  {lapNightDryError && (
                    <span
                      style={{ fontSize: "0.75rem", color: "var(--danger)" }}
                    >
                      {t("lapTimeInvalid")}
                    </span>
                  )}
                </div>
                <div className="form-group">
                  <label>{t("fuelPerLap")}</label>
                  <input
                    type="number"
                    value={form.fuel_night_dry}
                    onChange={set("fuel_night_dry")}
                    placeholder={t("nightDryFuelExample")}
                    min="0"
                    max="20"
                    step="0.001"
                  />
                </div>
                <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                  <label>{t("settingsNightDry")}</label>
                  <input
                    type="text"
                    value={form.setup_notes_night_dry}
                    onChange={set("setup_notes_night_dry")}
                    placeholder={t("settingsNightDryExample")}
                  />
                </div>
              </div>
            </div>

            {/* Night wet */}
            <div>
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "var(--text-dim)",
                  marginBottom: "0.5rem",
                }}
              >
                {t("nightWet")}
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>{t("lapTimePlaceholder")}</label>
                  <input
                    type="text"
                    value={form.lap_time_night_wet}
                    onChange={(e) => {
                      set("lap_time_night_wet")(e);
                      setLapNightWetError(false);
                    }}
                    onBlur={makeLapBlur(
                      "lap_time_night_wet",
                      setLapNightWetError,
                    )}
                    placeholder={t("nightWetLapExample")}
                    style={{
                      borderColor: lapNightWetError
                        ? "var(--danger)"
                        : undefined,
                    }}
                  />
                  {lapNightWetError && (
                    <span
                      style={{ fontSize: "0.75rem", color: "var(--danger)" }}
                    >
                      {t("lapTimeInvalid")}
                    </span>
                  )}
                </div>
                <div className="form-group">
                  <label>{t("fuelPerLap")}</label>
                  <input
                    type="number"
                    value={form.fuel_night_wet}
                    onChange={set("fuel_night_wet")}
                    placeholder={t("nightWetFuelExample")}
                    min="0"
                    max="20"
                    step="0.001"
                  />
                </div>
                <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                  <label>{t("settingsNightWet")}</label>
                  <input
                    type="text"
                    value={form.setup_notes_night_wet}
                    onChange={set("setup_notes_night_wet")}
                    placeholder={t("settingsNightWetExample")}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Garage61 import panel ── */}
        {iracingTrackId && (
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem", marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-dim)" }}>
                {t("importFromGarage61")}
              </span>
              <button type="button" onClick={() => fetchG61Laps(g61Laps !== null)} className="btn btn-secondary btn-sm" disabled={g61Loading}>
                {g61Loading ? t("loading") : g61Laps !== null ? t("refresh") : t("loadLaps")}
              </button>
              {g61Track && (
                <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                  {g61Track.name}{g61Track.variant ? ` — ${g61Track.variant}` : ""}
                </span>
              )}
            </div>

            {g61Error && (
              <div style={{ fontSize: "0.8rem", color: "var(--danger)", marginBottom: "0.75rem" }}>
                {g61Error === "not_linked" && t("noGarage61")}
                {g61Error === "track_not_found" && t("noCircuit")}
                {g61Error === "token_expired" && t("sessionExpired")}
                {!["not_linked", "track_not_found", "token_expired"].includes(g61Error) && t("g61ErrorPrefix", { error: g61Error })}
              </div>
            )}

            {g61Panel && g61Laps !== null && (
              <>
                {/* ── Filter rows ── */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "0.6rem" }}>
                  <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
                    {/* Condition */}
                    <div style={{ display: "flex", gap: "0.25rem" }}>
                      {[["all", t("filterAll")], ["dry", t("filterDry")], ["wet", t("filterWet")]].map(([v, label]) => (
                        <button key={v} type="button" onClick={() => setG61Filter(v)} className="btn btn-sm" style={fBtnStyle(g61Filter === v)}>{label}</button>
                      ))}
                    </div>
                    {/* Session */}
                    <div style={{ display: "flex", gap: "0.25rem" }}>
                      {[["all", t("filterAll")], ["1", t("filterP")], ["2", t("filterQ")], ["3", t("filterR")]].map(([v, label]) => (
                        <button key={v} type="button" className="btn btn-sm"
                          style={fBtnStyle(v === "all" ? g61SessionFilter.length === 0 : g61SessionFilter.includes(v))}
                          onClick={() => {
                            if (v === "all") { setG61SessionFilter([]); return; }
                            setG61SessionFilter((prev) =>
                              prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]
                            );
                          }}
                        >{label}</button>
                      ))}
                    </div>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-dim)", marginLeft: "auto" }}>
                      {filteredLaps.length}/{g61Laps.length} {t("g61LapCount", { count: g61Laps.length })}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
                    {(() => {
                      const grpStyle = { display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.72rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "5px", padding: "0.2rem 0.5rem" };
                      const inStyle = (w) => ({ width: w, fontSize: "0.72rem", padding: "0.1rem 0.25rem", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "3px", color: "var(--text)" });
                      const lbl = { fontWeight: 600, color: "var(--text-dim)", marginRight: "0.1rem" };
                      const sep = <span style={{ color: "var(--text-dim)" }}>–</span>;
                      return (
                        <>
                          {entryCarName && (
                            <div style={grpStyle}>
                              <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", color: "var(--text-dim)", cursor: "pointer" }}>
                                <input type="checkbox" checked={g61SameCarOnly} onChange={(e) => setG61SameCarOnly(e.target.checked)} />
                                {t("sameCar")}
                              </label>
                            </div>
                          )}
                          <div style={grpStyle}>
                            <span style={lbl}>{t("fuelRange")}</span>
                            <input type="number" value={g61MinFuel} onChange={(e) => setG61MinFuel(e.target.value)} placeholder={t("fuelMin")} min="0" step="1" style={inStyle("74px")} />
                            {sep}
                            <input type="number" value={g61MaxFuel} onChange={(e) => setG61MaxFuel(e.target.value)} placeholder={t("fuelMax")} min="0" step="1" style={inStyle("74px")} />
                          </div>
                          <div style={grpStyle}>
                            <span style={lbl}>{t("trackTemp")}</span>
                            <input type="number" value={g61MinTemp} onChange={(e) => setG61MinTemp(e.target.value)} placeholder={t("trackTempMin")} min="0" step="1" style={inStyle("78px")} />
                            {sep}
                            <input type="number" value={g61MaxTemp} onChange={(e) => setG61MaxTemp(e.target.value)} placeholder={t("trackTempMax")} min="0" step="1" style={inStyle("78px")} />
                          </div>
                          <div style={grpStyle}>
                            <span style={lbl}>{t("humidity")}</span>
                            <input type="number" value={g61MinWetness} onChange={(e) => setG61MinWetness(e.target.value)} placeholder={t("humidityMin")} min="0" step="1" style={inStyle("62px")} />
                            {sep}
                            <input type="number" value={g61MaxWetness} onChange={(e) => setG61MaxWetness(e.target.value)} placeholder={t("humidityMax")} min="0" step="1" style={inStyle("62px")} />
                          </div>
                          <div style={grpStyle}>
                            <div style={{ display: "flex", gap: "0.25rem" }}>
                              {[["", t("dateAll")], ["7d", t("date7d")], ["30d", t("date30d")], ["90d", t("date3m")]].map(([v, label]) => (
                                <button key={v} type="button" onClick={() => applyPreset(v)} className="btn btn-sm" style={fBtnStyle(g61DatePreset === v)}>{label}</button>
                              ))}
                            </div>
                            <span style={{ color: "var(--text-dim)" }}>{t("dateFrom")}</span>
                            <input type="date" value={g61DateFrom} onChange={(e) => { setG61DateFrom(e.target.value); setG61DatePreset(""); }} style={{ fontSize: "0.72rem", padding: "0.1rem 0.3rem", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "3px", color: "var(--text)" }} />
                            <span style={{ color: "var(--text-dim)" }}>{t("dateTo")}</span>
                            <input type="date" value={g61DateTo} onChange={(e) => { setG61DateTo(e.target.value); setG61DatePreset(""); }} style={{ fontSize: "0.72rem", padding: "0.1rem 0.3rem", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "3px", color: "var(--text)" }} />
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {g61Laps.length === 0 ? (
                  <div style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>{t("noLaps")}</div>
                ) : filteredLaps.length === 0 ? (
                  <div style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>{t("noLapsFilter")}</div>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.5rem", padding: "0.4rem 0.75rem", background: "var(--surface)", border: "1px solid var(--border)", borderLeft: "3px solid var(--accent)", borderRadius: "4px" }}>
                      <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
                        {t("avgLap")} {filteredLaps.length}
                      </span>
                      <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap", fontSize: "0.78rem" }}>
                        <span className="mono" style={{ color: "var(--text)", fontWeight: 600 }}>{secToDisplay(avgLapTime)}</span>
                        {avgFuelUsed != null && (
                          <span style={{ color: "var(--text-dim)" }}>
                            {t("colFuel")} <span className="mono" style={{ color: "var(--accent)" }}>{parseFloat(avgFuelUsed.toFixed(3))} L</span>
                          </span>
                        )}
                        {avgFuelLevel != null && (
                          <span style={{ color: "var(--text-dim)" }}>
                            {t("colTank")} <span className="mono" style={{ color: "var(--text)" }}>{parseFloat(avgFuelLevel.toFixed(1))} L</span>
                          </span>
                        )}
                        {avgTrackTemp != null && (
                          <span style={{ color: "var(--text-dim)" }}>
                            {t("colTrackTemp")} <span className="mono" style={{ color: "var(--text)" }}>{Math.round(avgTrackTemp)}°</span>
                          </span>
                        )}
                        {avgTrackWetness != null && (
                          <span style={{ color: "var(--text-dim)" }}>
                            {t("colHumidity")} <span className="mono" style={{ color: "var(--text)" }}>{parseFloat(avgTrackWetness.toFixed(1))}</span>
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: "0.2rem", marginLeft: "auto" }}>
                        {[
                          ["lap_time_dry", "☀️"],
                          ["lap_time_wet", "💧"],
                          ["lap_time_night_dry", "🌙☀️"],
                          ["lap_time_night_wet", "🌙💧"],
                        ].map(([field, icon]) => {
                          const done = g61Imported[field] === "avg";
                          return (
                            <button key={field} type="button" onClick={() => applyG61Lap({ lapTime: avgLapTime, fuelUsed: avgFuelUsed, id: "avg" }, field)} className="btn btn-sm" style={{ fontSize: "0.62rem", padding: "0.15rem 0.35rem", ...(done ? { color: "var(--accent)", fontWeight: 700 } : {}) }}>
                              {done ? `✓ ${icon}` : `→ ${icon}`}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  <div style={{ maxHeight: "220px", overflowY: "auto", border: "1px solid var(--border)", borderRadius: "4px" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>

                      <thead>
                        <tr>
                          {["", t("colLapTime"), t("colFuel"), t("colTank"), t("colTrackTemp"), t("colHumidity"), t("colDate"), t("colCar"), t("colSession"), ""].map((h, i) => (
                            <th key={i} style={{ ...thStyle, fontSize: "0.65rem", padding: "0.35rem 0.6rem", position: "sticky", top: 0, zIndex: 1 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLaps.map((lap) => (
                          <tr key={lap.id} style={{ borderBottom: "1px solid var(--border)" }}>
                            <td style={{ padding: "0.3rem 0.6rem" }}>{lapConditionLabel(lap)}</td>
                            <td style={{ padding: "0.3rem 0.6rem", fontFamily: "var(--font-mono), monospace" }}>
                              {secToDisplay(lap.lapTime)}
                            </td>
                            <td style={{ padding: "0.3rem 0.6rem", fontFamily: "var(--font-mono), monospace", color: "var(--text-dim)" }}>
                              {lap.fuelUsed != null ? `${parseFloat(lap.fuelUsed.toFixed(3))}L` : "—"}
                            </td>
                            <td style={{ padding: "0.3rem 0.6rem", fontFamily: "var(--font-mono), monospace", color: "var(--text-dim)" }}>
                              {lap.fuelLevel != null ? `${parseFloat(lap.fuelLevel.toFixed(1))}L` : "—"}
                            </td>
                            <td style={{ padding: "0.3rem 0.6rem", fontFamily: "var(--font-mono), monospace", color: "var(--text-dim)" }}>
                              {lap.trackTemp != null ? `${Math.round(lap.trackTemp)}°` : "—"}
                            </td>
                            <td style={{ padding: "0.3rem 0.6rem", fontFamily: "var(--font-mono), monospace", color: "var(--text-dim)" }}>
                              {lap.trackWetness ?? 0}
                            </td>
                            <td style={{ padding: "0.3rem 0.6rem", color: "var(--text-dim)", whiteSpace: "nowrap" }}>
                              {new Date(lap.startTime).toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "2-digit" })}
                            </td>
                            <td style={{ padding: "0.3rem 0.6rem", color: "var(--text-dim)", maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {lap.car ?? "—"}
                            </td>
                            <td style={{ padding: "0.3rem 0.6rem", color: "var(--text-dim)" }}>
                              {SESSION_LABELS[lap.sessionType] ?? "?"}
                            </td>
                            <td style={{ padding: "0.3rem 0.6rem" }}>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.2rem" }}>
                                {[
                                  ["lap_time_dry", "☀️"],
                                  ["lap_time_wet", "💧"],
                                  ["lap_time_night_dry", "🌙☀️"],
                                  ["lap_time_night_wet", "🌙💧"],
                                ].map(([field, icon]) => {
                                  const done = g61Imported[field] === lap.id;
                                  return (
                                    <button key={field} type="button" onClick={() => applyG61Lap(lap, field)} className="btn btn-sm" style={{ fontSize: "0.62rem", padding: "0.15rem 0.35rem", ...(done ? { color: "var(--accent)", fontWeight: 700 } : {}) }}>
                                      {done ? `✓ ${icon}` : `→ ${icon}`}
                                    </button>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            onClick={handleSave}
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? t("saving") : t("save")}
          </button>
          <button onClick={handleCancel} className="btn btn-secondary">
            {t("cancel")}
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Main component ─────────────────────────────────────────

export default function PerformanceData({
  teamEntryId,
  assignedDrivers,
  archived = false,
  iracingTrackId = null,
  currentDriverId = null,
  entryCarName = null,
  g61Linked = false,
}) {
  const pathname = usePathname();
  const t = useTranslations("performanceData");
  const [perfData, setPerfData] = useState({});
  const [loading, setLoading] = useState(true);
  const [nightDryAdd, setNightDryAdd] = useState(0);
  const [nightWetAdd, setNightWetAdd] = useState(0);
  const [nightSaving, setNightSaving] = useState(false);
  const [dayWetAdd, setDayWetAdd] = useState(0);

  // Stable key that changes when the set of assigned drivers changes (including swaps at same count)
  const assignedDriverKey = assignedDrivers.map((d) => d.id).sort().join(",");

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (!teamEntryId || assignedDrivers.length === 0) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const [{ data: perfRows }, { data: entry }] = await Promise.all([
          supabase
            .from("driver_performance")
            .select("*")
            .eq("team_entry_id", teamEntryId),
          // Fetch night additive modifiers alongside performance data
          supabase
            .from("team_entries")
            .select(
              "night_dry_add_seconds, night_wet_add_seconds, day_wet_add_seconds",
            )
            .eq("id", teamEntryId)
            .single(),
        ]);
        const map = {};
        (perfRows || []).forEach((d) => {
          map[d.driver_id] = d;
        });
        setPerfData(map);
        if (entry) {
          setNightDryAdd(entry.night_dry_add_seconds || 0);
          setNightWetAdd(entry.night_wet_add_seconds || 0);
          setDayWetAdd(entry.day_wet_add_seconds || 0);
        }
      } catch {
        // non-critical — data visible on next navigation
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamEntryId, assignedDriverKey]);

  const handleSaved = (data) => {
    setPerfData((prev) => ({ ...prev, [data.driver_id]: data }));
  };

  // Auto-save modifier on blur — handles night dry, night wet, and day wet
  const saveModifier = async (field, value) => {
    if (archived) return;
    setNightSaving(true);
    // parseFloat handles negative values correctly — only falls back to 0 for empty/NaN
    const parsed =
      value === "" || isNaN(parseFloat(value)) ? 0 : parseFloat(value);
    await supabase
      .from("team_entries")
      .update({ [field]: parsed })
      .eq("id", teamEntryId);
    setNightSaving(false);
  };

  if (assignedDrivers.length === 0)
    return (
      <div className="card">
        <div className="empty">{t("noDrivers")}</div>
      </div>
    );
  if (loading)
    return (
      <div className="card">
        <div className="empty">{t("loading")}</div>
      </div>
    );

  return (
    <div>
      {/* Modifier card — hidden when archived */}
      {!archived && (
        <div className="card" style={{ marginBottom: "1rem" }}>
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
            {t("teamModifiers")}
          </div>
          <p
            style={{
              fontSize: "0.8rem",
              color: "var(--text-dim)",
              marginBottom: "0.75rem",
            }}
          >
            {t("teamModifiersDesc")}
          </p>
          <div
            style={{
              display: "flex",
              gap: "1.5rem",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {/* Day wet modifier */}
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <label
                style={{
                  fontSize: "0.82rem",
                  color: "var(--text-dim)",
                  whiteSpace: "nowrap",
                }}
              >
                {t("wetDay")}
              </label>
              <input
                type="number"
                value={dayWetAdd}
                step="0.1"
                onChange={(e) => setDayWetAdd(parseFloat(e.target.value) || 0)}
                onBlur={(e) =>
                  saveModifier("day_wet_add_seconds", e.target.value)
                }
                style={{
                  width: "80px",
                  fontFamily: "var(--font-mono), monospace",
                }}
                disabled={nightSaving}
              />
              <span style={{ fontSize: "0.82rem", color: "var(--text-dim)" }}>
                {t("seconds")}
              </span>
            </div>

            {/* Night dry modifier */}
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <label
                style={{
                  fontSize: "0.82rem",
                  color: "var(--text-dim)",
                  whiteSpace: "nowrap",
                }}
              >
                {t("nightDryShort")}
              </label>
              <input
                type="number"
                value={nightDryAdd}
                step="0.1"
                onChange={(e) =>
                  setNightDryAdd(parseFloat(e.target.value) || 0)
                }
                onBlur={(e) =>
                  saveModifier("night_dry_add_seconds", e.target.value)
                }
                style={{
                  width: "80px",
                  fontFamily: "var(--font-mono), monospace",
                }}
                disabled={nightSaving}
              />
              <span style={{ fontSize: "0.82rem", color: "var(--text-dim)" }}>
                {t("seconds")}
              </span>
            </div>

            {/* Night wet modifier */}
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <label
                style={{
                  fontSize: "0.82rem",
                  color: "var(--text-dim)",
                  whiteSpace: "nowrap",
                }}
              >
                {t("nightWetShort")}
              </label>
              <input
                type="number"
                value={nightWetAdd}
                step="0.1"
                onChange={(e) =>
                  setNightWetAdd(parseFloat(e.target.value) || 0)
                }
                onBlur={(e) =>
                  saveModifier("night_wet_add_seconds", e.target.value)
                }
                style={{
                  width: "80px",
                  fontFamily: "var(--font-mono), monospace",
                }}
                disabled={nightSaving}
              />
              <span style={{ fontSize: "0.82rem", color: "var(--text-dim)" }}>
                {t("seconds")}
              </span>
            </div>

            {nightSaving && (
              <span style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>
                {t("saving")}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Garage61 not linked notice — only when the track has a Garage61 ID */}
      {iracingTrackId && !g61Linked && !archived && (
        <div style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginBottom: "0.75rem" }}>
          <a href={`/auth/garage61?returnTo=${pathname}`} style={{ color: "var(--accent)" }}>{t("linkGarage61")}</a>
          {" "}{t("linkGarage61Desc")}
        </div>
      )}

      {/* Performance table */}
      <div className="table-wrap">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>{t("colDriver")}</th>
              <th style={thStyle}>{t("colDryLap")}</th>
              <th style={thStyle}>{t("colWetLap")}</th>
              <th style={thStyle}>{t("colDryFuel")}</th>
              <th style={thStyle}>{t("colWetFuel")}</th>
              <th style={thStyle}>{t("colDrySetup")}</th>
              <th style={thStyle}>{t("colWetSetup")}</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {assignedDrivers.map((signup) => (
              <DriverRow
                key={signup.drivers?.id}
                signup={signup}
                initialData={perfData[signup.drivers?.id] || null}
                teamEntryId={teamEntryId}
                onSaved={handleSaved}
                archived={archived}
                dayWetAdd={dayWetAdd}
                nightDryAdd={nightDryAdd}
                nightWetAdd={nightWetAdd}
                iracingTrackId={iracingTrackId}
                currentDriverId={currentDriverId}
                entryCarName={entryCarName}
                g61Linked={g61Linked}
              />
            ))}
          </tbody>
        </table>
      </div>
      {/* Fallback tier legend — always shown since ~ can fire even when modifiers=0 */}
      <div
        style={{
          marginTop: "0.75rem",
          fontSize: "0.72rem",
          color: "var(--text-dim)",
          display: "flex",
          gap: "1.25rem",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {[
          { color: "#c9a84c", marker: "*", label: t("teamModifier") },
          { color: "#a07830", marker: "~", label: t("noModifier") },
        ].map(({ color, marker, label }) => (
          <span
            key={marker}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
          >
            {/* Colored bar matching the StintGrid row border tint for this tier */}
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
    </div>
  );
}
