"use client";
import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser as supabase } from "../../../../lib/supabase-browser";
import { TIMEZONES } from "../../../../lib/timezone";

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

export default function ModifierEvenement({ params }) {
  const router = useRouter();
  const { id } = use(params);
  const [eventTypes, setEventTypes] = useState([]);
  const [durations, setDurations] = useState([]);
  const [isSpecial, setIsSpecial] = useState(false);
  const [weekendStartDate, setWeekendStartDate] = useState("");

  const [form, setForm] = useState(null);
  const [circuits, setCircuits] = useState([]);
  const [pitTime, setPitTime] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState(null);
  const [customH, setCustomH] = useState("");
  const [customM, setCustomM] = useState("");
  const [authChecked, setAuthChecked] = useState(false);
  const [showRegenModal, setShowRegenModal] = useState(false);

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
    Promise.all([
      supabase
        .from("circuits")
        .select("id, name, pit_lane_time_seconds")
        .order("name"),
      supabase.from("events").select("*").eq("id", id).single(),
    ]).then(([{ data: circuitsData }, { data: event, error: eventError }]) => {
      setCircuits(circuitsData || []);
      if (eventError || !event) {
        setError("Événement introuvable.");
        setFetching(false);
        return;
      }

      // Pre-fill the custom h/m inputs if the saved duration doesn't match any preset.
      // This ensures the custom fields show the current value when editing.
      const mins = event.duration_minutes || 0;
      if (mins && !durations.some((d) => d.minutes === mins)) {
        setCustomH(String(Math.floor(mins / 60)));
        setCustomM(String(mins % 60));
      }

      setForm({
        name: event.name || "",
        duration_minutes: event.duration_minutes ?? "",
        circuit_id: event.circuit_id || "",
        format: event.format || "",
        ig_start_time: event.ig_start_time || "",
        timezone: event.timezone || "Europe/Paris",
        ig_sunrise: event.ig_sunrise || "",
        ig_sunset: event.ig_sunset || "",
        notes: event.notes || "",
      });
      setIsSpecial(event.is_special || false);
      setWeekendStartDate(event.weekend_start_date || "");
      setFetching(false);
    });
  }, [id]);

  useEffect(() => {
    if (!form?.circuit_id) {
      setPitTime(null);
      return;
    }
    const c = circuits.find((c) => c.id === form.circuit_id);
    setPitTime(c ? c.pit_lane_time_seconds : null);
  }, [form?.circuit_id, circuits]);

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

  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const setDuration = (value) => {
    setCustomH("");
    setCustomM("");
    setForm((prev) => ({ ...prev, duration_minutes: value }));
  };

  const handleCustomHM = (h, m) => {
    const total = (parseInt(h) || 0) * 60 + (parseInt(m) || 0);
    setForm((prev) => ({ ...prev, duration_minutes: total || "" }));
  };

  const isPreset = form
    ? durations.some((d) => d.minutes === form.duration_minutes)
    : false;

  const handleSubmit = async (e) => {
    e.preventDefault();
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

    const { error: err } = await supabase
      .from("events")
      .update(payload)
      .eq("id", id);

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    // If special event with a weekend date, show modal to ask about regenerating start times
    if (isSpecial && weekendStartDate) {
      setLoading(false);
      setShowRegenModal(true);
      return;
    }

    router.push(`/evenements/${id}`);
    router.refresh();
  };

  const handleRegen = async () => {
    setShowRegenModal(false);
    setLoading(true);
    const { data: specialStartTimes } = await supabase
      .from("special_event_start_times")
      .select("*")
      .order("day_of_week")
      .order("hour")
      .order("minute");

    if (specialStartTimes?.length > 0) {
      // Null out start_time_id on team entries first (FK constraint)
      await supabase
        .from("team_entries")
        .update({ start_time_id: null })
        .eq("event_id", id);
      const { error: deleteErr } = await supabase
        .from("event_start_times")
        .delete()
        .eq("event_id", id);
      if (deleteErr) {
        setError(`Erreur suppression horaires: ${deleteErr.message}`);
        setLoading(false);
        return;
      }

      // Label is auto-generated from day + time — no free text input.
      const { DateTime } = await import("luxon");
      const friday = DateTime.fromISO(weekendStartDate, {
        zone: form.timezone,
      });
      const startTimeRows = specialStartTimes.map((st) => {
        const dayOffset =
          { vendredi: 0, samedi: 1, dimanche: 2 }[st.day_of_week] || 0;
        const dt = friday
          .plus({ days: dayOffset })
          .set({ hour: st.hour, minute: st.minute, second: 0, millisecond: 0 });
        return {
          event_id: id,
          label: `${st.day_of_week.charAt(0).toUpperCase() + st.day_of_week.slice(1)} ${dt.toFormat("d MMMM yyyy", { locale: "fr" })}`,
          irl_start: dt.toUTC().toISO(),
        };
      });
      await supabase.from("event_start_times").insert(startTimeRows);
    }
    setLoading(false);
    router.push(`/evenements/${id}`);
    router.refresh();
  };

  // Hard delete — removes the event and all associated data permanently.
  // Distinct from archiving which preserves the data with a snapshot.
  const handleDelete = async () => {
    if (
      !confirm(
        "Supprimer cet événement ? Toutes les données associées seront supprimées.",
      )
    )
      return;
    const { error: err } = await supabase.from("events").delete().eq("id", id);
    if (err) {
      setError(err.message);
      return;
    }
    router.push("/evenements");
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

  if (fetching)
    return (
      <div className="page">
        <p style={{ color: "var(--text-dim)" }}>Chargement…</p>
      </div>
    );
  if (!form)
    return (
      <div className="page">
        <div className="alert alert-error">{error}</div>
        <Link href="/evenements" className="btn btn-secondary">
          ← Retour
        </Link>
      </div>
    );

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
          <h1>Modifier l&apos;événement</h1>
          <div className="accent-line" />
        </div>
        <Link href={`/evenements/${id}`} className="btn btn-secondary">
          ← Retour
        </Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <h3 style={{ marginBottom: "1.25rem", color: "var(--text-dim)" }}>
            Informations générales
          </h3>
          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="name">Nom *</label>
              <input
                id="name"
                type="text"
                value={form.name}
                onChange={set("name")}
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
              />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <h3 style={{ marginBottom: "1.25rem", color: "var(--text-dim)" }}>
            Circuit
          </h3>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="circuit_id">Circuit *</label>
              <select
                id="circuit_id"
                value={form.circuit_id}
                onChange={set("circuit_id")}
                required
              >
                <option value="">— Sélectionner —</option>
                {circuits.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
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
            Les horaires IRL se gèrent depuis la page de l&apos;événement.
            Heures en format 24h.
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

        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? "Enregistrement…" : "✓ Enregistrer"}
            </button>
            <Link href={`/evenements/${id}`} className="btn btn-secondary">
              Annuler
            </Link>
          </div>
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleDelete}
          >
            Supprimer l&apos;événement
          </button>
        </div>
      </form>
      {showRegenModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1.5rem",
          }}
        >
          <div className="card" style={{ maxWidth: "480px", width: "100%" }}>
            <h3 style={{ marginBottom: "0.75rem" }}>Horaires de départ</h3>
            <p
              style={{
                fontSize: "0.9rem",
                color: "var(--text-dim)",
                marginBottom: "1.5rem",
              }}
            >
              Souhaitez-vous régénérer les horaires de départ à partir des
              horaires prédéfinis ? Les horaires existants seront supprimés.
            </p>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <button onClick={handleRegen} className="btn btn-primary">
                Enregistrer et régénérer les horaires
              </button>
              <button
                onClick={() => {
                  setShowRegenModal(false);
                  router.push(`/evenements/${id}`);
                  router.refresh();
                }}
                className="btn btn-secondary"
              >
                Enregistrer sans régénérer
              </button>
              <button
                onClick={() => setShowRegenModal(false)}
                className="btn btn-danger btn-sm"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
