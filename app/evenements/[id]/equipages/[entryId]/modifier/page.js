"use client";
import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser as supabase } from "../../../../../../lib/supabase-browser";
import { formatTimeInZone } from "../../../../../../lib/timezone";

// Extract a Twitch username from a full twitch.tv URL
function extractTwitchUsername(url) {
  if (!url) return "";
  const match = url.match(/twitch\.tv\/([a-zA-Z0-9_]+)/i);
  return match ? match[1].toLowerCase() : url.toLowerCase();
}

export default function ModifierEquipage({ params }) {
  const [eventTimezone, setEventTimezone] = useState("Europe/Paris");
  const router = useRouter();
  const { id, entryId } = use(params);

  const [form, setForm] = useState(null);
  const [cars, setCars] = useState([]);
  const [startTimes, setStartTimes] = useState([]);
  const [selectedCar, setSelectedCar] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState(null);
  const [crewNames, setCrewNames] = useState([]);
  const [currentIsAdmin, setCurrentIsAdmin] = useState(false);

  // Multiple Twitch streams — stored as array of raw usernames
  const [twitchUsernames, setTwitchUsernames] = useState([]);
  const [twitchInput, setTwitchInput] = useState("");
  // Drivers in this event who have a linked Twitch account — offered as quick-pick
  const [twitchDrivers, setTwitchDrivers] = useState([]);

  // Auth check — sets currentIsAdmin to control delete button visibility
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
      if (!driver) {
        router.push("/");
        return;
      }
      setCurrentIsAdmin(
        driver.role === "admin" || driver.role === "super_admin",
      );
    });
  }, []);

  useEffect(() => {
    Promise.all([
      supabase.from("cars").select("*").order("class").order("name"),
      supabase.from("team_entries").select("*").eq("id", entryId).single(),
      supabase.from("crew_names").select("name").order("sort_order"),
    ]).then(
      async ([
        { data: carsData },
        { data: entry, error: entryError },
        { data: crewData },
      ]) => {
        if (entryError || !entry) {
          setError("Voiture introuvable.");
          setFetching(false);
          return;
        }

        let filteredCars = carsData || [];
        const { data: evData } = await supabase
          .from("events")
          .select("format, timezone, archived")
          .eq("id", entry.event_id)
          .single();

        // Archived events cannot be modified — redirect to equipage detail
        if (evData?.archived) {
          router.push(`/evenements/${id}/equipages/${entryId}`);
          return;
        }

        // Filter cars by event type — same logic as nouveau/page.js
        if (evData?.format) {
          const { data: eventType } = await supabase
            .from("event_types")
            .select("id")
            .eq("name", evData.format)
            .single();
          if (eventType) {
            const { data: allowedCars } = await supabase
              .from("event_type_cars")
              .select("car_id")
              .eq("event_type_id", eventType.id);
            if (allowedCars && allowedCars.length > 0) {
              const allowedIds = allowedCars.map((ac) => ac.car_id);
              filteredCars = filteredCars.filter((c) =>
                allowedIds.includes(c.id),
              );
            }
          }
        }
        setEventTimezone(evData?.timezone || "Europe/Paris");
        setCars(filteredCars);
        setCrewNames(
          crewData?.map((c) => c.name).sort((a, b) => a.localeCompare(b)) || [],
        );

        // Only fetch drivers assigned to this team entry for Twitch quick-pick
        const { data: signupsData } = await supabase
          .from("signups")
          .select("drivers(id, name, twitch)")
          .eq("team_entry_id", entryId);

        const seen = new Set();
        const withTwitch = (signupsData || [])
          .map((s) => s.drivers)
          .filter((d) => d && d.twitch && !seen.has(d.id) && seen.add(d.id))
          .sort((a, b) => a.name.localeCompare(b.name));
        setTwitchDrivers(withTwitch);

        supabase
          .from("event_start_times")
          .select("*")
          .eq("event_id", entry.event_id)
          .order("irl_start")
          .then(({ data: stData }) => setStartTimes(stData || []));

        // Pre-fill Twitch usernames from stream_urls array
        const existingUrls = entry.stream_urls || [];
        setTwitchUsernames(
          existingUrls.map(extractTwitchUsername).filter(Boolean),
        );

        setForm({
          crew_name: entry.crew_name ?? "",
          car_id: entry.car_id ?? "",
          class: entry.class ?? "",
          start_time_id: entry.start_time_id ?? "",
          bop_power_percent: entry.bop_power_percent ?? "100",
          bop_weight_kg: entry.bop_weight_kg ?? "0",
          bop_tank_size_percent: entry.bop_tank_size_percent ?? "",
          refuel_time_seconds: entry.refuel_time_seconds ?? "30",
          tyre_change_time_seconds: entry.tyre_change_time_seconds ?? "0",
          notification_minutes_before: entry.notification_minutes_before ?? "5",
        });
        setFetching(false);
      },
    );
  }, [entryId]);

  useEffect(() => {
    if (!form?.car_id || cars.length === 0) {
      setSelectedCar(null);
      return;
    }
    const car = cars.find((c) => c.id === form.car_id);
    if (car) {
      setSelectedCar(car);
      setForm((prev) => ({ ...prev, class: car.class || "" }));
    } else setSelectedCar(null);
  }, [form?.car_id, cars]);

  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const addTwitchUsername = (username) => {
    const clean = username.trim().toLowerCase();
    if (!clean) return;
    setTwitchUsernames((prev) =>
      prev.includes(clean) ? prev : [...prev, clean],
    );
    setTwitchInput("");
  };

  const toggleTwitchDriver = (username) => {
    const clean = username.trim().toLowerCase();
    setTwitchUsernames((prev) =>
      prev.includes(clean) ? prev.filter((u) => u !== clean) : [...prev, clean],
    );
  };

  const removeTwitchUsername = (username) => {
    setTwitchUsernames((prev) => prev.filter((u) => u !== username));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.crew_name) {
      setError("Le nom d'équipage est obligatoire.");
      return;
    }
    if (!form.class) {
      setError("La classe est obligatoire.");
      return;
    }
    if (!form.start_time_id) {
      setError("L'horaire de départ est obligatoire.");
      return;
    }

    setLoading(true);
    setError(null);

    const streamUrls = twitchUsernames.map((u) => `https://twitch.tv/${u}`);

    const payload = {
      crew_name: form.crew_name,
      car_id: form.car_id || null,
      class: form.class || null,
      start_time_id: form.start_time_id,
      stream_urls: streamUrls,
      bop_power_percent: parseFloat(form.bop_power_percent) || 100,
      bop_weight_kg: parseFloat(form.bop_weight_kg) || 0,
      bop_tank_size_percent: form.bop_tank_size_percent
        ? parseFloat(form.bop_tank_size_percent)
        : null,
      refuel_time_seconds: parseInt(form.refuel_time_seconds) || 30,
      tyre_change_time_seconds: parseInt(form.tyre_change_time_seconds) || 0,
      // Minutes before stint end to trigger Discord handoff alert (null = disabled)
      notification_minutes_before: form.notification_minutes_before
        ? parseInt(form.notification_minutes_before)
        : null,
    };

    const { error: err } = await supabase
      .from("team_entries")
      .update(payload)
      .eq("id", entryId);

    if (err) {
      setError(
        err.code === "23505"
          ? "Cet équipage est déjà inscrit pour ce créneau de départ."
          : err.message,
      );
      setLoading(false);
    } else {
      router.push(`/evenements/${id}/equipages/${entryId}`);
      router.refresh();
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        "Supprimer cet équipage ? Toutes les données associées (relais, disponibilités) seront supprimées.",
      )
    )
      return;
    const { error: err } = await supabase
      .from("team_entries")
      .delete()
      .eq("id", entryId);
    if (err) {
      setError(err.message);
      return;
    }
    router.push(`/evenements/${id}`);
    router.refresh();
  };

  const carsByClass = cars.reduce((acc, car) => {
    if (!acc[car.class]) acc[car.class] = [];
    acc[car.class].push(car);
    return acc;
  }, {});

  const availableClasses = [...new Set(cars.map((c) => c.class))]
    .filter(Boolean)
    .sort();

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
        <Link href={`/evenements/${id}`} className="btn btn-secondary">
          ← Retour
        </Link>
      </div>
    );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Modifier l&apos;équipage</h1>
          <div className="accent-line" />
        </div>
        <Link
          href={`/evenements/${id}/equipages/${entryId}`}
          className="btn btn-secondary"
        >
          ← Retour
        </Link>
      </div>

      <form onSubmit={handleSubmit}>
        {/* ── Équipage & voiture ── */}
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <h3 style={{ marginBottom: "1.25rem", color: "var(--text-dim)" }}>
            Équipage &amp; voiture
          </h3>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="crew_name">Nom d&apos;équipage *</label>
              <select
                id="crew_name"
                value={form.crew_name}
                onChange={set("crew_name")}
                required
              >
                <option value="">— Sélectionner —</option>
                {crewNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="car_id">Voiture *</label>
              <select id="car_id" value={form.car_id} onChange={set("car_id")}>
                <option value="">— Sélectionner —</option>
                {Object.entries(carsByClass).map(([cls, carsInClass]) => (
                  <optgroup key={cls} label={cls}>
                    {carsInClass.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {selectedCar && (
              <div className="form-group">
                <label>Réservoir (auto-rempli)</label>
                <div
                  style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: "3px",
                    padding: "0.55rem 0.75rem",
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: "0.9rem",
                    color: "var(--accent)",
                  }}
                >
                  {selectedCar.tank_size_litres}L
                </div>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="class">Classe *</label>
              {selectedCar ? (
                <div
                  style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: "3px",
                    padding: "0.55rem 0.75rem",
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: "0.9rem",
                    color: "var(--accent)",
                  }}
                >
                  {form.class || "—"}
                </div>
              ) : (
                <select
                  id="class"
                  value={form.class}
                  onChange={set("class")}
                  required
                >
                  <option value="">— Sélectionner —</option>
                  {availableClasses.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* ── Horaire de départ ── */}
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <h3 style={{ marginBottom: "1.25rem", color: "var(--text-dim)" }}>
            Horaire de départ *
          </h3>
          {startTimes.length === 0 ? (
            <p style={{ color: "var(--text-dim)", fontSize: "0.9rem" }}>
              Aucun créneau disponible.
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              {startTimes.map((st) => (
                <label
                  key={st.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.75rem 1rem",
                    background:
                      form.start_time_id === st.id
                        ? "var(--accent-dim)"
                        : "var(--surface-2)",
                    border: "1px solid",
                    borderColor:
                      form.start_time_id === st.id
                        ? "var(--accent)"
                        : "var(--border)",
                    borderRadius: "3px",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  <input
                    type="radio"
                    name="start_time_id"
                    value={st.id}
                    checked={form.start_time_id === st.id}
                    onChange={set("start_time_id")}
                    style={{ accentColor: "var(--accent)" }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                      {st.label}
                    </div>
                    <div
                      className="mono"
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--accent)",
                        marginTop: "0.1rem",
                      }}
                    >
                      Départ à {formatTimeInZone(st.irl_start, eventTimezone)}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* ── Twitch streams ── */}
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <h3 style={{ marginBottom: "1.25rem", color: "var(--text-dim)" }}>
            Streams Twitch
          </h3>

          {/* Added streams as removable pills */}
          {twitchUsernames.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                flexWrap: "wrap",
                marginBottom: "0.75rem",
              }}
            >
              {twitchUsernames.map((u) => (
                <div
                  key={u}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    padding: "0.25rem 0.5rem 0.25rem 0.75rem",
                    borderRadius: "3px",
                    background: "rgba(145,71,255,0.12)",
                    border: "1px solid #9147ff",
                  }}
                >
                  <a
                    href={`https://twitch.tv/${u}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "#9147ff",
                      fontSize: "0.82rem",
                      fontWeight: 600,
                    }}
                  >
                    {u}
                  </a>
                  <button
                    type="button"
                    onClick={() => removeTwitchUsername(u)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#9147ff",
                      cursor: "pointer",
                      fontSize: "0.9rem",
                      padding: 0,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Quick-pick from team drivers with linked Twitch */}
          {twitchDrivers.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                flexWrap: "wrap",
                marginBottom: "0.5rem",
              }}
            >
              {twitchDrivers.map((d) => {
                const selected = twitchUsernames.includes(
                  d.twitch.toLowerCase(),
                );
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleTwitchDriver(d.twitch)}
                    style={{
                      padding: "0.3rem 0.75rem",
                      borderRadius: "3px",
                      border: `1px solid ${selected ? "#9147ff" : "var(--border)"}`,
                      background: selected
                        ? "rgba(145,71,255,0.12)"
                        : "var(--surface-2)",
                      color: selected ? "#9147ff" : "var(--text-dim)",
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {selected ? "✓ " : ""}
                    {d.name} ({d.twitch})
                  </button>
                );
              })}
            </div>
          )}

          {/* Manual username entry */}
          <div style={{ display: "flex", alignItems: "stretch", gap: 0 }}>
            <span
              style={{
                padding: "0.55rem 0.6rem",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRight: "none",
                borderRadius: "3px 0 0 3px",
                fontSize: "0.85rem",
                color: "var(--text-dim)",
                whiteSpace: "nowrap",
                fontFamily: "var(--font-mono), monospace",
              }}
            >
              twitch.tv/
            </span>
            <input
              type="text"
              value={twitchInput}
              onChange={(e) =>
                setTwitchInput(e.target.value.replace(/\s/g, "").toLowerCase())
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTwitchUsername(twitchInput);
                }
              }}
              placeholder="nom_de_chaine"
              style={{
                borderRadius: 0,
                flex: 1,
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderLeft: "none",
                color: "var(--text)",
                padding: "0.55rem 0.75rem",
                fontFamily: "inherit",
                fontSize: "0.9rem",
              }}
            />
            <button
              type="button"
              onClick={() => addTwitchUsername(twitchInput)}
              className="btn btn-secondary"
              style={{
                borderRadius: "0 3px 3px 0",
                borderLeft: "none",
                whiteSpace: "nowrap",
              }}
            >
              + Ajouter
            </button>
          </div>
        </div>

        {/* ── Paramètres stratégie ── */}
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <h3 style={{ marginBottom: "1.25rem", color: "var(--text-dim)" }}>
            Paramètres stratégie
          </h3>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="bop_power_percent">BOP Puissance (%)</label>
              <input
                id="bop_power_percent"
                type="number"
                value={form.bop_power_percent}
                onChange={set("bop_power_percent")}
                min="50"
                max="150"
                step="0.1"
              />
            </div>
            <div className="form-group">
              <label htmlFor="bop_weight_kg">BOP Poids (kg)</label>
              <input
                id="bop_weight_kg"
                type="number"
                value={form.bop_weight_kg}
                onChange={set("bop_weight_kg")}
                min="-100"
                max="200"
                step="0.5"
              />
            </div>
            <div className="form-group">
              <label htmlFor="bop_tank_size_percent">BOP Réservoir (%)</label>
              <input
                id="bop_tank_size_percent"
                type="number"
                value={form.bop_tank_size_percent}
                onChange={set("bop_tank_size_percent")}
                min="50"
                max="150"
                step="0.1"
                placeholder="100"
              />
            </div>
            <div className="form-group">
              <label htmlFor="refuel_time_seconds">
                Temps ravitaillement (sec)
              </label>
              <input
                id="refuel_time_seconds"
                type="number"
                value={form.refuel_time_seconds}
                onChange={set("refuel_time_seconds")}
                min="0"
                max="300"
              />
            </div>
            <div className="form-group">
              <label htmlFor="tyre_change_time_seconds">
                Temps changement pneus (sec)
              </label>
              <input
                id="tyre_change_time_seconds"
                type="number"
                value={form.tyre_change_time_seconds}
                onChange={set("tyre_change_time_seconds")}
                min="0"
                max="300"
              />
            </div>
            {/* ── Alerte relais Discord ── */}
            <div className="form-group">
              <label htmlFor="notification_minutes_before">
                Alerte relais Discord (min)
              </label>
              <input
                id="notification_minutes_before"
                type="number"
                value={form.notification_minutes_before}
                onChange={set("notification_minutes_before")}
                min="1"
                max="60"
                placeholder="5"
              />
              {/* Helper text — shown below the input */}
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-dim)",
                  marginTop: "0.3rem",
                }}
              >
                Le bot Discord alertera X minutes avant la fin de chaque relais.
                Laisser vide pour désactiver.
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
            {error}
          </div>
        )}
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
            <Link
              href={`/evenements/${id}/equipages/${entryId}`}
              className="btn btn-secondary"
            >
              Annuler
            </Link>
          </div>
          {currentIsAdmin && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleDelete}
            >
              Supprimer l&apos;équipage
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
