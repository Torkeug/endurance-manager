"use client";
import { useState, useEffect, use, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser as supabase } from "../../../../lib/supabase-browser";
import { formatTimeInZone } from "../../../../lib/timezone";
import { useRouter } from "next/navigation";

function ConfirmModal({ modal, onConfirm, onCancel }) {
  if (!modal) return null;
  return (
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
      <div className="card" style={{ maxWidth: "400px", width: "100%" }}>
        <h3 style={{ marginBottom: "0.75rem" }}>{modal.title}</h3>
        <p
          style={{
            fontSize: "0.9rem",
            color: "var(--text-dim)",
            marginBottom: "1.5rem",
          }}
        >
          {modal.message}
        </p>
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
        >
          <button onClick={onConfirm} className="btn btn-danger">
            {modal.confirmLabel || "Confirmer"}
          </button>
          <button onClick={onCancel} className="btn btn-secondary">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}

// hard = class mismatch (red), soft = car mismatch within matching class (amber)
function MismatchWarning({ message, hard = false }) {
  return (
    <div
      style={{
        marginTop: "0.75rem",
        padding: "0.65rem 0.9rem",
        background: hard ? "rgba(224,85,85,0.08)" : "#2a1a00",
        border: `1px solid ${hard ? "var(--danger)" : "#a06020"}`,
        borderRadius: "3px",
        fontSize: "0.82rem",
        color: hard ? "var(--danger)" : "#d4904a",
        display: "flex",
        gap: "0.5rem",
        alignItems: "flex-start",
      }}
    >
      <span>⚠️</span>
      <span>{message}</span>
    </div>
  );
}

function CarCheckbox({ car, checked, onChange }) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.6rem 0.85rem",
        background: checked ? "var(--accent-dim)" : "var(--surface-2)",
        border: "1px solid",
        borderColor: checked ? "var(--accent)" : "var(--border)",
        borderRadius: "3px",
        cursor: "pointer",
        transition: "all 0.15s",
        minWidth: "200px",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        style={{
          accentColor: "var(--accent)",
          width: "15px",
          height: "15px",
          flexShrink: 0,
        }}
      />
      <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>{car.name}</span>
    </label>
  );
}

function ClassCheckbox({ cls, checked, onChange }) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.6rem",
        padding: "0.6rem 0.85rem",
        background: checked ? "var(--accent-dim)" : "var(--surface-2)",
        border: "1px solid",
        borderColor: checked ? "var(--accent)" : "var(--border)",
        borderRadius: "3px",
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        style={{ accentColor: "var(--accent)", width: "15px", height: "15px" }}
      />
      <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{cls}</span>
    </label>
  );
}

function SignupForm({
  signup,
  carEntries,
  cars,
  startTimes,
  eventTimezone,
  eventId,
  driverId,
  onSaved,
  onCancel,
  onDelete,
}) {
  const [preferredClasses, setPreferredClasses] = useState(
    signup?.preferred_class || [],
  );
  const [preferredCarIds, setPreferredCarIds] = useState(
    signup?.preferred_car_ids || [],
  );
  const [preferredStartTimeIds, setPreferredStartTimeIds] = useState(
    signup?.preferred_start_time_ids || [],
  );
  const [carEntryId, setCarEntryId] = useState(signup?.team_entry_id || "");
  const [notes, setNotes] = useState(signup?.notes || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);

  const toggleClass = (cls) =>
    setPreferredClasses((prev) =>
      prev.includes(cls) ? prev.filter((c) => c !== cls) : [...prev, cls],
    );
  const toggleCar = (cid) =>
    setPreferredCarIds((prev) =>
      prev.includes(cid) ? prev.filter((c) => c !== cid) : [...prev, cid],
    );
  const toggleST = (sid) =>
    setPreferredStartTimeIds((prev) =>
      prev.includes(sid) ? prev.filter((s) => s !== sid) : [...prev, sid],
    );

  // Returns an array of conflict descriptors matching the PreferenceBadge
  // severity logic used throughout the app.
  // Each conflict: { label, message, hard }
  const getMismatches = () => {
    if (!carEntryId) return [];
    const entry = carEntries.find((e) => e.id === carEntryId);
    if (!entry) return [];

    const entryClass = entry.class || entry.cars?.class;
    const entryCarId = entry.car_id;
    const entryCarName = entry.cars?.name || "?";
    const conflicts = [];

    // ── Class check (hard) ──────────────────────────────────────────────────
    const classConflict =
      preferredClasses.length > 0 &&
      entryClass &&
      !preferredClasses.includes(entryClass);
    if (classConflict) {
      conflicts.push({
        hard: true,
        message: `La classe de cette équipe (${entryClass}) ne correspond pas à vos préférences (${preferredClasses.join(", ")}).`,
      });
    }

    // ── Car check (soft — only when class matches) ──────────────────────────
    const carConflict =
      !classConflict &&
      preferredCarIds.length > 0 &&
      entryCarId &&
      !preferredCarIds.includes(entryCarId);
    if (carConflict) {
      const prefCarNames = preferredCarIds
        .map((cid) => cars.find((c) => c.id === cid)?.name)
        .filter(Boolean)
        .join(", ");
      conflicts.push({
        hard: false,
        message: `La voiture de cette équipe (${entryCarName}) ne correspond pas à vos préférences (${prefCarNames}). La classe correspond (${entryClass}).`,
      });
    }

    return conflicts;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const payload = {
      event_id: eventId,
      driver_id: driverId,
      preferred_class: preferredClasses.length > 0 ? preferredClasses : null,
      preferred_car_ids: preferredCarIds.length > 0 ? preferredCarIds : null,
      team_entry_id: carEntryId || null,
      preferred_start_time_ids:
        preferredStartTimeIds.length > 0 ? preferredStartTimeIds : null,
      notes: notes.trim() || null,
    };
    let err;
    if (signup?.id) {
      ({ error: err } = await supabase
        .from("signups")
        .update(payload)
        .eq("id", signup.id));
    } else {
      ({ error: err } = await supabase.from("signups").insert([payload]));
    }
    if (err) {
      if (err.code === "23505") {
        setError("Vous êtes déjà inscrit pour cette équipe.");
      } else {
        setError(err.message);
      }
      setLoading(false);
      return;
    }
    setLoading(false);
    onSaved();
  };

  const handleDelete = () => {
    if (!signup?.id) {
      onCancel();
      return;
    }
    setConfirmModal({
      title: "Se désinscrire",
      message: "Cette inscription sera supprimée définitivement.",
      confirmLabel: "Se désinscrire",
      onConfirm: async () => {
        setConfirmModal(null);
        const { error: err } = await supabase
          .from("signups")
          .delete()
          .eq("id", signup.id);
        if (err) {
          setError(err.message);
          return;
        }
        onDelete();
      },
    });
  };

  const carsByClass = cars.reduce((acc, car) => {
    if (!acc[car.class]) acc[car.class] = [];
    acc[car.class].push(car);
    return acc;
  }, {});

  const mismatches = getMismatches();

  return (
    <form onSubmit={handleSubmit}>
      <ConfirmModal
        modal={confirmModal}
        onConfirm={() => confirmModal?.onConfirm?.()}
        onCancel={() => setConfirmModal(null)}
      />
      {/* Preferred start times */}
      {startTimes.length > 0 && (
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <h3 style={{ marginBottom: "1rem", color: "var(--text-dim)" }}>
            Créneaux de départ préférés
          </h3>
          <p
            style={{
              fontSize: "0.8rem",
              color: "var(--text-dim)",
              marginBottom: "1rem",
            }}
          >
            Optionnel — cochez les créneaux auxquels vous souhaitez participer.
          </p>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
          >
            {startTimes.map((st) => (
              <label
                key={st.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.75rem 1rem",
                  background: preferredStartTimeIds.includes(st.id)
                    ? "var(--accent-dim)"
                    : "var(--surface-2)",
                  border: "1px solid",
                  borderColor: preferredStartTimeIds.includes(st.id)
                    ? "var(--accent)"
                    : "var(--border)",
                  borderRadius: "3px",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={preferredStartTimeIds.includes(st.id)}
                  onChange={() => toggleST(st.id)}
                  style={{ accentColor: "var(--accent)" }}
                />
                <div>
                  <div style={{ fontWeight: 600 }}>{st.label}</div>
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
        </div>
      )}

      {/* Team */}
      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <h3 style={{ marginBottom: "0.5rem", color: "var(--text-dim)" }}>
          Équipe
        </h3>
        <p
          style={{
            fontSize: "0.8rem",
            color: "var(--text-dim)",
            marginBottom: "1.25rem",
          }}
        >
          Optionnel — sélectionnez l&apos;équipe que vous souhaitez rejoindre.
        </p>
        {carEntries.length === 0 ? (
          <p style={{ color: "var(--text-dim)", fontSize: "0.9rem" }}>
            Aucune équipe engagée pour cet événement.
          </p>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.75rem 1rem",
                  background:
                    carEntryId === ""
                      ? "var(--accent-dim)"
                      : "var(--surface-2)",
                  border: "1px solid",
                  borderColor:
                    carEntryId === "" ? "var(--accent)" : "var(--border)",
                  borderRadius: "3px",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <input
                  type="radio"
                  name="team_entry_id"
                  value=""
                  checked={carEntryId === ""}
                  onChange={() => setCarEntryId("")}
                  style={{ accentColor: "var(--accent)" }}
                />
                <span style={{ color: "var(--text-dim)", fontSize: "0.9rem" }}>
                  Pas de préférence
                </span>
              </label>
              {carEntries.map((entry) => {
                const entryClass = entry.class || entry.cars?.class;
                const isSelected = carEntryId === entry.id;
                const st = startTimes.find((s) => s.id === entry.start_time_id);
                return (
                  <label
                    key={entry.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      padding: "0.75rem 1rem",
                      background: isSelected
                        ? "var(--accent-dim)"
                        : "var(--surface-2)",
                      border: "1px solid",
                      borderColor: isSelected
                        ? "var(--accent)"
                        : "var(--border)",
                      borderRadius: "3px",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    <input
                      type="radio"
                      name="team_entry_id"
                      value={entry.id}
                      checked={isSelected}
                      onChange={() => setCarEntryId(entry.id)}
                      style={{ accentColor: "var(--accent)" }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{entry.crew_name}</div>
                      <div
                        style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}
                      >
                        {entry.cars?.name || "—"}
                        {entryClass && ` · ${entryClass}`}
                      </div>
                      {st && (
                        <div
                          className="mono"
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--accent)",
                            marginTop: "0.15rem",
                          }}
                        >
                          {st.label} · Départ à{" "}
                          {formatTimeInZone(st.irl_start, eventTimezone)}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
            {mismatches.map((m, i) => (
              <MismatchWarning key={i} message={m.message} hard={m.hard} />
            ))}
          </>
        )}
      </div>

      {/* Preferred classes */}
      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <h3 style={{ marginBottom: "0.5rem", color: "var(--text-dim)" }}>
          Classes préférées
        </h3>
        <p
          style={{
            fontSize: "0.8rem",
            color: "var(--text-dim)",
            marginBottom: "1.25rem",
          }}
        >
          Optionnel — sélectionnez une ou plusieurs classes.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {[...new Set(cars.map((c) => c.class))]
            .filter(Boolean)
            .sort()
            .map((cls) => (
              <ClassCheckbox
                key={cls}
                cls={cls}
                checked={preferredClasses.includes(cls)}
                onChange={() => toggleClass(cls)}
              />
            ))}
        </div>
      </div>

      {/* Preferred cars */}
      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <h3 style={{ marginBottom: "0.5rem", color: "var(--text-dim)" }}>
          Voitures préférées
        </h3>
        <p
          style={{
            fontSize: "0.8rem",
            color: "var(--text-dim)",
            marginBottom: "1.25rem",
          }}
        >
          Optionnel — sélectionnez une ou plusieurs voitures spécifiques.
        </p>
        {Object.keys(carsByClass).length === 0 ? (
          <p style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>
            Aucune voiture disponible.
          </p>
        ) : (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
          >
            {Object.entries(carsByClass).map(([cls, carsInClass]) => (
              <div key={cls}>
                <div
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--text-dim)",
                    marginBottom: "0.5rem",
                  }}
                >
                  {cls}
                </div>
                <div
                  style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}
                >
                  {carsInClass.map((car) => (
                    <CarCheckbox
                      key={car.id}
                      car={car}
                      checked={preferredCarIds.includes(car.id)}
                      onChange={() => toggleCar(car.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <h3 style={{ marginBottom: "1.25rem", color: "var(--text-dim)" }}>
          Notes
        </h3>
        <div className="form-group">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="ex : disponible uniquement le samedi soir…"
          />
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: "0.75rem" }}>
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
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading
              ? "Enregistrement…"
              : signup?.id
                ? "✓ Mettre à jour"
                : "✓ S'inscrire"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
          >
            Annuler
          </button>
        </div>
        {signup?.id && (
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleDelete}
          >
            Se désinscrire
          </button>
        )}
      </div>
    </form>
  );
}

function InscriptionPage({ params }) {
  const searchParams = useSearchParams();
  const { id } = use(params);
  const router = useRouter();
  const [drivers, setDrivers] = useState([]);
  const [cars, setCars] = useState([]);
  const [carEntries, setCarEntries] = useState([]);
  const [eventName, setEventName] = useState("");
  const [eventTimezone, setEventTimezone] = useState("Europe/Paris");
  const [startTimes, setStartTimes] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [driverId, setDriverId] = useState("");
  const [existingSignups, setExistingSignups] = useState([]);
  const [editingSignup, setEditingSignup] = useState(null);
  const [error, setError] = useState(null);
  const [currentUserRole, setCurrentUserRole] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const isExternal = currentUserRole === "external";
  const [currentUserIsAdmin, setCurrentUserIsAdmin] = useState(false);

  useEffect(() => {
    Promise.all([
      // Engineers are staff — they don't sign up as drivers for events.
      // Test accounts are hidden from all dropdowns outside the admin panel.
      (() => {
        let q = supabase
          .from("drivers")
          .select("id, name, role")
          .eq("active", true)
          .neq("role", "engineer")
          .order("name");
        if (process.env.NEXT_PUBLIC_SHOW_TEST_ACCOUNTS !== "true") {
          q = q.eq("is_test_account", false);
        }
        return q;
      })(),
      supabase
        .from("cars")
        .select("id, name, class")
        .order("class")
        .order("name"),
      supabase
        .from("events")
        .select("name, format, timezone, archived")
        .eq("id", id)
        .single(),
      supabase
        .from("team_entries")
        .select(
          "id, crew_name, class, car_id, start_time_id, cars(id, name, class)",
        )
        .eq("event_id", id)
        .order("crew_name"),
      supabase
        .from("event_start_times")
        .select("*")
        .eq("event_id", id)
        .order("irl_start"),
    ]).then(
      async ([
        { data: driversData },
        { data: carsData },
        { data: evData },
        { data: entriesData },
        { data: stData },
      ]) => {
        // Store full list — external drivers filtered out at render time
        // based on current user's role (admins can see everyone)
        setDrivers(driversData || []);
        setEventName(evData?.name || "");
        // Archived events are read-only — redirect to event detail page
        if (evData?.archived) {
          router.push(`/evenements/${id}`);
          return;
        }
        setEventTimezone(evData?.timezone || "Europe/Paris");
        setCarEntries(entriesData || []);
        setStartTimes(stData || []);

        let filteredCars = carsData || [];
        // Filter cars to only those allowed for this event's format (event_type_cars).
        // If no restrictions are configured, all cars are shown.
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
        setCars(filteredCars);
        setFetching(false);

        // Preselect driver from URL param (admin managing another driver's signup)
        // or from the logged-in user's own driver record.
        const preselect = searchParams.get("driver");
        if (preselect) {
          setDriverId(preselect);
        } else {
          // Auto-select the logged-in driver's own record.
          supabase.auth.getUser().then(async ({ data: { user } }) => {
            if (!user) return;

            const { data: driver } = await supabase
              .from("drivers")
              .select("id, role")
              .eq("auth_user_id", user.id)
              .single();

            if (driver) {
              setDriverId(driver.id);
              setCurrentUserId(driver.id);
              setCurrentUserRole(driver.role);
              setCurrentUserIsAdmin(
                driver.role === "admin" || driver.role === "super_admin",
              );
            }
          });
        }
      },
    );
  }, [id, searchParams]);

  useEffect(() => {
    if (!driverId) {
      setExistingSignups([]);
      return;
    }
    supabase
      .from("signups")
      .select(
        "*, team_entries(id, crew_name, class, car_id, cars(name, class))",
      )
      .eq("event_id", id)
      .eq("driver_id", driverId)
      .then(({ data }) => setExistingSignups(data || []));
  }, [driverId, id]);

  // Re-fetch signups after save/delete without reloading the whole page.
  // Also clears editingSignup to collapse the form.
  const refreshSignups = () => {
    if (!driverId) return;
    supabase
      .from("signups")
      .select(
        "*, team_entries(id, crew_name, class, car_id, cars(name, class))",
      )
      .eq("event_id", id)
      .eq("driver_id", driverId)
      .then(({ data }) => {
        setExistingSignups(data || []);
        setEditingSignup(null);
      });
  };

  if (fetching)
    return (
      <div className="page">
        <p style={{ color: "var(--text-dim)" }}>Chargement…</p>
      </div>
    );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Inscription</h1>
          <div className="accent-line" />
          {eventName && (
            <div
              style={{
                marginTop: "0.4rem",
                color: "var(--text-dim)",
                fontSize: "0.85rem",
              }}
            >
              {eventName}
            </div>
          )}
        </div>
        <Link href={`/evenements/${id}`} className="btn btn-secondary">
          ← Retour
        </Link>
      </div>

      {/* Driver selector — hidden until role is known and hidden for externals who are auto-selected */}
      {currentUserRole !== null && !isExternal && (
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <h3 style={{ marginBottom: "1.25rem", color: "var(--text-dim)" }}>
            Qui êtes-vous ?
          </h3>
          <div className="form-group">
            <label htmlFor="driver_id">Votre nom *</label>
            <select
              id="driver_id"
              value={driverId}
              onChange={(e) => {
                setDriverId(e.target.value);
                setEditingSignup(null);
              }}
            >
              <option value="">— Sélectionnez votre nom —</option>
              {drivers
                // Admins see everyone
                // Non-admins see non-external drivers + themselves (in case they are external)
                .filter(
                  (d) =>
                    currentUserIsAdmin ||
                    d.role !== "external" ||
                    d.id === currentUserId,
                )
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
          </div>
        </div>
      )}

      {driverId && (
        <>
          {/* Helper text explaining multiple signups are allowed */}
          {isExternal === false && (
            <p
              style={{
                fontSize: "0.82rem",
                color: "var(--text-dim)",
                marginBottom: "1rem",
              }}
            >
              Vous pouvez vous inscrire pour plusieurs équipes séparément.
            </p>
          )}

          {/* Existing signups */}
          {existingSignups.length > 0 && (
            <div style={{ marginBottom: "1.25rem" }}>
              <h3 style={{ marginBottom: "0.75rem" }}>
                Inscriptions existantes
              </h3>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                {existingSignups.map((signup) => (
                  <div key={signup.id}>
                    {!isExternal && editingSignup?.id === signup.id ? (
                      <div className="card">
                        <h3
                          style={{
                            marginBottom: "1rem",
                            color: "var(--text-dim)",
                          }}
                        >
                          Modifier —{" "}
                          {signup.team_entries?.crew_name || "Sans équipe"}
                        </h3>
                        <SignupForm
                          signup={signup}
                          carEntries={carEntries}
                          cars={cars}
                          startTimes={startTimes}
                          eventTimezone={eventTimezone}
                          eventId={id}
                          driverId={driverId}
                          onSaved={refreshSignups}
                          onCancel={() => setEditingSignup(null)}
                          onDelete={refreshSignups}
                        />
                      </div>
                    ) : (
                      <div
                        className="card"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "1rem",
                          flexWrap: "wrap",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600 }}>
                            {signup.team_entries?.crew_name ||
                              "Sans équipe assignée"}
                          </div>
                          {(() => {
                            const entry = carEntries.find(
                              (e) => e.id === signup.team_entry_id,
                            );
                            const st = entry
                              ? startTimes.find(
                                  (s) => s.id === entry.start_time_id,
                                )
                              : null;
                            if (st)
                              return (
                                <div
                                  className="mono"
                                  style={{
                                    fontSize: "0.75rem",
                                    color: "var(--accent)",
                                    marginTop: "0.15rem",
                                  }}
                                >
                                  {st.label} · Départ à{" "}
                                  {formatTimeInZone(
                                    st.irl_start,
                                    eventTimezone,
                                  )}
                                </div>
                              );
                            const prefTimes = (
                              signup.preferred_start_time_ids || []
                            )
                              .map((sid) =>
                                startTimes.find((s) => s.id === sid),
                              )
                              .filter(Boolean);
                            if (prefTimes.length === 0) return null;
                            return (
                              <div style={{ marginTop: "0.15rem" }}>
                                {prefTimes.map((s) => (
                                  <div
                                    key={s.id}
                                    className="mono"
                                    style={{
                                      fontSize: "0.75rem",
                                      color: "var(--accent)",
                                    }}
                                  >
                                    {s.label} · Départ à{" "}
                                    {formatTimeInZone(
                                      s.irl_start,
                                      eventTimezone,
                                    )}
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                          {signup.notes && (
                            <div
                              style={{
                                fontSize: "0.78rem",
                                color: "var(--text-dim)",
                                marginTop: "0.2rem",
                                fontStyle: "italic",
                              }}
                            >
                              {signup.notes}
                            </div>
                          )}
                        </div>
                        {!isExternal && (
                          <button
                            onClick={() => setEditingSignup(signup)}
                            className="btn btn-secondary btn-sm"
                          >
                            Modifier
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New signup or add button */}
          {!isExternal && editingSignup === "new" ? (
            <div className="card" style={{ marginBottom: "1.25rem" }}>
              <h3 style={{ marginBottom: "1rem", color: "var(--text-dim)" }}>
                Nouvelle inscription
              </h3>
              <SignupForm
                signup={null}
                carEntries={carEntries}
                cars={cars}
                startTimes={startTimes}
                eventTimezone={eventTimezone}
                eventId={id}
                driverId={driverId}
                onSaved={refreshSignups}
                onCancel={() => setEditingSignup(null)}
                onDelete={refreshSignups}
              />
            </div>
          ) : (
            !isExternal &&
            editingSignup === null && (
              <button
                onClick={() => setEditingSignup("new")}
                className="btn btn-primary"
              >
                +{" "}
                {existingSignups.length > 0
                  ? "S'inscrire pour une autre équipe"
                  : "S'inscrire"}
              </button>
            )
          )}
        </>
      )}
    </div>
  );
}

// useSearchParams() requires a Suspense boundary in Next.js app router —
// wrap the page component to avoid build errors.
export default function Inscription({ params }) {
  return (
    <Suspense>
      <InscriptionPage params={params} />
    </Suspense>
  );
}
