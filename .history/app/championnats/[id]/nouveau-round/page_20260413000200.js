"use client";
import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { TIMEZONES } from "../../../../lib/timezone";

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

export default function NouveauRound({ params }) {
  const router = useRouter();
  const { id } = use(params); // championship id
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  const [championship, setChampionship] = useState(null);
  const [circuits, setCircuits] = useState([]);
  const [pitTime, setPitTime] = useState(null);
  const [eventTypes, setEventTypes] = useState([]);
  const [durations, setDurations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [roundCount, setRoundCount] = useState(0);

  const [form, setForm] = useState({
    name: "",
    duration_minutes: "",
    circuit_id: "",
    format: "",
    ig_start_time: "",
    timezone: "Europe/Paris",
    ig_sunrise: "",
    ig_sunset: "",
    notes: "",
  });
  const [customH, setCustomH] = useState("");
  const [customM, setCustomM] = useState("");

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
      supabase.from("championships").select("*").eq("id", id).single(),
      supabase
        .from("circuits")
        .select("id, name, pit_lane_time_seconds")
        .order("name"),
      supabase.from("event_types").select("name").order("sort_order"),
      supabase.from("event_duration_presets").select("*").order("minutes"),
      // Fetch existing round count to auto-number the new round and pre-fill the name.
      supabase
        .from("events")
        .select("id", { count: "exact" })
        .eq("championship_id", id),
    ]).then(
      ([
        { data: champ },
        { data: circuitsData },
        { data: typesData },
        { data: durData },
        { count },
      ]) => {
        setChampionship(champ);
        setCircuits(circuitsData || []);
        setEventTypes(typesData?.map((t) => t.name) || []);
        setDurations(durData || []);
        setRoundCount(count || 0);
        // Pre-fill name with "Championship — Manche N" as a convenience default.
        // The user can override it before saving.
        setForm((prev) => ({
          ...prev,
          name: `${champ?.name || ""} — Manche ${(count || 0) + 1}`,
        }));
      },
    );
  }, [id]);

  useEffect(() => {
    if (!form.circuit_id) {
      setPitTime(null);
      return;
    }
    const c = circuits.find((c) => c.id === form.circuit_id);
    setPitTime(c ? c.pit_lane_time_seconds : null);
  }, [form.circuit_id, circuits]);

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

  const isPreset = durations.some((d) => d.minutes === form.duration_minutes);

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
      championship_id: id,
      // round_number = current count + 1 — sequential, not user-editable at creation time.
      round_number: roundCount + 1,
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
    router.push(`/evenements/${data.id}`);
    router.refresh();
  };

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
          <h1>Nouvelle manche</h1>
          <div className="accent-line" />
          {championship && (
            <div
              style={{
                marginTop: "0.4rem",
                color: "var(--text-dim)",
                fontSize: "0.85rem",
              }}
            >
              {championship.name}
              {championship.season && ` — ${championship.season}`}
            </div>
          )}
        </div>
        <Link href="/evenements" className="btn btn-secondary">
          ← Retour
        </Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderRadius: "3px",
          padding: "0.75rem 1rem",
          marginBottom: "1.5rem",
          fontSize: "0.85rem",
          color: "var(--text-dim)",
        }}
      >
        💡 Les horaires IRL de départ se configurent après création de la
        manche.
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <h3 style={{ marginBottom: "1.25rem", color: "var(--text-dim)" }}>
            Informations générales
          </h3>
          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="name">Nom de la manche *</label>
              <input
                id="name"
                type="text"
                value={form.name}
                onChange={set("name")}
                required
              />
            </div>
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
                placeholder="Infos complémentaires…"
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
                <option value="">— Sélectionner un circuit —</option>
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

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Enregistrement…" : "✓ Créer la manche"}
          </button>
          <Link href="/evenements" className="btn btn-secondary">
            Annuler
          </Link>
        </div>
      </form>
    </div>
  );
}
