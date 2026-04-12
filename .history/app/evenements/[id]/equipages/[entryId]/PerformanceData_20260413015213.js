"use client";
import { useState, useEffect } from "react";
import { supabaseBrowser as supabase } from '../../../../../lib/supabase-browser'

// ── Lap time helpers ───────────────────────────────────────

// Seconds → display format "M:SS.mmm" for lap time inputs
function secToDisplay(sec) {
  if (!sec && sec !== 0) return "";
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(3).padStart(6, "0");
  return `${m}:${s}`;
}

// Parse "M:SS.mmm" back to seconds — returns null if format is invalid.
// Validates on blur so the user can type freely without instant errors.
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

// ── Row component ──────────────────────────────────────────

function DriverRow({ signup, initialData, teamEntryId, onSaved }) {
  const driver = signup.drivers;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [lapDryError, setLapDryError] = useState(false);
  const [lapWetError, setLapWetError] = useState(false);

  const toForm = (data) => ({
    lap_time_dry: secToDisplay(data?.lap_time_dry),
    lap_time_wet: secToDisplay(data?.lap_time_wet),
    fuel_dry: data?.fuel_dry != null ? String(data.fuel_dry) : "",
    fuel_wet: data?.fuel_wet != null ? String(data.fuel_wet) : "",
    setup_notes_dry: data?.setup_notes_dry || "",
    setup_notes_wet: data?.setup_notes_wet || "",
  });

  const [form, setForm] = useState(toForm(initialData));

  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSave = async () => {
    // Validate lap times if filled in
    if (form.lap_time_dry.trim() && displayToSec(form.lap_time_dry) === null) {
      setLapDryError(true);
      return;
    }
    if (form.lap_time_wet.trim() && displayToSec(form.lap_time_wet) === null) {
      setLapWetError(true);
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
      updated_at: new Date().toISOString(),
    };

    // Upsert by team_entry_id + driver_id — creates or updates the performance row.
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
  };

  const hasData =
    initialData &&
    (initialData.lap_time_dry ||
      initialData.lap_time_wet ||
      initialData.fuel_dry ||
      initialData.fuel_wet);

  if (!editing) {
    return (
      <tr>
        <td style={{ fontWeight: 600, padding: "0.6rem 1rem" }}>
          {driver?.name || "—"}
        </td>
        <td style={tdStyle}>
          <span
            className="mono"
            style={{ color: hasData ? "var(--text)" : "var(--text-dim)" }}
          >
            {secToDisplay(initialData?.lap_time_dry) || "—"}
          </span>
        </td>
        <td style={tdStyle}>
          <span
            className="mono"
            style={{ color: hasData ? "var(--text)" : "var(--text-dim)" }}
          >
            {secToDisplay(initialData?.lap_time_wet) || "—"}
          </span>
        </td>
        <td style={tdStyle}>
          <span
            className="mono"
            style={{ color: hasData ? "var(--accent)" : "var(--text-dim)" }}
          >
            {initialData?.fuel_dry != null ? `${initialData.fuel_dry}L` : "—"}
          </span>
        </td>
        <td style={tdStyle}>
          <span
            className="mono"
            style={{ color: hasData ? "var(--accent)" : "var(--text-dim)" }}
          >
            {initialData?.fuel_wet != null ? `${initialData.fuel_wet}L` : "—"}
          </span>
        </td>
        <td
          style={{
            ...tdStyle,
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
            fontSize: "0.8rem",
            color: "var(--text-dim)",
            maxWidth: "180px",
          }}
        >
          {initialData?.setup_notes_wet || "—"}
        </td>
        <td style={tdStyle}>
          <button
            onClick={() => setEditing(true)}
            className="btn btn-secondary btn-sm"
          >
            Modifier
          </button>
        </td>
      </tr>
    );
  }

  // Edit mode — expanded row
  return (
    <>
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

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1.25rem",
              marginBottom: "1.25rem",
            }}
          >
            {/* Dry */}
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
                    onBlur={() => {
                      if (!form.lap_time_dry.trim()) {
                        setLapDryError(false);
                        return;
                      }
                      const sec = displayToSec(form.lap_time_dry);
                      if (sec !== null) {
                        setForm((prev) => ({
                          ...prev,
                          lap_time_dry: secToDisplay(sec),
                        }));
                        setLapDryError(false);
                      } else {
                        setLapDryError(true);
                      }
                    }}
                    placeholder="ex : 1:52.345"
                    style={{
                      borderColor: lapDryError ? "var(--danger)" : undefined,
                    }}
                  />
                  {lapDryError && (
                    <span
                      style={{ fontSize: "0.75rem", color: "var(--danger)" }}
                    >
                      Format invalide — utilisez M:SS.mmm (ex : 1:52.345)
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
                  <label>Réglages (informatif)</label>
                  <input
                    type="text"
                    value={form.setup_notes_dry}
                    onChange={set("setup_notes_dry")}
                    placeholder="ex : BB 52.5 — TC 3 — ABS 2 — Aile 7"
                  />
                </div>
              </div>
            </div>

            {/* Wet */}
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
                    onBlur={() => {
                      if (!form.lap_time_wet.trim()) {
                        setLapWetError(false);
                        return;
                      }
                      const sec = displayToSec(form.lap_time_wet);
                      if (sec !== null) {
                        setForm((prev) => ({
                          ...prev,
                          lap_time_wet: secToDisplay(sec),
                        }));
                        setLapWetError(false);
                      } else {
                        setLapWetError(true);
                      }
                    }}
                    placeholder="ex : 2:05.123"
                    style={{
                      borderColor: lapWetError ? "var(--danger)" : undefined,
                    }}
                  />
                  {lapWetError && (
                    <span
                      style={{ fontSize: "0.75rem", color: "var(--danger)" }}
                    >
                      Format invalide — utilisez M:SS.mmm (ex : 2:05.123)
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
                  <label>Réglages pluie (informatif)</label>
                  <input
                    type="text"
                    value={form.setup_notes_wet}
                    onChange={set("setup_notes_wet")}
                    placeholder="ex : BB 50.0 — TC 5 — ABS 4 — Aile 9"
                  />
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
    </>
  );
}

const tdStyle = {
  padding: "0.6rem 1rem",
};

// ── Main component ─────────────────────────────────────────

export default function PerformanceData({ teamEntryId, assignedDrivers }) {
  const [perfData, setPerfData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamEntryId || assignedDrivers.length === 0) {
      setLoading(false);
      return;
    }
    supabase
      .from("driver_performance")
      .select("*")
      .eq("team_entry_id", teamEntryId)
      .then(({ data }) => {
        // Build driver_id → performance data map for O(1) lookup per row
        const map = {};
        (data || []).forEach((d) => {
          map[d.driver_id] = d;
        });
        setPerfData(map);
        setLoading(false);
      });
  }, [teamEntryId, assignedDrivers.length]);

  const handleSaved = (data) => {
    setPerfData((prev) => ({ ...prev, [data.driver_id]: data }));
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
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
