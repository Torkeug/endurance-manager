"use client";
import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser as supabase } from "../../../../../lib/supabase-browser";
import { formatTimeInZone, formatDateLabelInZone } from "../../../../../lib/timezone";
import { useTranslations, useLocale } from "next-intl";

// Used to pre-populate availability slots on driver assignment at team creation.
// Mirrors AvailabilityGrid's generateSlots — 30-min slots, 1h buffer each side.
function generateSlots(irlStart, durationMinutes) {
  const slots = [];
  const start = new Date(new Date(irlStart).getTime() - 60 * 60 * 1000);
  const end = new Date(
    new Date(irlStart).getTime() + (durationMinutes + 60) * 60 * 1000,
  );
  let current = new Date(start);
  current.setMinutes(Math.floor(current.getMinutes() / 30) * 30, 0, 0);
  while (current <= end) {
    slots.push(new Date(current));
    current = new Date(current.getTime() + 30 * 60 * 1000);
  }
  return slots;
}

// Pre-populates availability slots for a list of drivers as unavailable (false).
// Uses upsert with ignoreDuplicates so existing entries are never overwritten.
async function prepopulateAvailabilities(
  supabase,
  entryId,
  driverIds,
  irlStart,
  durationMinutes,
) {
  if (!irlStart || !durationMinutes || driverIds.length === 0) return;
  const slots = generateSlots(irlStart, durationMinutes);
  const rows = driverIds.flatMap((driverId) =>
    slots.map((slot) => ({
      team_entry_id: entryId,
      driver_id: driverId,
      slot_start: slot.toISOString(),
      available: false,
      updated_at: new Date().toISOString(),
    })),
  );
  await supabase.from("availabilities").upsert(rows, {
    onConflict: "team_entry_id,driver_id,slot_start",
    ignoreDuplicates: true,
  });
}

const emptyForm = {
  crew_name: "",
  car_id: "",
  class: "",
  car_number: "",
  start_time_id: "",
  bop_power_percent: "100",
  bop_weight_kg: "0",
  bop_tank_size_percent: "",
  refuel_time_seconds: "30",
  tyre_change_time_seconds: "0",
};

export default function NouvelEquipage({ params }) {
  const t = useTranslations("entryForm");
  const tDrivers = useTranslations("driversTab");
  const locale = useLocale();
  const [eventTimezone, setEventTimezone] = useState("Europe/Paris");
  const router = useRouter();
  const { id } = use(params);

  const [form, setForm] = useState(emptyForm);
  const [cars, setCars] = useState([]);
  const [startTimes, setStartTimes] = useState([]);
  const [crewNames, setCrewNames] = useState([]);
  const [selectedCar, setSelectedCar] = useState(null);
  const [eventName, setEventName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isChampionship, setIsChampionship] = useState(false);
  // Holds data needed for the post-creation start time preference modal.
  // Set after team entry is inserted but before signups are assigned.
  // null = modal closed | object = modal open with affected driver details.
  const [pendingAssignment, setPendingAssignment] = useState(null);
  const [eventDurationMinutes, setEventDurationMinutes] = useState(0);

  // Multiple Twitch streams — stored as array of raw usernames
  const [twitchUsernames, setTwitchUsernames] = useState([]);
  const [twitchInput, setTwitchInput] = useState("");
  // Drivers in this event who have a linked Twitch account — offered as quick-pick
  const [twitchDrivers, setTwitchDrivers] = useState([]);
  // Unassigned event signups available for driver selection at creation time
  const [eventSignups, setEventSignups] = useState([]);
  // IDs of signups selected to be assigned immediately on team creation
  const [selectedSignupIds, setSelectedSignupIds] = useState([]);

  useEffect(() => {
    Promise.all([
      supabase.from("cars").select("*").order("class").order("name"),
      supabase
        .from("event_start_times")
        .select("*")
        .eq("event_id", id)
        .order("irl_start"),
      supabase
        .from("events")
        .select("name, format, timezone, championship_id, duration_minutes")
        .eq("id", id)
        .single(),
      supabase.from("crew_names").select("name").order("sort_order"),
      // Fetch signed-up drivers who have a Twitch account linked
      supabase
        .from("signups")
        .select("drivers(id, name, twitch)")
        .eq("event_id", id),
      // Fetch unassigned event signups for the driver selection card
      supabase
        .from("signups")
        .select(
          "id, preferred_car_ids, preferred_class, preferred_start_time_ids, drivers(id, name, irating)",
        )
        .eq("event_id", id)
        .is("team_entry_id", null),
    ]).then(
      async ([
        { data: carsData },
        { data: stData },
        { data: evData },
        { data: crewData },
        { data: signupsData },
        { data: driverSignupsData },
      ]) => {
        setStartTimes(stData || []);
        setEventName(evData?.name || "");
        setEventTimezone(evData?.timezone || "Europe/Paris");
        setIsChampionship(!!evData?.championship_id);
        setEventDurationMinutes(evData?.duration_minutes || 0);
        setCrewNames(
          crewData?.map((c) => c.name).sort((a, b) => a.localeCompare(b)) || [],
        );

        // Build unique list of drivers with a Twitch account from event signups
        const seen = new Set();
        const withTwitch = (signupsData || [])
          .map((s) => s.drivers)
          .filter((d) => d && d.twitch && !seen.has(d.id) && seen.add(d.id))
          .sort((a, b) => a.name.localeCompare(b.name));
        setTwitchDrivers(withTwitch);

        // Store unassigned signups sorted by driver name
        setEventSignups(
          (driverSignupsData || [])
            .filter((s) => s.drivers)
            .sort((a, b) => a.drivers.name.localeCompare(b.drivers.name)),
        );

        let filteredCars = carsData || [];
        // Filter cars to only those allowed for this event's format (event_type_cars).
        // If no restrictions are configured for this format, all cars are shown.
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
      },
    );
  }, [id]);

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

  // Add a username to the list if not already present
  const addTwitchUsername = (username) => {
    const clean = username.trim().toLowerCase();
    if (!clean) return;
    setTwitchUsernames((prev) =>
      prev.includes(clean) ? prev : [...prev, clean],
    );
    setTwitchInput("");
  };

  // Toggle a driver's Twitch in/out of the list
  const toggleTwitchDriver = (username) => {
    const clean = username.trim().toLowerCase();
    setTwitchUsernames((prev) =>
      prev.includes(clean) ? prev.filter((u) => u !== clean) : [...prev, clean],
    );
  };

  const removeTwitchUsername = (username) => {
    setTwitchUsernames((prev) => prev.filter((u) => u !== username));
  };

  // Toggle a signup in/out of the selected drivers list
  const toggleSignup = (signupId) => {
    setSelectedSignupIds((prev) =>
      prev.includes(signupId)
        ? prev.filter((id) => id !== signupId)
        : [...prev, signupId],
    );
  };

  // Returns an array of conflict descriptors for a signup — mirrors the
  // PreferenceBadge logic in DriversAssignment.js for consistency.
  // Each conflict has: { label, tooltip, hard }
  const getMismatches = (signup) => {
    const prefCarIds = signup.preferred_car_ids || [];
    const prefClasses = signup.preferred_class || [];
    const prefStartTimeIds = signup.preferred_start_time_ids || [];
    const conflicts = [];

    // ── Class check (hard) ──────────────────────────────────────────────────
    const classConflict =
      prefClasses.length > 0 && form.class && !prefClasses.includes(form.class);
    if (classConflict) {
      conflicts.push({
        label: tDrivers("conflictClass"),
        tooltip: tDrivers("tooltipClass", { entryClass: form.class, preferred: prefClasses.join(", ") }),
        hard: true,
      });
    }

    // ── Car check (soft — only when class matches) ──────────────────────────
    const carConflict =
      !classConflict &&
      prefCarIds.length > 0 &&
      form.car_id &&
      !prefCarIds.includes(form.car_id);
    if (carConflict) {
      const prefCarNames = prefCarIds.map((id) => carsMap[id] || id).join(", ");
      const teamCarName = carsMap[form.car_id] || form.car_id;
      conflicts.push({
        label: tDrivers("conflictCar"),
        tooltip: tDrivers("tooltipCar", { entryCar: teamCarName, preferred: prefCarNames, entryClass: form.class }),
        hard: false,
      });
    }

    // ── Start time check (soft) ─────────────────────────────────────────────
    // Only consider IDs that resolve in the map — stale IDs silently ignored.
    const resolvablePrefs = prefStartTimeIds.filter((id) => startTimesMap[id]);
    const startConflict =
      form.start_time_id &&
      startTimesMap[form.start_time_id] &&
      resolvablePrefs.length > 0 &&
      !resolvablePrefs.includes(form.start_time_id);
    if (startConflict) {
      const teamLabel = startTimesMap[form.start_time_id];
      const prefLabels = resolvablePrefs
        .map((id) => startTimesMap[id])
        .join(", ");
      conflicts.push({
        label: tDrivers("conflictSchedule"),
        tooltip: tDrivers("tooltipSchedule", { teamSlot: teamLabel, preferred: prefLabels }),
        hard: false,
      });
    }

    return conflicts;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.crew_name) {
      setError(t("errorCrewName"));
      return;
    }
    if (!form.class) {
      setError(t("errorClass"));
      return;
    }
    if (!form.start_time_id) {
      setError(t("errorStartTime"));
      return;
    }

    setLoading(true);
    setError(null);

    // Validate car number uniqueness within the event before inserting
    if (isChampionship && form.car_number !== "" && form.start_time_id) {
      const { data: existing } = await supabase
        .from("team_entries")
        .select("id, crew_name")
        .eq("event_id", id)
        .eq("start_time_id", form.start_time_id)
        .eq("car_number", parseInt(form.car_number))
        .maybeSingle();
      if (existing) {
        setError(t("errorCarNumberDuplicate", { number: form.car_number }));
        setLoading(false);
        return;
      }
    }

    // Build full Twitch URLs from usernames array
    const streamUrls = twitchUsernames.map((u) => `https://twitch.tv/${u}`);

    const payload = {
      event_id: id,
      crew_name: form.crew_name,
      car_id: form.car_id || null,
      class: form.class || null,
      start_time_id: form.start_time_id,
      stream_urls: streamUrls,
      bop_power_percent: parseFloat(form.bop_power_percent) || 100,
      bop_weight_kg: parseFloat(form.bop_weight_kg) || 0,
      // BoP tank size is optional — null means use the car's default tank size.
      bop_tank_size_percent: form.bop_tank_size_percent
        ? parseFloat(form.bop_tank_size_percent)
        : null,
      refuel_time_seconds: parseInt(form.refuel_time_seconds) || 30,
      tyre_change_time_seconds: parseInt(form.tyre_change_time_seconds) || 0,
      car_number:
        isChampionship && form.car_number !== ""
          ? parseInt(form.car_number)
          : null,
    };

    const { data, error: err } = await supabase
      .from("team_entries")
      .insert([payload])
      .select()
      .single();

    if (err) {
      setError(
        err.code === "23505"
          ? err.message.includes("car_number")
            ? t("errorDuplicateNumber")
            : t("errorDuplicateSlot")
          : err.message,
      );
      setLoading(false);
    } else {
      if (selectedSignupIds.length > 0) {
        // Find which selected signups are missing the team start time in their
        // preferences — these drivers will be prompted to add it via the modal.
        const selectedSignups = eventSignups.filter((s) =>
          selectedSignupIds.includes(s.id),
        );
        const affected = selectedSignups.filter((s) => {
          const prefs = s.preferred_start_time_ids || [];
          // Only flag if driver has preferences set but team start time is missing
          return prefs.length > 0 && !prefs.includes(form.start_time_id);
        });

        if (affected.length > 0) {
          // Some drivers are missing the start time preference — show modal
          // before committing assignments so admin can decide whether to add it.
          const startTime = startTimes.find(
            (st) => st.id === form.start_time_id,
          );
          setPendingAssignment({
            entryId: data.id,
            entryEventId: id,
            selectedSignups,
            affectedSignups: affected,
            startTimeLabel: startTime
              ? t("labelAtTime", { label: formatDateLabelInZone(startTime.irl_start, eventTimezone, locale), time: formatTimeInZone(startTime.irl_start, eventTimezone) })
              : form.start_time_id,
          });
          setLoading(false);
          return;
        }

        // No affected drivers — assign all silently with snapshot
        await Promise.all(
          selectedSignups.map((s) =>
            supabase
              .from("signups")
              .update({
                team_entry_id: data.id,
                preferred_start_time_ids_snapshot:
                  s.preferred_start_time_ids || [],
              })
              .eq("id", s.id),
          ),
        );
        // Pre-populate availability slots for all assigned drivers
        const startTime = startTimes.find((st) => st.id === form.start_time_id);
        if (startTime) {
          const driverIds = selectedSignups
            .map((s) => s.drivers?.id)
            .filter(Boolean);
          await prepopulateAvailabilities(
            supabase,
            data.id,
            driverIds,
            startTime.irl_start,
            eventDurationMinutes,
          );
        }
      }
      router.push(`/evenements/${id}/equipages/${data.id}`);
      router.refresh();
    }
  };

  const carsByClass = cars.reduce((acc, car) => {
    if (!acc[car.class]) acc[car.class] = [];
    acc[car.class].push(car);
    return acc;
  }, {});

  const availableClasses = [...new Set(cars.map((c) => c.class))]
    .filter(Boolean)
    .sort();

  // Derived maps for mismatch resolution — built from already-fetched state,
  // no extra queries needed.
  const carsMap = Object.fromEntries(cars.map((c) => [c.id, c.name]));
  const startTimesMap = Object.fromEntries(
    startTimes.map((st) => [st.id, st.label]),
  );

  // Commits driver assignments after the modal decision.
  // addStartTime: true = add team start time to affected drivers' preferences.
  const commitAssignments = async (addStartTime) => {
    const { entryId, selectedSignups, affectedSignups } = pendingAssignment;
    const affectedIds = new Set(affectedSignups.map((s) => s.id));

    await Promise.all(
      selectedSignups.map((s) => {
        const currentPrefs = s.preferred_start_time_ids || [];
        const isAffected = affectedIds.has(s.id);
        // Add start time to preferences only for affected drivers and only
        // if the admin confirmed — unaffected drivers stay unchanged
        const newPrefs =
          addStartTime &&
          isAffected &&
          !currentPrefs.includes(form.start_time_id)
            ? [...currentPrefs, form.start_time_id]
            : currentPrefs;
        return supabase
          .from("signups")
          .update({
            team_entry_id: entryId,
            // Snapshot taken before any modification — used by unassign
            // to know whether to remove the start time on departure
            preferred_start_time_ids_snapshot: currentPrefs,
            preferred_start_time_ids: newPrefs,
          })
          .eq("id", s.id);
      }),
    );

    // Pre-populate availability slots for all assigned drivers
    const startTime = startTimes.find((st) => st.id === form.start_time_id);
    if (startTime) {
      const driverIds = pendingAssignment.selectedSignups
        .map((s) => s.drivers?.id)
        .filter(Boolean);
      await prepopulateAvailabilities(
        supabase,
        pendingAssignment.entryId,
        driverIds,
        startTime.irl_start,
        eventDurationMinutes,
      );
    }
    setPendingAssignment(null);
    router.push(`/evenements/${id}/equipages/${pendingAssignment.entryId}`);
    router.refresh();
  };

  return (
    <div className="page">
      {/* ── Start time preference modal ─────────────────────────────────────
          Shown after team creation when some selected drivers don't have the
          team's start time in their preferred_start_time_ids. */}
      {pendingAssignment && (
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
            <h3 style={{ marginBottom: "0.75rem" }}>{t("slotPrefTitle")}</h3>
            <p
              style={{
                fontSize: "0.9rem",
                color: "var(--text-dim)",
                marginBottom: "0.75rem",
              }}
            >
              <strong style={{ color: "var(--text)" }}>
                {pendingAssignment.affectedSignups.length}
              </strong>{" "}
              {t("slotPrefNoPreference", {
                count: pendingAssignment.affectedSignups.length,
              })}{" "}
              :
            </p>
            <ul
              style={{
                margin: "0 0 1rem",
                paddingLeft: "1.25rem",
                fontSize: "0.88rem",
                color: "var(--accent)",
                display: "flex",
                flexDirection: "column",
                gap: "0.2rem",
              }}
            >
              {pendingAssignment.affectedSignups.map((s) => (
                <li key={s.id}>{s.drivers?.name}</li>
              ))}
            </ul>
            <p
              style={{
                fontSize: "0.9rem",
                color: "var(--text-dim)",
                marginBottom: "1.5rem",
              }}
            >
              {t("slotPrefAdd")}{" "}
              <strong style={{ color: "var(--text)" }}>
                {pendingAssignment.startTimeLabel}
              </strong>{" "}
              {t("slotPrefAddSuffix")}
            </p>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <button
                onClick={() => commitAssignments(true)}
                className="btn btn-primary"
              >
                {t("slotPrefConfirm")}
              </button>
              <button
                onClick={() => commitAssignments(false)}
                className="btn btn-secondary"
              >
                {t("slotPrefDecline")}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="page-header">
        <div>
          <h1>{t("titleNew")}</h1>
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
          {t("back")}
        </Link>
      </div>

      {startTimes.length === 0 && (
        <div className="alert alert-error" style={{ marginBottom: "1.5rem" }}>
          {t("noStartTimesConfigured")}{" "}
          <Link
            href={`/evenements/${id}?tab=horaires`}
            style={{ color: "inherit", fontWeight: 700 }}
          >
            {t("addStartTimeHint")}
          </Link>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* ── Équipage & voiture ── */}
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <h3 style={{ marginBottom: "1.25rem", color: "var(--text-dim)" }}>
            {t("sectionEntryInfo")}
          </h3>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="crew_name">{t("labelCrewName")}</label>
              <select
                id="crew_name"
                value={form.crew_name}
                onChange={set("crew_name")}
                required
              >
                <option value="">{t("selectPlaceholder")}</option>
                {crewNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="car_id">{t("labelCar")}</label>
              <select id="car_id" value={form.car_id} onChange={set("car_id")}>
                <option value="">{t("selectPlaceholder")}</option>
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
                <label>{t("labelTank")}</label>
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
              <label htmlFor="class">{t("labelClass")}</label>
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
                  <option value="">{t("selectPlaceholder")}</option>
                  {availableClasses.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {/* ── Numéro de course — only shown for championship events ── */}
            {isChampionship && (
              <div className="form-group">
                <label htmlFor="car_number">{t("labelCarNumber")}</label>
                <input
                  id="car_number"
                  type="number"
                  min={0}
                  max={999}
                  value={form.car_number}
                  onChange={set("car_number")}
                  placeholder={t("placeholderCarNumber")}
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Horaire de départ ── */}
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <h3 style={{ marginBottom: "1.25rem", color: "var(--text-dim)" }}>
            {t("labelStartTime")}
          </h3>
          {startTimes.length === 0 ? (
            <p style={{ color: "var(--text-dim)", fontSize: "0.9rem" }}>
              {t("noStartSlots")}
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
                      {t("startAt")} {formatTimeInZone(st.irl_start, eventTimezone)}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* ── Pilotes ── */}
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <h3 style={{ marginBottom: "1.25rem", color: "var(--text-dim)" }}>
            {t("sectionDrivers")}{" "}
            {selectedSignupIds.length > 0 && (
              <span
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 400,
                  color: "var(--accent)",
                  marginLeft: "0.5rem",
                }}
              >
                {t("driversSelected", { count: selectedSignupIds.length })}
              </span>
            )}
          </h3>
          {eventSignups.length === 0 ? (
            <p style={{ color: "var(--text-dim)", fontSize: "0.9rem" }}>
              {t("noDriversAvailable")}
            </p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {eventSignups.map((s) => {
                const selected = selectedSignupIds.includes(s.id);
                const conflicts = getMismatches(s);
                const hasMismatch = conflicts.length > 0;
                const isHard = conflicts.some((c) => c.hard);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSignup(s.id)}
                    className="btn btn-secondary"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: "0.25rem",
                      borderColor: selected
                        ? "var(--accent)"
                        : hasMismatch
                          ? "#a06020"
                          : undefined,
                      background: selected ? "var(--accent-dim)" : undefined,
                    }}
                  >
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.4rem",
                      }}
                    >
                      {hasMismatch && (
                        <span
                          style={{
                            color: isHard ? "var(--danger)" : "#d4904a",
                          }}
                        >
                          ⚠️
                        </span>
                      )}
                      <span style={{ fontWeight: 600 }}>
                        {selected ? "✓ " : ""}
                        {s.drivers?.name}
                      </span>
                    </span>
                    {s.drivers?.irating && (
                      <span
                        className="mono"
                        style={{ fontSize: "0.75rem", color: "var(--accent)" }}
                      >
                        {s.drivers.irating}
                      </span>
                    )}
                    {/* Consolidated badge matching PreferenceBadge severity logic */}
                    {hasMismatch && (
                      <span
                        title={conflicts.map((c) => c.tooltip).join("\n\n")}
                        style={{
                          fontSize: "0.7rem",
                          padding: "0.15rem 0.4rem",
                          borderRadius: "2px",
                          whiteSpace: "nowrap",
                          cursor: "help",
                          ...(isHard
                            ? {
                                background: "rgba(224,85,85,0.12)",
                                border: "1px solid var(--danger)",
                                color: "var(--danger)",
                              }
                            : {
                                background: "#2a1a00",
                                border: "1px solid #a06020",
                                color: "#d4904a",
                              }),
                        }}
                      >
                        ⚠️ {conflicts.map((c) => c.label).join(", ")}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Twitch streams ── */}
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <h3 style={{ marginBottom: "1.25rem", color: "var(--text-dim)" }}>
            {t("sectionStreams")}
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
          {/* Quick-pick from selected drivers with linked Twitch */}
          {twitchDrivers.filter((d) =>
            eventSignups.some(
              (s) => selectedSignupIds.includes(s.id) && s.drivers?.id === d.id,
            ),
          ).length > 0 && (
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                flexWrap: "wrap",
                marginBottom: "0.5rem",
              }}
            >
              {twitchDrivers
                .filter((d) =>
                  eventSignups.some(
                    (s) =>
                      selectedSignupIds.includes(s.id) &&
                      s.drivers?.id === d.id,
                  ),
                )
                .map((d) => {
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
          {/* Outer: column on mobile, row on sm+ */}
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-0 sm:items-stretch">
            {/* Row 1: twitch.tv/ prefix joined to input — always a flex row */}
            <div style={{ display: "flex", flex: 1 }}>
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
                  setTwitchInput(
                    e.target.value.replace(/\s/g, "").toLowerCase(),
                  )
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTwitchUsername(twitchInput);
                  }
                }}
                placeholder={t("streamPlaceholder")}
                style={{
                  flex: 1,
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderLeft: "none",
                  borderRadius: "0 3px 3px 0",
                  color: "var(--text)",
                  padding: "0.55rem 0.75rem",
                  fontFamily: "inherit",
                  fontSize: "0.9rem",
                }}
              />
            </div>

            {/* Row 2 on mobile, inline right on desktop */}
            <button
              type="button"
              onClick={() => addTwitchUsername(twitchInput)}
              className="btn btn-secondary"
              style={{ whiteSpace: "nowrap" }}
            >
              {t("addStream")}
            </button>
          </div>
        </div>

        {/* ── Paramètres stratégie ── */}
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <h3 style={{ marginBottom: "1.25rem", color: "var(--text-dim)" }}>
            {t("sectionStrategy")}
          </h3>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="bop_power_percent">{t("labelBopPower")}</label>
              <input
                id="bop_power_percent"
                type="number"
                value={form.bop_power_percent}
                onChange={set("bop_power_percent")}
                min="50"
                max="150"
                step="0.01"
              />
            </div>
            <div className="form-group">
              <label htmlFor="bop_weight_kg">{t("labelBopWeight")}</label>
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
              <label htmlFor="bop_tank_size_percent">{t("labelBopTank")}</label>
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
              <label htmlFor="refuel_time_seconds">{t("labelRefuelTime")}</label>
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
              <label htmlFor="tyre_change_time_seconds">{t("labelTyreTime")}</label>
              <input
                id="tyre_change_time_seconds"
                type="number"
                value={form.tyre_change_time_seconds}
                onChange={set("tyre_change_time_seconds")}
                min="0"
                max="300"
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
            {loading ? t("saving") : t("submitNew")}
          </button>
          <Link href={`/evenements/${id}`} className="btn btn-secondary">
            {t("cancel")}
          </Link>
        </div>
      </form>
    </div>
  );
}
