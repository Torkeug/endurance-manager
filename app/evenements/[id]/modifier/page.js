"use client";
import { useState, useEffect, use, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser as supabase } from "../../../../lib/supabase-browser";
import { TIMEZONES } from "../../../../lib/timezone";
import { useTranslations } from "next-intl";

function ConfirmModal({ modal, onConfirm, onCancel }) {
  const t = useTranslations("eventForm");
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
            {modal.confirmLabel || t("confirm")}
          </button>
          <button onClick={onCancel} className="btn btn-secondary">
            {t("cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}

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

export default function ModifierEvenement({ params }) {
  const t = useTranslations("eventForm");
  const router = useRouter();
  const { id } = use(params);
  const [eventTypes, setEventTypes] = useState([]);
  const [durations, setDurations] = useState([]);
  const [isSpecial, setIsSpecial] = useState(false);
  const [weekendStartDate, setWeekendStartDate] = useState("");

  const [form, setForm] = useState(null);
  const [circuits, setCircuits] = useState([]);
  const [trackNameById, setTrackNameById] = useState({});
  const [selectedBaseTrack, setSelectedBaseTrack] = useState("");
  const [pitTime, setPitTime] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState(null);
  const [customH, setCustomH] = useState("");
  const [customM, setCustomM] = useState("");
  const [authChecked, setAuthChecked] = useState(false);
  const [showRegenModal, setShowRegenModal] = useState(false);
  const [previewStep, setPreviewStep] = useState(false);
  const [previewLosses, setPreviewLosses] = useState([]);
  const [previewTeamLosses, setPreviewTeamLosses] = useState([]);
  const [confirmModal, setConfirmModal] = useState(null);

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
        .select("id, name, pit_lane_time_seconds, iracing_track_id")
        .order("name"),
      supabase.from("events").select("*").eq("id", id).single(),
    ]).then(([{ data: circuitsData }, { data: event, error: eventError }]) => {
      setCircuits(circuitsData || []);
      if (eventError || !event) {
        setError(t("notFound"));
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
        green_flag_offset_minutes: event.green_flag_offset_minutes ?? 0,
      });
      // Pre-fill base track for grouped dropdown
      if (event.circuit_id && circuitsData) {
        const existing = circuitsData.find((c) => c.id === event.circuit_id);
        if (existing?.iracing_track_id) {
          // Will be resolved once trackNameById loads
          setSelectedBaseTrack(`__pending__${existing.iracing_track_id}`);
        } else if (existing) {
          setSelectedBaseTrack(`__direct__${existing.id}`);
        }
      }
      // Archived events cannot be modified — redirect to detail page
      if (event.archived) {
        router.push(`/evenements/${id}`);
        return;
      }
      setIsSpecial(event.is_special || false);
      setWeekendStartDate(event.weekend_start_date || "");
      setFetching(false);
    });
  }, [id]);

  useEffect(() => {
    supabase
      .from("iracing_tracks")
      .select("iracing_track_id, track_name")
      .then(({ data }) => {
        const map = {};
        for (const track of data || []) map[track.iracing_track_id] = track.track_name;
        setTrackNameById(map);
      });
  }, []);

  // Resolve base track name once iracingTrackGroups loads
  useEffect(() => {
    if (!selectedBaseTrack.startsWith("__pending__")) return;
    const trackId = parseInt(selectedBaseTrack.replace("__pending__", ""));
    if (trackNameById[trackId]) {
      setSelectedBaseTrack(trackNameById[trackId]);
    }
  }, [trackNameById, selectedBaseTrack]);

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
      .then(({ data }) => setEventTypes(data?.map((et) => et.name) || []));
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
    // Validate in-game time fields — mobile Safari ignores type="time" constraints
    if (!isValidTime(form.ig_start_time)) {
      setError(t("errorIGStart"));
      return;
    }
    if (!isValidTime(form.ig_sunrise)) {
      setError(t("errorIGSunrise"));
      return;
    }
    if (!isValidTime(form.ig_sunset)) {
      setError(t("errorIGSunset"));
      return;
    }
    if (!form.name.trim()) {
      setError(t("errorName"));
      return;
    }
    if (!form.duration_minutes) {
      setError(t("errorDuration"));
      return;
    }
    if (!form.circuit_id) {
      setError(t("errorCircuit"));
      return;
    }
    // Special event weekend date must be a Friday
    if (isSpecial && weekendStartDate) {
      const day = new Date(weekendStartDate + "T00:00:00").getDay();
      if (day !== 5) {
        setError(t("errorFriday"));
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
      green_flag_offset_minutes: parseInt(form.green_flag_offset_minutes) || 0,
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

  // Simulates the start time remap without writing anything to the DB.
  // Computes which drivers would lose preferred_start_time_ids that don't
  // match any newly generated slot, then surfaces them in the modal so the
  // admin can make an informed decision before confirming.
  const handlePreviewRegen = async () => {
    setLoading(true);

    const { data: specialStartTimes } = await supabase
      .from("special_event_start_times")
      .select("*")
      .order("day_of_week")
      .order("hour")
      .order("minute");

    // Compute what irl_start values the new rows would have (same logic as handleRegen)
    const { DateTime } = await import("luxon");
    const friday = DateTime.fromISO(weekendStartDate, { zone: form.timezone });
    const newIrlStarts = new Set(
      (specialStartTimes || []).map((st) => {
        const dayOffset =
          { friday: 0, saturday: 1, sunday: 2 }[st.day_of_week] || 0;
        return friday
          .plus({ days: dayOffset })
          .set({ hour: st.hour, minute: st.minute, second: 0, millisecond: 0 })
          .toUTC()
          .toISO();
      }),
    );

    // Fetch current start times to know which old IDs will survive the remap
    const { data: oldStartTimes } = await supabase
      .from("event_start_times")
      .select("id, irl_start")
      .eq("event_id", id);

    // IDs whose irl_start matches a new slot → will be remapped (survive)
    // IDs with no match → will be dropped
    const survivingOldIds = new Set(
      (oldStartTimes || [])
        .filter((slot) => newIrlStarts.has(new Date(slot.irl_start).toISOString()))
        .map((slot) => slot.id),
    );

    // Fetch signups that have at least one preferred start time set
    const { data: affectedSignups } = await supabase
      .from("signups")
      .select("id, preferred_start_time_ids, drivers(name)")
      .eq("event_id", id)
      .not("preferred_start_time_ids", "eq", "{}");

    // A driver "loses" if none of their preferred IDs survive the remap
    const losses = (affectedSignups || [])
      .filter((s) => {
        const prefs = s.preferred_start_time_ids || [];
        const hasLoss = prefs.some((pid) => !survivingOldIds.has(pid));
        const hasAnySurviving = prefs.some((pid) => survivingOldIds.has(pid));
        return hasLoss && !hasAnySurviving;
      })
      .map((s) => s.drivers?.name || "—");

    // A team entry "loses" if its current start_time_id doesn't survive the remap
    const { data: currentTeamEntries } = await supabase
      .from("team_entries")
      .select("id, start_time_id, crew_name")
      .eq("event_id", id)
      .not("start_time_id", "is", null);

    const teamLosses = (currentTeamEntries || [])
      .filter(
        (te) => te.start_time_id && !survivingOldIds.has(te.start_time_id),
      )
      .map((te) => te.crew_name || "—");

    setPreviewLosses(losses);
    setPreviewTeamLosses(teamLosses);
    setLoading(false);
    setPreviewStep(true);
  };

  // Regenerates start times for a special event from the predefined slot templates.
  // Deletes all existing event_start_times rows, inserts new ones based on the
  // selected weekend date, then remaps every signup's preferred_start_time_ids
  // by matching old→new rows on irl_start. Preferences pointing to slots that no
  // longer exist are dropped. Should only be called after handlePreviewRegen has
  // confirmed the impact with the admin.
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
      // ── Step 1: snapshot old start times before deletion ──────────────────
      // We need old id→irl_start so we can remap signup preferences afterward.
      const { data: oldStartTimes } = await supabase
        .from("event_start_times")
        .select("id, irl_start")
        .eq("event_id", id);

      // ── Step 2: snapshot then null out team entry start_time_id ───────────
      // Snapshot first so we can remap after new rows are inserted.
      // The null update is required before deletion due to the FK constraint.
      const { data: teamEntriesSnapshot } = await supabase
        .from("team_entries")
        .select("id, start_time_id")
        .eq("event_id", id);

      await supabase
        .from("team_entries")
        .update({ start_time_id: null })
        .eq("event_id", id);

      // ── Step 3: delete old start times ────────────────────────────────────
      const { error: deleteErr } = await supabase
        .from("event_start_times")
        .delete()
        .eq("event_id", id);
      if (deleteErr) {
        setError(t("errorDeleteSlots", { error: deleteErr.message }));
        setLoading(false);
        return;
      }

      // ── Step 4: insert new start times ────────────────────────────────────
      const { DateTime } = await import("luxon");
      const friday = DateTime.fromISO(weekendStartDate, {
        zone: form.timezone,
      });
      const startTimeRows = specialStartTimes.map((st) => {
        const dayOffset =
          { friday: 0, saturday: 1, sunday: 2 }[st.day_of_week] || 0;
        const dt = friday
          .plus({ days: dayOffset })
          .set({ hour: st.hour, minute: st.minute, second: 0, millisecond: 0 });
        return {
          event_id: id,
          label: dt.setLocale("fr").toFormat("EEEE d MMMM yyyy").replace(/^\w/, (c) => c.toUpperCase()),
          irl_start: dt.toUTC().toISO(),
        };
      });

      const { data: newStartTimes } = await supabase
        .from("event_start_times")
        .insert(startTimeRows)
        .select("id, irl_start");

      // ── Step 5: remap signup preferred_start_time_ids and team entry start_time_id ──
      // Match old→new by irl_start (same UTC moment = same slot, just new ID).
      // Old IDs with no matching new time are dropped — they're genuinely gone.
      if (oldStartTimes?.length > 0 && newStartTimes?.length > 0) {
        // Build irl_start (as ISO string) → new_id lookup
        const newByIrlStart = Object.fromEntries(
          newStartTimes.map((slot) => [new Date(slot.irl_start).toISOString(), slot.id]),
        );
        // Build old_id → new_id map via matching irl_start
        const idRemap = Object.fromEntries(
          (oldStartTimes || []).flatMap((old) => {
            const newId = newByIrlStart[new Date(old.irl_start).toISOString()];
            return newId ? [[old.id, newId]] : [];
          }),
        );

        if (Object.keys(idRemap).length > 0) {
          // ── Signups: remap preferred_start_time_ids ──────────────────────
          // Fetch all signups for this event that have any preferred start time
          const { data: affectedSignups } = await supabase
            .from("signups")
            .select("id, preferred_start_time_ids")
            .eq("event_id", id)
            .not("preferred_start_time_ids", "eq", "{}");

          if (affectedSignups?.length > 0) {
            // For each signup, replace old IDs with new IDs and drop unresolvable ones
            await Promise.all(
              affectedSignups.map((signup) => {
                const remapped = (signup.preferred_start_time_ids || [])
                  .map((oldId) => idRemap[oldId]) // maps to new ID or undefined
                  .filter(Boolean); // drops unmatched (deleted) IDs
                return supabase
                  .from("signups")
                  .update({ preferred_start_time_ids: remapped })
                  .eq("id", signup.id);
              }),
            );
          }

          // ── Team entries: remap start_time_id ───────────────────────────
          // Uses the snapshot taken before nulling in Step 2 — by this point
          // start_time_id is null on all entries due to the FK constraint workaround.
          // Entries whose old start time has no equivalent in the new schedule stay null.
          if (teamEntriesSnapshot?.length > 0) {
            await Promise.all(
              teamEntriesSnapshot
                .filter((te) => te.start_time_id)
                .map((te) => {
                  const newStartTimeId = idRemap[te.start_time_id] || null;
                  return supabase
                    .from("team_entries")
                    .update({ start_time_id: newStartTimeId })
                    .eq("id", te.id);
                }),
            );
          }
        }
      }
    }

    setLoading(false);
    router.push(`/evenements/${id}`);
    router.refresh();
  };

  // Hard delete — removes the event and all associated data permanently.
  // Distinct from archiving which preserves the data with a snapshot.
  const handleDelete = () => {
    setConfirmModal({
      title: t("deleteEventTitle"),
      message: t("deleteEventMsg"),
      confirmLabel: t("deleteEventConfirm"),
      onConfirm: async () => {
        setConfirmModal(null);

        const { error: err } = await supabase
          .from("events")
          .delete()
          .eq("id", id);

        if (err) {
          setError(err.message);
          return;
        }

        router.push("/evenements");
        router.refresh();
      },
    });
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

  if (fetching)
    return (
      <div className="page">
        <p style={{ color: "var(--text-dim)" }}>{t("loading")}</p>
      </div>
    );
  if (!form)
    return (
      <div className="page">
        <div className="alert alert-error">{error}</div>
        <Link href="/evenements" className="btn btn-secondary">
          {t("back")}
        </Link>
      </div>
    );

  if (!authChecked)
    return (
      <div className="page">
        <p style={{ color: "var(--text-dim)" }}>{t("checkingAuth")}</p>
      </div>
    );
  return (
    <div className="page">
      <ConfirmModal
        modal={confirmModal}
        onConfirm={() => confirmModal?.onConfirm?.()}
        onCancel={() => setConfirmModal(null)}
      />
      <div className="page-header">
        <div>
          <h1>{t("titleEdit")}</h1>
          <div className="accent-line" />
        </div>
        <Link href={`/evenements/${id}`} className="btn btn-secondary">
          {t("back")}
        </Link>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <h3 style={{ marginBottom: "1.25rem", color: "var(--text-dim)" }}>
            {t("sectionGeneral")}
          </h3>
          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="name">{t("labelNameShort")}</label>
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
                <span>{t("labelSpecial")}</span>
              </label>
            </div>

            {isSpecial && (
              <div className="form-group">
                <label htmlFor="weekend_start_date">
                  {t("labelWeekendDate")}
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
                  {t("fridayHint")}
                </p>
              </div>
            )}
            <div className="form-group">
              <label htmlFor="format">{t("labelFormat")}</label>
              <select id="format" value={form.format} onChange={set("format")}>
                <option value="">{t("selectPlaceholder")}</option>
                {eventTypes.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label>{t("labelDuration")}</label>
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
                  {t("durationOther")}
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
                <span style={{ color: "var(--text-dim)" }}>{t("durationH")}</span>
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
                <span style={{ color: "var(--text-dim)" }}>{t("durationMin")}</span>
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
              <label htmlFor="timezone">{t("labelTimezone")}</label>
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
              <label htmlFor="notes">{t("labelNotes")}</label>
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
            {t("sectionCircuit")}
          </h3>
          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label>{t("labelCircuit")}</label>
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
                    // Reset layout selection when base track changes
                    setForm((prev) => ({ ...prev, circuit_id: "" }));
                  }}
                >
                  <option value="">{t("selectCircuit")}</option>
                  {circuitGroups.sorted.map(([baseName]) => (
                    <option key={baseName} value={baseName}>
                      {baseName}
                    </option>
                  ))}
                  {circuitGroups.unlinked.length > 0 && (
                    <optgroup label={t("circuitGroupOther")}>
                      {circuitGroups.unlinked.map((c) => (
                        <option key={c.id} value={`__direct__${c.id}`}>
                          {c.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>

                {/* Step 2 — layout (only shown when base track selected and has multiple layouts) */}
                {selectedBaseTrack &&
                  !selectedBaseTrack.startsWith("__direct__") &&
                  (() => {
                    const layouts =
                      circuitGroups.sorted.find(
                        ([name]) => name === selectedBaseTrack,
                      )?.[1] || [];
                    // Single layout — auto-select it
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
                        <option value="">{t("selectLayout")}</option>
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
          </div>
        </div>

        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <h3 style={{ marginBottom: "0.5rem", color: "var(--text-dim)" }}>
            {t("sectionIGTimes")}
          </h3>
          <p
            style={{
              fontSize: "0.8rem",
              color: "var(--text-dim)",
              marginBottom: "1.25rem",
            }}
          >
            {t("startTimesEditHint")}
          </p>
          <div className="form-grid">
            {/* Offset between the scheduled IRL start time and the actual green flag.
                Pre-fills the default strategy offset when a new strategy is created. */}
            <div className="form-group">
              <label htmlFor="green_flag_offset_minutes">
                {t("labelGreenFlagOffset")}
              </label>
              <input
                id="green_flag_offset_minutes"
                type="number"
                min={-60}
                max={120}
                value={form.green_flag_offset_minutes}
                onChange={set("green_flag_offset_minutes")}
                placeholder="0"
                style={{ fontFamily: "var(--font-mono), monospace" }}
              />
              <p
                style={{
                  fontSize: "0.78rem",
                  color: "var(--text-dim)",
                  marginTop: "0.4rem",
                }}
              >
                {t("greenFlagOffsetHintShort")}
              </p>
            </div>
            <div className="form-group">
              <label htmlFor="ig_start_time">{t("labelIGStart")}</label>
              <input
                id="ig_start_time"
                type="time"
                value={form.ig_start_time}
                onChange={set("ig_start_time")}
              />
            </div>
            <div className="form-group">
              <label htmlFor="ig_sunrise">{t("labelIGSunrise")}</label>
              <input
                id="ig_sunrise"
                type="time"
                value={form.ig_sunrise}
                onChange={set("ig_sunrise")}
              />
            </div>
            <div className="form-group">
              <label htmlFor="ig_sunset">{t("labelIGSunset")}</label>
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
              {loading ? t("saving") : t("submitSave")}
            </button>
            <Link href={`/evenements/${id}`} className="btn btn-secondary">
              {t("cancel")}
            </Link>
          </div>
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleDelete}
          >
            {t("deleteEventBtn")}
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
            {!previewStep ? (
              /* ── Step 1: ask whether to regenerate ── */
              <>
                <h3 style={{ marginBottom: "0.75rem" }}>{t("sectionRegenerate")}</h3>
                <p
                  style={{
                    fontSize: "0.9rem",
                    color: "var(--text-dim)",
                    marginBottom: "1.5rem",
                  }}
                >
                  {t("regenerateQuestion")}
                </p>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                  }}
                >
                  <button
                    onClick={handlePreviewRegen}
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? t("regenerateAnalyzing") : t("regenerateBtn")}
                  </button>
                  <button
                    onClick={() => {
                      setShowRegenModal(false);
                      setPreviewStep(false);
                      router.push(`/evenements/${id}`);
                      router.refresh();
                    }}
                    className="btn btn-secondary"
                  >
                    {t("saveWithoutRegenerate")}
                  </button>
                  <button
                    onClick={() => {
                      setShowRegenModal(false);
                      setPreviewStep(false);
                    }}
                    className="btn btn-danger btn-sm"
                  >
                    {t("cancelRegenerate")}
                  </button>
                </div>
              </>
            ) : (
              /* ── Step 2: preview losses, ask for confirmation ── */
              <>
                <h3 style={{ marginBottom: "0.75rem" }}>
                  {t("confirmRegenerateTitle")}
                </h3>

                {previewLosses.length === 0 &&
                previewTeamLosses.length === 0 ? (
                  <p
                    style={{
                      fontSize: "0.9rem",
                      color: "var(--text-dim)",
                      marginBottom: "1.5rem",
                    }}
                  >
                    {t("regenerateNoLoss")}
                  </p>
                ) : (
                  /* Some drivers will lose their preferred start times */
                  <div style={{ marginBottom: "1.5rem" }}>
                    <p
                      style={{
                        fontSize: "0.9rem",
                        color: "var(--text-dim)",
                        marginBottom: "0.75rem",
                      }}
                    >
                      ⚠️{" "}
                      {t("regenerateDriverLoss", { count: previewLosses.length })}
                    </p>
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: "1.25rem",
                        fontSize: "0.88rem",
                        color: "var(--danger)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.2rem",
                      }}
                    >
                      {previewLosses.map((name, i) => (
                        <li key={i}>{name}</li>
                      ))}
                    </ul>
                    <p
                      style={{
                        fontSize: "0.82rem",
                        color: "var(--text-dim)",
                        marginTop: "0.75rem",
                      }}
                    >
                      {t("regenerateDriverWarning")}
                    </p>
                  </div>
                )}

                {previewTeamLosses.length > 0 && (
                  <div style={{ marginBottom: "1.5rem" }}>
                    <p
                      style={{
                        fontSize: "0.9rem",
                        color: "var(--text-dim)",
                        marginBottom: "0.75rem",
                      }}
                    >
                      ⚠️{" "}
                      {t("regenerateEntryLoss", { count: previewTeamLosses.length })}
                    </p>
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: "1.25rem",
                        fontSize: "0.88rem",
                        color: "var(--danger)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.2rem",
                      }}
                    >
                      {previewTeamLosses.map((name, i) => (
                        <li key={i}>{name}</li>
                      ))}
                    </ul>
                    <p
                      style={{
                        fontSize: "0.82rem",
                        color: "var(--text-dim)",
                        marginTop: "0.75rem",
                      }}
                    >
                      {t("regenerateEntryWarning")}
                    </p>
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                  }}
                >
                  <button
                    onClick={handleRegen}
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? t("regenerateSaving") : t("regenerateConfirm")}
                  </button>
                  <button
                    onClick={() => {
                      setPreviewStep(false);
                    }}
                    className="btn btn-secondary"
                  >
                    {t("back")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
