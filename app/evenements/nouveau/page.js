"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser as supabase } from "../../../lib/supabase-browser";
import { TIMEZONES, localToUTC } from "../../../lib/timezone";
import { DateTime } from "luxon";

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

// Validates a time string is in strict HH:MM format with valid hour (0-23)
// and minute (0-59). Returns false for anything malformed — guards against
// mobile Safari treating type="time" as plain text input.
function isValidTime(str) {
  if (!str) return true; // empty is valid — fields are optional
  const match = str.match(/^(\d{2}):(\d{2})$/);
  if (!match) return false;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

// Auto-generate a label from date + time in the event timezone.
// Mirrors the same function in StartTimesManager to keep labels consistent.
function generateLabel(date, time, tz) {
  const dt = DateTime.fromISO(`${date}T${time}:00`, { zone: tz }).setLocale(
    "fr",
  );
  const dayName = dt.toFormat("EEEE");
  const dayNum = dt.toFormat("d");
  const month = dt.toFormat("MMMM yyyy");
  return `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${dayNum} ${month}`;
}

const emptyForm = {
  name: "",
  duration_minutes: "",
  circuit_id: "",
  format: "",
  ig_start_time: "",
  timezone: "Europe/Paris",
  ig_sunrise: "",
  ig_sunset: "",
  notes: "",
};

export default function NouvelEvenement() {
  const router = useRouter();
  const [form, setForm] = useState(emptyForm);
  const [circuits, setCircuits] = useState([]);
  const [selectedBaseTrack, setSelectedBaseTrack] = useState("");
  const [pitTime, setPitTime] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [eventTypes, setEventTypes] = useState([]);
  const [durations, setDurations] = useState([]);
  const [isSpecial, setIsSpecial] = useState(false);
  const [weekendStartDate, setWeekendStartDate] = useState("");
  const [specialStartTimes, setSpecialStartTimes] = useState([]);
  const [authChecked, setAuthChecked] = useState(false);
  // Track name lookup: iracing_track_id → track_name
  const [trackNameById, setTrackNameById] = useState({});

  // Start time entries for non-special events — built before the event exists.
  // Each entry: { id (local key), date, time }
  const [startTimeEntries, setStartTimeEntries] = useState([]);
  // Controls which entry row is showing its inline add/edit form
  const [addingStartTime, setAddingStartTime] = useState(false);
  const [newStartDate, setNewStartDate] = useState("");
  const [newStartTime, setNewStartTime] = useState("");
  const [startTimeError, setStartTimeError] = useState(null);

  // Auth checked client-side because this is a client component (needs form interactivity).
  // Redirects non-admins before rendering the form.
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.push("/login");
        return;
      }
      const { data: driver } = await supabase
        .from("drivers")
        .select("role")
        .eq("auth_user_id", user.id)
        .single();
      if (
        !driver ||
        (driver.role !== "admin" && driver.role !== "super_admin")
      ) {
        router.push("/");
        return;
      }
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    supabase
      .from("circuits")
      .select("id, name, pit_lane_time_seconds, iracing_track_id")
      .order("name")
      .then(({ data }) => setCircuits(data || []));
  }, []);

  useEffect(() => {
    supabase
      .from("iracing_tracks")
      .select("iracing_track_id, track_name")
      .then(({ data }) => {
        const map = {};
        for (const t of data || []) map[t.iracing_track_id] = t.track_name;
        setTrackNameById(map);
      });
  }, []);

  // Auto-fill pit lane time when circuit changes — read from circuits reference data.
  // Displayed as read-only so the user knows it's sourced from the circuit, not manual.
  useEffect(() => {
    if (!form.circuit_id) {
      setPitTime(null);
      return;
    }
    const c = circuits.find((c) => c.id === form.circuit_id);
    setPitTime(c ? c.pit_lane_time_seconds : null);
  }, [form.circuit_id, circuits]);

  useEffect(() => {
    supabase
      .from("event_types")
      .select("name")
      .order("sort_order")
      .then(({ data }) => setEventTypes(data?.map((t) => t.name) || []));
  }, []);

  useEffect(() => {
    supabase
      .from("event_duration_presets")
      .select("*")
      .order("minutes")
      .then(({ data }) => setDurations(data || []));
  }, []);

  useEffect(() => {
    supabase
      .from("special_event_start_times")
      .select("*")
      .order("day_of_week")
      .order("hour")
      .order("minute")
      .then(({ data }) => setSpecialStartTimes(data || []));
  }, []);

  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const setDuration = (value) => {
    setCustomH("");
    setCustomM("");
    setForm((prev) => ({ ...prev, duration_minutes: value }));
  };

  // Convert h + m inputs to total minutes
  const [customH, setCustomH] = useState("");
  const [customM, setCustomM] = useState("");

  const handleCustomHM = (h, m) => {
    const hVal = parseInt(h) || 0;
    const mVal = parseInt(m) || 0;
    const total = hVal * 60 + mVal;
    setForm((prev) => ({ ...prev, duration_minutes: total || "" }));
  };

  // True when the selected duration matches a preset button — used to highlight
  // the active preset and style the custom h/m inputs as inactive.
  const isPreset = durations.some((d) => d.minutes === form.duration_minutes);

  // ── Start time entry helpers ─────────────────────────────────────────────

  const resetStartTimeForm = () => {
    setAddingStartTime(false);
    setNewStartDate("");
    setNewStartTime("");
    setStartTimeError(null);
  };

  const handleAddStartTime = () => {
    if (!newStartDate) {
      setStartTimeError("La date est obligatoire.");
      return;
    }
    if (!newStartTime) {
      setStartTimeError("L'heure est obligatoire.");
      return;
    }
    setStartTimeEntries((prev) => [
      ...prev,
      { id: Date.now(), date: newStartDate, time: newStartTime },
    ]);
    resetStartTimeForm();
  };

  const removeStartTime = (id) => {
    setStartTimeEntries((prev) => prev.filter((e) => e.id !== id));
  };

  // Sort entries chronologically for display
  const sortedStartTimeEntries = [...startTimeEntries].sort((a, b) => {
    const aVal = `${a.date}T${a.time}`;
    const bVal = `${b.date}T${b.time}`;
    return aVal.localeCompare(bVal);
  });

  // ── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Validate in-game time fields — mobile Safari ignores type="time" constraints
    if (!isValidTime(form.ig_start_time)) {
      setError(
        "L'heure de départ IG est invalide — format attendu : HH:MM (ex : 13:00).",
      );
      return;
    }
    if (!isValidTime(form.ig_sunrise)) {
      setError(
        "L'heure de lever de soleil IG est invalide — format attendu : HH:MM (ex : 06:30).",
      );
      return;
    }
    if (!isValidTime(form.ig_sunset)) {
      setError(
        "L'heure de coucher de soleil IG est invalide — format attendu : HH:MM (ex : 20:00).",
      );
      return;
    }
    if (!form.name.trim()) {
      setError("Le nom est obligatoire.");
      return;
    }
    if (!form.duration_minutes) {
      setError("La durée est obligatoire.");
      return;
    }
    if (!form.circuit_id) {
      setError("Le circuit est obligatoire.");
      return;
    }
    // Special event weekend date must be a Friday
    if (isSpecial && weekendStartDate) {
      const day = new Date(weekendStartDate + "T00:00:00").getDay();
      if (day !== 5) {
        setError("La date du weekend doit être un vendredi.");
        return;
      }
    }
    setLoading(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      duration_minutes: parseInt(form.duration_minutes),
      circuit_id: form.circuit_id,
      format: form.format || null,
      ig_start_time: form.ig_start_time || null,
      timezone: form.timezone,
      ig_sunrise: form.ig_sunrise || null,
      ig_sunset: form.ig_sunset || null,
      notes: form.notes.trim() || null,
      is_special: isSpecial,
      weekend_start_date:
        isSpecial && weekendStartDate ? weekendStartDate : null,
    };

    const { data, error: err } = await supabase
      .from("events")
      .insert([payload])
      .select()
      .single();

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    // Auto-generate start times for special events from predefined slots
    if (isSpecial && weekendStartDate && specialStartTimes.length > 0) {
      const friday = DateTime.fromISO(weekendStartDate, {
        zone: form.timezone,
      });
      // vendredi = +0 days, samedi = +1, dimanche = +2
      const startTimeRows = specialStartTimes.map((st) => {
        const dayOffset =
          { vendredi: 0, samedi: 1, dimanche: 2 }[st.day_of_week] || 0;
        const dt = friday.plus({ days: dayOffset }).set({
          hour: st.hour,
          minute: st.minute,
          second: 0,
          millisecond: 0,
        });
        return {
          event_id: data.id,
          label: `${st.day_of_week.charAt(0).toUpperCase() + st.day_of_week.slice(1)} ${dt.toFormat("d MMMM yyyy", { locale: "fr" })}`,
          irl_start: dt.toUTC().toISO(),
        };
      });
      await supabase.from("event_start_times").insert(startTimeRows);
    }

    // Insert manually added start times for normal events
    if (!isSpecial && startTimeEntries.length > 0) {
      const rows = startTimeEntries.map((entry) => ({
        event_id: data.id,
        label: generateLabel(entry.date, entry.time, form.timezone),
        irl_start: localToUTC(entry.date, entry.time, form.timezone),
      }));
      await supabase.from("event_start_times").insert(rows);
    }

    router.push(`/evenements/${data.id}`);
    router.refresh();
  };

  const durationButtonStyle = (value) => ({
    padding: "0.45rem 1rem",
    borderRadius: "3px",
    border: "1px solid",
    borderColor:
      form.duration_minutes === value ? "var(--accent)" : "var(--border)",
    background:
      form.duration_minutes === value
        ? "var(--accent-dim)"
        : "var(--surface-2)",
    color:
      form.duration_minutes === value ? "var(--accent)" : "var(--text-dim)",
    fontFamily: "var(--font-mono), monospace",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: "0.9rem",
    transition: "all 0.15s",
  });

  // Group Kronos circuits by iRacing base track name for two-step picker
  const circuitGroups = useMemo(() => {
    const groups = {};
    const unlinked = [];
    for (const c of circuits) {
      if (c.iracing_track_id && trackNameById[c.iracing_track_id]) {
        const baseName = trackNameById[c.iracing_track_id];
        if (!groups[baseName]) groups[baseName] = [];
        groups[baseName].push(c);
      } else {
        unlinked.push(c);
      }
    }
    return {
      sorted: Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)),
      unlinked,
    };
  }, [circuits, trackNameById]);

  if (!authChecked)
    return (
      <div className="page">
        <p style={{ color: "var(--text-dim)" }}>Vérification des droits…</p>
      </div>
    );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Nouvel événement</h1>
          <div className="accent-line" />
        </div>
        <Link href="/evenements" className="btn btn-secondary">
          ← Retour
        </Link>
      </div>

      <form onSubmit={handleSubmit}>
        {/* ── Informations générales ── */}
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <h3 style={{ marginBottom: "1.25rem", color: "var(--text-dim)" }}>
            Informations générales
          </h3>
          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="name">Nom de l&apos;événement *</label>
              <input
                id="name"
                type="text"
                value={form.name}
                onChange={set("name")}
                placeholder="ex : Nürburgring 24h 2025"
                required
              />
            </div>
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={isSpecial}
                  onChange={(e) => setIsSpecial(e.target.checked)}
                  style={{
                    accentColor: "var(--accent)",
                    width: "16px",
                    height: "16px",
                  }}
                />
                <span>Événement spécial (horaires de départ prédéfinis)</span>
              </label>
            </div>

            {isSpecial && (
              <div className="form-group">
                <label htmlFor="weekend_start_date">
                  Date du weekend (vendredi) *
                </label>
                <input
                  id="weekend_start_date"
                  type="date"
                  value={weekendStartDate}
                  onChange={(e) => setWeekendStartDate(e.target.value)}
                />
                <p
                  style={{
                    fontSize: "0.78rem",
                    color: "var(--text-dim)",
                    marginTop: "0.4rem",
                  }}
                >
                  💡 La date doit être un vendredi — les horaires du samedi et
                  dimanche sont générés automatiquement.
                </p>
                {specialStartTimes.length === 0 && (
                  <div
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--danger)",
                      marginTop: "0.5rem",
                    }}
                  >
                    Aucun horaire prédéfini configuré — ajoutez-en dans Admin →
                    Paramètres.
                  </div>
                )}
                {weekendStartDate && specialStartTimes.length > 0 && (
                  <div
                    style={{
                      marginTop: "0.75rem",
                      fontSize: "0.82rem",
                      color: "var(--text-dim)",
                    }}
                  >
                    Les créneaux suivants seront générés automatiquement après
                    création :
                    {specialStartTimes.map((st) => {
                      const dayOffset =
                        { vendredi: 0, samedi: 1, dimanche: 2 }[
                          st.day_of_week
                        ] || 0;
                      const date = new Date(weekendStartDate);
                      date.setDate(date.getDate() + dayOffset);
                      const dateStr = date.toLocaleDateString("fr-FR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      });
                      return (
                        <div
                          key={st.id}
                          style={{
                            color: "var(--accent)",
                            fontFamily: "var(--font-mono), monospace",
                          }}
                        >
                          {dateStr} à {String(st.hour).padStart(2, "0")}:
                          {String(st.minute).padStart(2, "0")}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="format">Format</label>
              <select id="format" value={form.format} onChange={set("format")}>
                <option value="">— Sélectionner —</option>
                {eventTypes.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            {/* Duration */}
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label>Durée *</label>
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  flexWrap: "wrap",
                  marginBottom: "0.5rem",
                }}
              >
                {durations.map(({ minutes }) => (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => {
                      setDuration(minutes);
                      setCustomH("");
                      setCustomM("");
                    }}
                    style={durationButtonStyle(minutes)}
                  >
                    {formatDuration(minutes)}
                  </button>
                ))}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
                  Autre :
                </span>
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={customH}
                  onChange={(e) => {
                    setCustomH(e.target.value);
                    setForm((prev) => ({ ...prev, duration_minutes: "" }));
                    handleCustomHM(e.target.value, customM);
                  }}
                  placeholder="h"
                  style={{
                    width: "70px",
                    padding: "0.45rem 0.5rem",
                    background: "var(--surface-2)",
                    border: "1px solid",
                    borderColor:
                      !isPreset && form.duration_minutes
                        ? "var(--accent)"
                        : "var(--border)",
                    borderRadius: "3px",
                    color: "var(--text)",
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: "0.9rem",
                  }}
                />
                <span style={{ color: "var(--text-dim)" }}>h</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={customM}
                  onChange={(e) => {
                    setCustomM(e.target.value);
                    setForm((prev) => ({ ...prev, duration_minutes: "" }));
                    handleCustomHM(customH, e.target.value);
                  }}
                  placeholder="min"
                  style={{
                    width: "70px",
                    padding: "0.45rem 0.5rem",
                    background: "var(--surface-2)",
                    border: "1px solid",
                    borderColor:
                      !isPreset && form.duration_minutes
                        ? "var(--accent)"
                        : "var(--border)",
                    borderRadius: "3px",
                    color: "var(--text)",
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: "0.9rem",
                  }}
                />
                <span style={{ color: "var(--text-dim)" }}>min</span>
                {!isPreset && form.duration_minutes > 0 && (
                  <span
                    style={{
                      color: "var(--accent)",
                      fontFamily: "var(--font-mono), monospace",
                      fontSize: "0.85rem",
                    }}
                  >
                    = {Math.floor(form.duration_minutes / 60)}h
                    {(form.duration_minutes % 60).toString().padStart(2, "0")}
                  </span>
                )}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="timezone">Fuseau horaire</label>
              <select
                id="timezone"
                value={form.timezone}
                onChange={set("timezone")}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                value={form.notes}
                onChange={set("notes")}
                rows={2}
                placeholder="Infos complémentaires…"
              />
            </div>
          </div>
        </div>

        {/* ── Circuit ── */}
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <h3 style={{ marginBottom: "1.25rem", color: "var(--text-dim)" }}>
            Circuit
          </h3>
          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label>Circuit *</label>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                {/* Step 1 — base track */}
                <select
                  value={selectedBaseTrack}
                  onChange={(e) => {
                    setSelectedBaseTrack(e.target.value);
                    setForm((prev) => ({ ...prev, circuit_id: "" }));
                  }}
                >
                  <option value="">— Sélectionner un circuit —</option>
                  {circuitGroups.sorted.map(([baseName]) => (
                    <option key={baseName} value={baseName}>
                      {baseName}
                    </option>
                  ))}
                  {circuitGroups.unlinked.length > 0 && (
                    <optgroup label="— Autres —">
                      {circuitGroups.unlinked.map((c) => (
                        <option key={c.id} value={`__direct__${c.id}`}>
                          {c.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>

                {/* Step 2 — layout (only shown when base track has multiple layouts) */}
                {selectedBaseTrack &&
                  !selectedBaseTrack.startsWith("__direct__") &&
                  (() => {
                    const layouts =
                      circuitGroups.sorted.find(
                        ([name]) => name === selectedBaseTrack,
                      )?.[1] || [];
                    if (
                      layouts.length === 1 &&
                      form.circuit_id !== layouts[0].id
                    ) {
                      setForm((prev) => ({
                        ...prev,
                        circuit_id: layouts[0].id,
                      }));
                    }
                    if (layouts.length <= 1) return null;
                    return (
                      <select
                        value={form.circuit_id}
                        onChange={set("circuit_id")}
                      >
                        <option value="">— Sélectionner un layout —</option>
                        {layouts.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    );
                  })()}

                {/* Direct unlinked circuit — set circuit_id immediately */}
                {selectedBaseTrack.startsWith("__direct__") &&
                  (() => {
                    const directId = selectedBaseTrack.replace(
                      "__direct__",
                      "",
                    );
                    if (form.circuit_id !== directId) {
                      setForm((prev) => ({ ...prev, circuit_id: directId }));
                    }
                    return null;
                  })()}
              </div>
            </div>
            <div className="form-group">
              <label>Temps pit lane (auto-rempli)</label>
              <div
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "3px",
                  padding: "0.55rem 0.75rem",
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: "0.9rem",
                  color: pitTime ? "var(--accent)" : "var(--text-dim)",
                }}
              >
                {pitTime ? `${pitTime}s` : "— sélectionnez un circuit"}
              </div>
            </div>
          </div>
        </div>

        {/* ── Horaires de départ IRL — hidden for special events (auto-generated) ── */}
        {!isSpecial && (
          <div className="card" style={{ marginBottom: "1.25rem" }}>
            <h3 style={{ marginBottom: "0.25rem", color: "var(--text-dim)" }}>
              Horaires de départ IRL
            </h3>
            <p
              style={{
                fontSize: "0.8rem",
                color: "var(--text-dim)",
                marginBottom: "1.25rem",
              }}
            >
              Optionnel — peut aussi être configuré après création.
            </p>

            {sortedStartTimeEntries.length > 0 && (
              <div className="table-wrap" style={{ marginBottom: "0.75rem" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Créneau de départ</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStartTimeEntries.map((entry) => (
                      <tr key={entry.id}>
                        <td>
                          {/* Preview label — same format as StartTimesManager */}
                          <div style={{ fontWeight: 600 }}>
                            {generateLabel(
                              entry.date,
                              entry.time,
                              form.timezone,
                            )}
                          </div>
                          <div
                            className="mono"
                            style={{
                              fontSize: "0.82rem",
                              color: "var(--accent)",
                              marginTop: "0.1rem",
                            }}
                          >
                            Départ à {entry.time}
                          </div>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            onClick={() => removeStartTime(entry.id)}
                            className="btn btn-danger btn-sm"
                          >
                            Supprimer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Inline add form — matches StartTimesManager inline form style */}
            {addingStartTime ? (
              <div className="card">
                <h3 style={{ marginBottom: "1rem", color: "var(--text-dim)" }}>
                  Nouveau créneau
                </h3>
                <div
                  style={{ padding: "1rem", background: "var(--surface-2)" }}
                >
                  <div className="form-grid" style={{ marginBottom: "1rem" }}>
                    <div className="form-group">
                      <label>Date IRL</label>
                      <input
                        type="date"
                        value={newStartDate}
                        onChange={(e) => setNewStartDate(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>Heure IRL (24h)</label>
                      <input
                        type="time"
                        value={newStartTime}
                        onChange={(e) => setNewStartTime(e.target.value)}
                      />
                    </div>
                  </div>
                  {startTimeError && (
                    <div
                      className="alert alert-error"
                      style={{ marginBottom: "0.75rem" }}
                    >
                      {startTimeError}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: "0.75rem" }}>
                    <button
                      type="button"
                      onClick={handleAddStartTime}
                      className="btn btn-primary"
                    >
                      ✓ Ajouter
                    </button>
                    <button
                      type="button"
                      onClick={resetStartTimeForm}
                      className="btn btn-secondary"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAddingStartTime(true);
                  setStartTimeError(null);
                }}
                className="btn btn-secondary"
              >
                + Ajouter un créneau de départ
              </button>
            )}
          </div>
        )}

        {/* ── Horaires in-game ── */}
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <h3 style={{ marginBottom: "0.5rem", color: "var(--text-dim)" }}>
            Horaires in-game
          </h3>
          <p
            style={{
              fontSize: "0.8rem",
              color: "var(--text-dim)",
              marginBottom: "1.25rem",
            }}
          >
            Communs à tous les équipages. Heures en format 24h.
          </p>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="ig_start_time">Heure de départ IG (HH:MM)</label>
              <input
                id="ig_start_time"
                type="time"
                value={form.ig_start_time}
                onChange={set("ig_start_time")}
              />
            </div>
            <div className="form-group">
              <label htmlFor="ig_sunrise">Lever de soleil IG (HH:MM)</label>
              <input
                id="ig_sunrise"
                type="time"
                value={form.ig_sunrise}
                onChange={set("ig_sunrise")}
              />
            </div>
            <div className="form-group">
              <label htmlFor="ig_sunset">Coucher de soleil IG (HH:MM)</label>
              <input
                id="ig_sunset"
                type="time"
                value={form.ig_sunset}
                onChange={set("ig_sunset")}
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
            {error}
          </div>
        )}
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Enregistrement…" : "✓ Créer l'événement"}
          </button>
          <Link href="/evenements" className="btn btn-secondary">
            Annuler
          </Link>
        </div>
      </form>
    </div>
  );
}
