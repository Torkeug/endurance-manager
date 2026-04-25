"use client";
import { useState, useEffect } from "react";
import { supabaseBrowser as supabase } from "../../../../../lib/supabase-browser";

// ── Lap time helpers ───────────────────────────────────────

function secToDisplay(sec) {
  if (!sec && sec !== 0) return "";
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(3).padStart(6, "0");
  return `${m}:${s}`;
}

function displayToSec(str) {
  if (!str || !str.trim()) return null;
  const match = str.trim().match(/^(\d+):([0-5]\d)\.(\d{1,3})$/);
  if (!match) return null;
  return (
    parseInt(match[1]) * 60 +
    parseInt(match[2]) +
    parseFloat(`0.${match[3].padEnd(3, "0")}`)
  );
}

// Format an ISO timestamp to a human-readable French date+time string
// e.g. "12 avril 2026 à 14:32"
function formatUpdatedAt(isoStr) {
  if (!isoStr) return null;
  return new Date(isoStr).toLocaleString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

// ── Row component ──────────────────────────────────────────

function DriverRow({
  signup,
  initialData,
  teamEntryId,
  onSaved,
  archived,
  dayWetAdd,
  nightDryAdd,
  nightWetAdd,
}) {
  const driver = signup.drivers;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [lapDryError, setLapDryError] = useState(false);
  const [lapWetError, setLapWetError] = useState(false);
  const [lapNightDryError, setLapNightDryError] = useState(false);
  const [lapNightWetError, setLapNightWetError] = useState(false);

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
  };

  const hasDay =
    initialData &&
    (initialData.lap_time_dry ||
      initialData.lap_time_wet ||
      initialData.fuel_dry ||
      initialData.fuel_wet);
  const hasNight =
    initialData &&
    (initialData.lap_time_night_dry ||
      initialData.lap_time_night_wet ||
      initialData.fuel_night_dry ||
      initialData.fuel_night_wet);

  if (!editing) {
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
            {/* Show last update time when performance data exists — helps drivers
      know if lap times are recent enough to be used for strategy */}
            {initialData?.updated_at && (
              <div
                style={{
                  fontSize: "0.68rem",
                  fontWeight: 400,
                  color: "var(--text-dim)",
                  marginTop: "0.2rem",
                }}
              >
                Mis à jour le {formatUpdatedAt(initialData.updated_at)}
              </div>
            )}
          </td>
          <td style={{ ...tdStyle, borderBottom: "none" }}>
            <span
              className="mono"
              style={{ color: hasDay ? "var(--text)" : "var(--text-dim)" }}
            >
              {secToDisplay(initialData?.lap_time_dry) || "—"}
            </span>
          </td>
          <td style={{ ...tdStyle, borderBottom: "none" }}>
            <span
              className="mono"
              style={{ color: hasDay ? "var(--text)" : "var(--text-dim)" }}
            >
              {secToDisplay(initialData?.lap_time_wet) || "—"}
            </span>
          </td>
          <td style={{ ...tdStyle, borderBottom: "none" }}>
            <span
              className="mono"
              style={{ color: hasDay ? "var(--accent)" : "var(--text-dim)" }}
            >
              {initialData?.fuel_dry != null ? `${initialData.fuel_dry}L` : "—"}
            </span>
          </td>
          <td style={{ ...tdStyle, borderBottom: "none" }}>
            <span
              className="mono"
              style={{ color: hasDay ? "var(--accent)" : "var(--text-dim)" }}
            >
              {initialData?.fuel_wet != null ? `${initialData.fuel_wet}L` : "—"}
            </span>
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
          {/* Modifier button spans both day and night rows */}
          <td style={{ ...tdStyle, borderBottom: "none" }} rowSpan={2}>
            {!archived && (
              <button
                onClick={() => setEditing(true)}
                className="btn btn-secondary btn-sm"
              >
                Modifier
              </button>
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
            🌙 Nuit
          </td>
          {/* Night dry lap — show fallback hint when modifier is set but no specific night data */}
          <td style={{ ...tdStyle, padding: "0.4rem 1rem" }}>
            <span
              className="mono"
              style={{
                fontSize: "0.82rem",
                color: hasNight ? "var(--text)" : "var(--text-dim)",
              }}
            >
              {secToDisplay(initialData?.lap_time_night_dry) ||
                (initialData?.lap_time_dry && nightDryAdd !== 0 ? (
                  <span style={{ fontSize: "0.74rem" }}>
                    → {secToDisplay(initialData.lap_time_dry + nightDryAdd)}*
                  </span>
                ) : (
                  "—"
                ))}
            </span>
          </td>
          {/* Night wet lap */}
          <td style={{ ...tdStyle, padding: "0.4rem 1rem" }}>
            <span
              className="mono"
              style={{
                fontSize: "0.82rem",
                color: hasNight ? "var(--text)" : "var(--text-dim)",
              }}
            >
              {secToDisplay(initialData?.lap_time_night_wet) ||
                (nightWetAdd !== 0 &&
                (initialData?.lap_time_wet || initialData?.lap_time_dry) ? (
                  <span style={{ fontSize: "0.74rem" }}>
                    →{" "}
                    {secToDisplay(
                      (initialData.lap_time_wet || initialData.lap_time_dry) +
                        nightWetAdd,
                    )}
                    *
                  </span>
                ) : (
                  "—"
                ))}
            </span>
          </td>
          <td style={{ ...tdStyle, padding: "0.4rem 1rem" }}>
            <span
              className="mono"
              style={{
                fontSize: "0.82rem",
                color: hasNight ? "var(--accent)" : "var(--text-dim)",
              }}
            >
              {initialData?.fuel_night_dry != null
                ? `${initialData.fuel_night_dry}L`
                : "—"}
            </span>
          </td>
          <td style={{ ...tdStyle, padding: "0.4rem 1rem" }}>
            <span
              className="mono"
              style={{
                fontSize: "0.82rem",
                color: hasNight ? "var(--accent)" : "var(--text-dim)",
              }}
            >
              {initialData?.fuel_night_wet != null
                ? `${initialData.fuel_night_wet}L`
                : "—"}
            </span>
          </td>
          {/* Separate dry/wet setup notes for night */}
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
              ☀️ Sec
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label>Chrono (MM:SS.mmm)</label>
                <input
                  type="text"
                  value={form.lap_time_dry}
                  onChange={(e) => {
                    set("lap_time_dry")(e);
                    setLapDryError(false);
                  }}
                  onBlur={makeLapBlur("lap_time_dry", setLapDryError)}
                  placeholder="ex : 1:52.345"
                  style={{
                    borderColor: lapDryError ? "var(--danger)" : undefined,
                  }}
                />
                {lapDryError && (
                  <span style={{ fontSize: "0.75rem", color: "var(--danger)" }}>
                    Format invalide — M:SS.mmm
                  </span>
                )}
              </div>
              <div className="form-group">
                <label>Conso (L/tour)</label>
                <input
                  type="number"
                  value={form.fuel_dry}
                  onChange={set("fuel_dry")}
                  placeholder="ex : 3.250"
                  min="0"
                  max="20"
                  step="0.001"
                />
              </div>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label>Réglages sec</label>
                <input
                  type="text"
                  value={form.setup_notes_dry}
                  onChange={set("setup_notes_dry")}
                  placeholder="ex : BB 52.5 — TC 3"
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
              💧 Pluie
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label>Chrono (MM:SS.mmm)</label>
                <input
                  type="text"
                  value={form.lap_time_wet}
                  onChange={(e) => {
                    set("lap_time_wet")(e);
                    setLapWetError(false);
                  }}
                  onBlur={makeLapBlur("lap_time_wet", setLapWetError)}
                  placeholder="ex : 2:05.123"
                  style={{
                    borderColor: lapWetError ? "var(--danger)" : undefined,
                  }}
                />
                {lapWetError && (
                  <span style={{ fontSize: "0.75rem", color: "var(--danger)" }}>
                    Format invalide — M:SS.mmm
                  </span>
                )}
              </div>
              <div className="form-group">
                <label>Conso (L/tour)</label>
                <input
                  type="number"
                  value={form.fuel_wet}
                  onChange={set("fuel_wet")}
                  placeholder="ex : 3.100"
                  min="0"
                  max="20"
                  step="0.001"
                />
              </div>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label>Réglages pluie</label>
                <input
                  type="text"
                  value={form.setup_notes_wet}
                  onChange={set("setup_notes_wet")}
                  placeholder="ex : BB 50.0 — TC 5"
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
            🌙 Nuit — données spécifiques (optionnel)
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
                🌙☀️ Nuit sec
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Chrono (MM:SS.mmm)</label>
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
                    placeholder="ex : 1:55.000"
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
                      Format invalide — M:SS.mmm
                    </span>
                  )}
                </div>
                <div className="form-group">
                  <label>Conso (L/tour)</label>
                  <input
                    type="number"
                    value={form.fuel_night_dry}
                    onChange={set("fuel_night_dry")}
                    placeholder="ex : 3.200"
                    min="0"
                    max="20"
                    step="0.001"
                  />
                </div>
                <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                  <label>Réglages nuit sec</label>
                  <input
                    type="text"
                    value={form.setup_notes_night_dry}
                    onChange={set("setup_notes_night_dry")}
                    placeholder="ex : BB 52.0 — TC 3"
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
                🌙💧 Nuit pluie
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Chrono (MM:SS.mmm)</label>
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
                    placeholder="ex : 2:10.000"
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
                      Format invalide — M:SS.mmm
                    </span>
                  )}
                </div>
                <div className="form-group">
                  <label>Conso (L/tour)</label>
                  <input
                    type="number"
                    value={form.fuel_night_wet}
                    onChange={set("fuel_night_wet")}
                    placeholder="ex : 3.050"
                    min="0"
                    max="20"
                    step="0.001"
                  />
                </div>
                <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                  <label>Réglages nuit pluie</label>
                  <input
                    type="text"
                    value={form.setup_notes_night_wet}
                    onChange={set("setup_notes_night_wet")}
                    placeholder="ex : BB 49.5 — TC 6"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            onClick={handleSave}
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? "Enregistrement…" : "✓ Enregistrer"}
          </button>
          <button onClick={handleCancel} className="btn btn-secondary">
            Annuler
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
}) {
  const [perfData, setPerfData] = useState({});
  const [loading, setLoading] = useState(true);
  const [nightDryAdd, setNightDryAdd] = useState(0);
  const [nightWetAdd, setNightWetAdd] = useState(0);
  const [nightSaving, setNightSaving] = useState(false);
  const [dayWetAdd, setDayWetAdd] = useState(0);

  useEffect(() => {
    if (!teamEntryId || assignedDrivers.length === 0) {
      setLoading(false);
      return;
    }
    Promise.all([
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
    ]).then(([{ data: perfRows }, { data: entry }]) => {
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
      setLoading(false);
    });
  }, [teamEntryId, assignedDrivers.length]);

  const handleSaved = (data) => {
    setPerfData((prev) => ({ ...prev, [data.driver_id]: data }));
  };

  // Auto-save modifier on blur — handles night dry, night wet, and day wet
  const saveModifier = async (field, value) => {
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
        <div className="empty">Aucun pilote assigné à cet équipage.</div>
      </div>
    );
  if (loading)
    return (
      <div className="card">
        <div className="empty">Chargement…</div>
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
            Modificateurs équipage (secondes)
          </div>
          <p
            style={{
              fontSize: "0.8rem",
              color: "var(--text-dim)",
              marginBottom: "0.75rem",
            }}
          >
            Appliqués en fallback quand le pilote n&apos;a pas de données
            spécifiques pour cette condition. Valeurs négatives autorisées. Les
            chronos affichés avec * utilisent ces modificateurs.
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
                💧 Pluie jour
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
                s
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
                🌙☀️ Nuit sec
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
                s
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
                🌙💧 Nuit pluie
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
                s
              </span>
            </div>

            {nightSaving && (
              <span style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>
                Enregistrement…
              </span>
            )}
          </div>
        </div>
      )}

      {/* Performance table */}
      <div className="table-wrap">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Pilote</th>
              <th style={thStyle}>Chrono ☀️</th>
              <th style={thStyle}>Chrono 💧</th>
              <th style={thStyle}>Conso ☀️</th>
              <th style={thStyle}>Conso 💧</th>
              <th style={thStyle}>Réglages ☀️</th>
              <th style={thStyle}>Réglages 💧</th>
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
              />
            ))}
          </tbody>
        </table>
      </div>
      {(dayWetAdd !== 0 || nightDryAdd !== 0 || nightWetAdd !== 0) && (
        <div
          style={{
            marginTop: "0.5rem",
            fontSize: "0.72rem",
            color: "var(--text-dim)",
          }}
        >
          * Chrono estimé via modificateur équipage (pas de données spécifiques
          pour ce pilote dans cette condition)
        </div>
      )}
    </div>
  );
}
