"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { supabaseBrowser as supabase } from "../../../../../lib/supabase-browser";
import React from "react";
import { useTranslations, useLocale } from "next-intl";

// ── Time helpers ───────────────────────────────────────────────────────────────

// Generate 30-minute slots covering the race window plus 1h buffer on each side.
function generateSlots(irlStart, durationMinutes) {
  const slots = [];
  const start = new Date(new Date(irlStart).getTime() - 60 * 60 * 1000);
  const end = new Date(
    new Date(irlStart).getTime() + (durationMinutes + 60) * 60 * 1000,
  );
  let current = new Date(start);
  current.setMinutes(Math.floor(current.getMinutes() / 30) * 30, 0, 0); // snap to 30-min boundary
  while (current <= end) {
    slots.push(new Date(current));
    current = new Date(current.getTime() + 30 * 60 * 1000);
  }
  return slots;
}

function getIGTime(irlSlot, irlStartStr, igStartTimeStr) {
  if (!igStartTimeStr || !irlStartStr) return null;
  const [igH, igM] = igStartTimeStr.split(":").map(Number);
  const irlStart = new Date(irlStartStr);
  const igStart = new Date(irlStart);
  igStart.setHours(igH, igM, 0, 0);
  return new Date(igStart.getTime() + (new Date(irlSlot) - irlStart)); // IG advances 1:1 with IRL time
}

function getPhase(igTime, sunriseStr, sunsetStr) {
  if (!igTime || !sunriseStr || !sunsetStr) return null;
  const minutes = igTime.getHours() * 60 + igTime.getMinutes();
  const [srH, srM] = sunriseStr.split(":").map(Number);
  const [ssH, ssM] = sunsetStr.split(":").map(Number);
  const sunrise = srH * 60 + srM;
  const sunset = ssH * 60 + ssM;
  // Normal: sunrise before sunset (e.g., 06:00 → 20:00)
  if (sunrise < sunset) {
    if (minutes >= sunrise + 30 && minutes < sunset - 30) return "☀️";
    if (minutes >= sunset + 30 || minutes < sunrise - 30) return "🌑";
    return "🌗";
  } else {
    // Inverted: IG start time crosses midnight (e.g., 22:00 → 06:00)
    if (minutes >= sunrise + 30 || minutes < sunset - 30) return "☀️";
    if (minutes >= sunset + 30 && minutes < sunrise - 30) return "🌑";
    return "🌗";
  }
}

function _formatTime(date, locale) {
  return date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function _formatDate(date, locale) {
  return date.toLocaleDateString(locale, {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
}

function sameDay(a, b) {
  return a.toDateString() === b.toDateString();
}

// Format driver name as "Prénom N." — first name(s) + surname initial.
// Matches the format used in InventoryMatrix.
function formatDriverName(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const firstName = parts.slice(0, -1).join(" ");
  const lastInitial = parts[parts.length - 1][0].toUpperCase();
  return `${firstName} ${lastInitial}.`;
}

function Badge({ label, bg, borderColor }) {
  return (
    <span
      style={{
        fontSize: "0.58rem",
        fontWeight: 700,
        color: "#fff",
        background: bg,
        border: `1px solid ${borderColor}`,
        padding: "1px 4px",
        borderRadius: "2px",
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  );
}

// Replaces native prompt() for wipe-all action — consistent with app modal pattern
function WipeModal({ onConfirm, onCancel }) {
  const t = useTranslations("availabilityGrid");
  const [input, setInput] = useState("");
  const confirmWord = t("clearAllConfirmWord");
  const valid = input === confirmWord;
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
      <div className="card" style={{ maxWidth: "420px", width: "100%" }}>
        <h3 style={{ marginBottom: "0.75rem" }}>{t("clearAllTitle")}</h3>
        <p style={{ fontSize: "0.9rem", color: "var(--text-dim)", marginBottom: "1rem" }}>
          {t("clearAllConfirmPrompt")}
        </p>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={confirmWord}
          autoFocus
          style={{ marginBottom: "1rem" }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <button onClick={onConfirm} className="btn btn-danger" disabled={!valid}>
            {t("clearAllConfirmBtn")}
          </button>
          <button onClick={onCancel} className="btn btn-secondary">
            {t("cancelBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AvailabilityGrid({
  teamEntryId,
  assignedDrivers,
  irlStart,
  durationMinutes,
  igStartTime,
  igSunrise,
  igSunset,
  archived = false,
  currentDriverId = null,
  isExternalUser = false,
}) {
  const t = useTranslations("availabilityGrid");
  const locale = useLocale();
  const formatTime = (d) => _formatTime(d, locale);
  const formatDate = (d) => _formatDate(d, locale);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [availabilities, setAvailabilities] = useState({});
  const [loading, setLoading] = useState(true);
  // notification overrides keyed by signup id.
  // notifications = actual discord_alert_enabled_override from DB (never falls back to defaults —
  // the checkbox only reflects whether a per-event override is active).
  // minutes = discord_alert_minutes_override if set, otherwise driver default as a pre-fill
  // so the input is convenient when the driver first enables an override.
  const [notifOverrides, setNotifOverrides] = useState(() =>
    Object.fromEntries(
      (assignedDrivers || []).map((d) => [
        d.id,
        {
          // null = no override set; true/false = explicit override
          notifications: d.discord_alert_enabled_override ?? null,
          minutes: d.discord_alert_minutes_override
            ?? d.drivers?.discord_alert_minutes
            ?? "",
        },
      ]),
    ),
  );

  const isDragging = useRef(false);
  const dragValue = useRef(null);
  const pendingUpdates = useRef({});
  const [dragPreview, setDragPreview] = useState({});
  const [dragMode, setDragMode] = useState("available");
  const [wipeModal, setWipeModal] = useState(false);

  const slots = irlStart ? generateSlots(irlStart, durationMinutes || 0) : [];
  const raceStart = irlStart ? new Date(irlStart) : null;
  const raceEnd =
    raceStart && durationMinutes
      ? new Date(raceStart.getTime() + durationMinutes * 60 * 1000)
      : null;

  useEffect(() => {
    if (!teamEntryId) return;
    supabase
      .from("availabilities")
      .select("*")
      .eq("team_entry_id", teamEntryId)
      .then(({ data }) => {
        const map = {};
        (data || []).forEach((a) => {
          const key = `${a.driver_id}_${new Date(a.slot_start).toISOString()}`;
          map[key] = a;
        });
        setAvailabilities(map);
        setLoading(false);
      });
  }, [teamEntryId]);

  // Realtime — keeps availability slots live for all concurrent users
  useEffect(() => {
    if (!teamEntryId) return;
    const channel = supabase
      .channel(`availability-live-${teamEntryId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "availabilities", filter: `team_entry_id=eq.${teamEntryId}` },
        (payload) => {
          const row = payload.new || payload.old;
          if (!row?.driver_id || !row?.slot_start) return;
          const key = `${row.driver_id}_${new Date(row.slot_start).toISOString()}`;
          setAvailabilities((prev) => {
            if (payload.eventType === "DELETE") {
              const next = { ...prev };
              delete next[key];
              return next;
            }
            return { ...prev, [key]: payload.new };
          });
        },
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [teamEntryId]);

  // Auto-select external drivers — they can only edit their own availability
  useEffect(() => {
    if (isExternalUser && currentDriverId) {
      setSelectedDriverId(currentDriverId);
    }
  }, [isExternalUser, currentDriverId]);

  const saveNotifOverride = (signupId, patch) => {
    const current = notifOverrides[signupId] || { notifications: null, minutes: "" };
    const merged = { ...current, ...patch };
    setNotifOverrides((prev) => ({ ...prev, [signupId]: merged }));
    supabase
      .from("signups")
      .update({
        discord_alert_enabled_override: merged.notifications,
        discord_alert_minutes_override: merged.minutes
          ? Math.max(1, parseInt(merged.minutes))
          : null,
      })
      .eq("id", signupId)
      .then(({ error }) => {
        if (error) console.error("[saveNotifOverride]", error.message, { signupId, merged });
      });
  };

  const getAvail = (driverId, slot) =>
    availabilities[`${driverId}_${slot.toISOString()}`];

  const getSlotState = (driverId, slot) => {
    const key = `${driverId}_${slot.toISOString()}`;
    if (dragPreview[key] !== undefined) return dragPreview[key];
    const record = getAvail(driverId, slot);
    // No DB row = truly unset — returns undefined, not false
    // Pre-population on assign ensures all slots have rows, so undefined
    // means the driver was assigned before pre-population was introduced.
    if (!record) return undefined;
    return record.available;
  };

  // All drag handlers bail out immediately when archived
  const startDrag = (slot) => {
    if (archived || !selectedDriverId) return;
    isDragging.current = true;
    dragValue.current =
      dragMode === "available"
        ? true
        : dragMode === "unavailable"
          ? false
          : null; // null = "tentative" in DB — maps to orange cell color
    pendingUpdates.current = {};
    applyDrag(slot);
  };

  const applyDrag = (slot) => {
    if (archived || !isDragging.current || !selectedDriverId) return;
    const key = `${selectedDriverId}_${slot.toISOString()}`;
    if (pendingUpdates.current[key] !== undefined) return;
    pendingUpdates.current[key] = { slot, value: dragValue.current };
    setDragPreview((prev) => ({ ...prev, [key]: dragValue.current }));
  };

  const commitDrag = useCallback(async () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const updates = Object.values(pendingUpdates.current);
    pendingUpdates.current = {};
    setDragPreview({});
    if (updates.length === 0) return;

    const rows = updates.map(({ slot, value }) => ({
      team_entry_id: teamEntryId,
      driver_id: selectedDriverId,
      slot_start: slot.toISOString(),
      available: value,
      updated_at: new Date().toISOString(),
    }));

    setAvailabilities((prev) => {
      const next = { ...prev };
      rows.forEach((row) => {
        next[`${row.driver_id}_${row.slot_start}`] = row;
      });
      return next;
    });

    const { error: upsertError } = await supabase
      .from("availabilities")
      .upsert(rows, { onConflict: "team_entry_id,driver_id,slot_start" });
    if (upsertError) console.error("Upsert error:", upsertError);
  }, [selectedDriverId, teamEntryId]);

  useEffect(() => {
    const end = () => commitDrag();
    window.addEventListener("mouseup", end);
    window.addEventListener("touchend", end);
    return () => {
      window.removeEventListener("mouseup", end);
      window.removeEventListener("touchend", end);
    };
  }, [commitDrag]);

  const isRaceStart = (slot) =>
    raceStart && Math.abs(slot - raceStart) < 15 * 60 * 1000; // half-slot window to catch the nearest 30-min slot
  const isRaceEnd = (slot) =>
    raceEnd && Math.abs(slot - raceEnd) < 15 * 60 * 1000;
  const isAfterEnd = (slot) => raceEnd && slot > raceEnd;

  const getRowStyle = (slot) => {
    if (isRaceStart(slot))
      return {
        background: "rgba(46,180,96,0.10)",
        borderTop: "2px solid #2eb460",
        borderBottom: "2px solid #2eb460",
      };
    if (isRaceEnd(slot))
      return {
        background: "rgba(224,85,85,0.08)",
        borderTop: "2px solid var(--danger)",
        borderBottom: "2px solid var(--danger)",
      };
    if (isAfterEnd(slot))
      return { background: "rgba(0,0,0,0.18)", opacity: 0.55 };
    return {};
  };

  const getStickyBg = (slot) => {
    if (isRaceStart(slot)) return "rgba(46,180,96,0.15)";
    if (isRaceEnd(slot)) return "rgba(224,85,85,0.12)";
    if (isAfterEnd(slot)) return "#0d0d18";
    return "var(--bg)";
  };

  const driverCounts = assignedDrivers.reduce((acc, d) => {
    const id = d.drivers?.id;
    // Count all slots that have been explicitly set (any state except undefined)
    acc[id] = slots.filter((s) => getSlotState(id, s) !== undefined).length;
    return acc;
  }, {});

  const TH = {
    background: "var(--surface-2)",
    color: "var(--text-dim)",
    fontSize: "0.68rem",
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    padding: "0.5rem 0.4rem",
    borderBottom: "2px solid var(--border)",
    whiteSpace: "nowrap",
    userSelect: "none",
    textAlign: "center",
  };

  const TD = {
    padding: "0.2rem 0.4rem",
    borderBottom: "1px solid var(--border)",
    verticalAlign: "middle",
    fontSize: "0.8rem",
    userSelect: "none",
    textAlign: "center",
  };

  if (!irlStart)
    return (
      <div className="card">
        <div className="empty">{t("noStartTimes")}</div>
      </div>
    );
  if (assignedDrivers.length === 0)
    return (
      <div className="card">
        <div className="empty">{t("noDrivers")}</div>
      </div>
    );

  return (
    <div>
      {/* Driver selector + controls — hidden when archived */}
      {!archived && (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <div className="form-group">
            <label>
              {isExternalUser
                ? t("yourAvailability")
                : t("fillMyAvailability")}
            </label>
            {/* External drivers are auto-selected — no dropdown needed */}
            {!isExternalUser && (
              <select
                value={selectedDriverId}
                onChange={(e) => setSelectedDriverId(e.target.value)}
              >
                <option value="">{t("selectNamePlaceholder")}</option>
                {assignedDrivers
                  // External drivers can only select themselves
                  .filter(
                    (d) => !isExternalUser || d.drivers?.id === currentDriverId,
                  )
                  .map((d) => (
                    <option key={d.drivers?.id} value={d.drivers?.id}>
                      {d.drivers?.name}
                    </option>
                  ))}
              </select>
            )}
          </div>
          <p
            style={{
              fontSize: "0.78rem",
              color: selectedDriverId ? "var(--accent)" : "var(--text-dim)",
              marginTop: "0.5rem",
            }}
          >
            {selectedDriverId
              ? t("clickDragHint")
              : t("selectNameHint")}
          </p>

          {/* Paint mode selector */}
          {selectedDriverId && (
            <div className="card" style={{ marginBottom: "1rem" }}>
              <div
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-dim)",
                  marginBottom: "0.5rem",
                }}
              >
                {t("inputMode")}
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {[
                  { value: "available", label: t("available"), color: "var(--accent)" },
                  { value: "unavailable", label: t("unavailable"), color: "var(--danger)" },
                  { value: "tentative", label: t("uncertain"), color: "#3a8080" },
                ].map(({ value, label, color }) => (
                  <button
                    key={value}
                    onClick={() => setDragMode(value)}
                    style={{
                      padding: "0.4rem 0.85rem",
                      borderRadius: "3px",
                      border: "1px solid",
                      borderColor: dragMode === value ? color : "var(--border)",
                      background:
                        dragMode === value ? `${color}22` : "var(--surface-2)",
                      color: dragMode === value ? color : "var(--text-dim)",
                      fontFamily: "var(--font-rajdhani), sans-serif",
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Bulk actions */}
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              marginTop: "0.75rem",
              flexWrap: "wrap",
            }}
          >
            {selectedDriverId && (
              <button
                onClick={async () => {
                  const updates = slots.map((slot) => ({
                    team_entry_id: teamEntryId,
                    driver_id: selectedDriverId,
                    slot_start: slot.toISOString(),
                    available: true,
                    updated_at: new Date().toISOString(),
                  }));
                  setAvailabilities((prev) => {
                    const next = { ...prev };
                    updates.forEach((u) => {
                      next[`${u.driver_id}_${u.slot_start}`] = u;
                    });
                    return next;
                  });
                  await supabase.from("availabilities").upsert(updates, {
                    onConflict: "team_entry_id,driver_id,slot_start",
                  });
                }}
                className="btn btn-primary btn-sm"
              >
                {t("markAllAvailable")}
              </button>
            )}

            {/* Wipe all — modal with typed confirmation to prevent accidents */}
            {!selectedDriverId && (
              <>
                {wipeModal && (
                  <WipeModal
                    onConfirm={async () => {
                      setWipeModal(false);
                      const updates = assignedDrivers.flatMap((d) =>
                        slots.map((slot) => ({
                          team_entry_id: teamEntryId,
                          driver_id: d.drivers?.id,
                          slot_start: slot.toISOString(),
                          available: false,
                          updated_at: new Date().toISOString(),
                        })),
                      );
                      setAvailabilities((prev) => {
                        const next = { ...prev };
                        updates.forEach((u) => {
                          next[`${u.driver_id}_${u.slot_start}`] = u;
                        });
                        return next;
                      });
                      await supabase.from("availabilities").upsert(updates, {
                        onConflict: "team_entry_id,driver_id,slot_start",
                      });
                    }}
                    onCancel={() => setWipeModal(false)}
                  />
                )}
                <button
                  onClick={() => setWipeModal(true)}
                  className="btn btn-danger btn-sm"
                >
                  {t("clearAll")}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Discord notification override — shown to the current driver once they select themselves */}
      {!archived && selectedDriverId === currentDriverId && (() => {
        const mySignup = assignedDrivers.find((d) => d.drivers?.id === currentDriverId);
        if (!mySignup) return null;
        const notif = notifOverrides[mySignup.id] || { notifications: false, minutes: "" };
        return (
          <div className="card" style={{ marginBottom: "1rem" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "0.75rem",
              }}
            >
              {/* Discord logo */}
              <svg
                viewBox="0 0 24 24"
                fill="#5865F2"
                style={{ width: 18, height: 18, flexShrink: 0 }}
              >
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.001.033.022.063.044.083a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
              <span
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  color: "var(--text-dim)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {t("discordAlert")}
              </span>
            </div>
            {/* null = no override, inherit default; true = override: alerts on; false = override: alerts off */}
            {notif.notifications === null && (
              <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: "0.5rem" }}>
                {t("discordDefault")}
              </div>
            )}

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                cursor: "pointer",
                fontSize: "0.85rem",
              }}
            >
              <input
                type="checkbox"
                checked={
                  notif.notifications !== null
                    ? notif.notifications === true
                    : mySignup.drivers?.discord_alert_enabled ?? false
                }
                onChange={(e) =>
                  saveNotifOverride(mySignup.id, { notifications: e.target.checked })
                }
              />
              {t("discordEnable")}
            </label>
            {(notif.notifications === true ||
              (notif.notifications === null && mySignup.drivers?.discord_alert_enabled)) && (
              <div style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <label
                  htmlFor="notif-minutes-override"
                  style={{ fontSize: "0.85rem", color: "var(--text-dim)", whiteSpace: "nowrap" }}
                >
                  {t("discordNotify")}
                </label>
                <input
                  id="notif-minutes-override"
                  type="number"
                  value={notif.minutes}
                  onChange={(e) => saveNotifOverride(mySignup.id, { minutes: e.target.value })}
                  min="1"
                  max="60"
                  placeholder="5"
                  style={{ width: "60px" }}
                />
                <span style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>
                  {t("discordMinutesBefore")}
                </span>
              </div>
            )}
          </div>
        );
      })()}

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: "1.25rem",
          marginBottom: "0.75rem",
          fontSize: "0.78rem",
          color: "var(--text-dim)",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <span
            style={{
              width: 14,
              height: 14,
              background: "#1a3a1a",
              border: "1px solid #2eb460",
              borderRadius: 2,
              display: "inline-block",
            }}
          />
          {t("legendAvailable")}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <span
            style={{
              width: 14,
              height: 14,
              background: "rgba(212, 144, 74, 0.15)",
              border: "1px solid #d4904a",
              borderRadius: 2,
              display: "inline-block",
            }}
          />
          {t("legendUncertain")}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <span
            style={{
              width: 14,
              height: 14,
              background: "#3a1010",
              border: "1px solid var(--danger)",
              borderRadius: 2,
              display: "inline-block",
            }}
          />
          {t("legendUnavailable")}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <Badge label="▶" bg="#2eb460" borderColor="#2eb460" />
          {t("legendStart")}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <Badge label="■" bg="var(--danger)" borderColor="var(--danger)" />
          {t("legendEnd")}
        </span>
        {!archived && (
          <span>{t("clickDragApply")}</span>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="card">
          <div className="empty">{t("loading")}</div>
        </div>
      ) : (
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: "4px",
            maxHeight: "65vh",
            overflowY: "auto",
            overflowX: "auto",
            width: "100%",
          }}
        >
          <table
            style={{
              borderCollapse: "collapse",
              width: "100%",
              minWidth: `${160 + assignedDrivers.length * 52}px`, // 160px base (IRL+IG+phase cols) + 52px per driver col
            }}
          >
            <thead style={{ position: "sticky", top: 0, zIndex: 3 }}>
              <tr>
                <th
                  style={{
                    ...TH,
                    textAlign: "left",
                    position: "sticky",
                    left: 0,
                    zIndex: 4, // above sticky thead (3) and sticky left column (1) — intersection cell
                    minWidth: "56px",
                    width: "56px",
                  }}
                >
                  IRL
                </th>
                <th style={{ ...TH, minWidth: "52px" }}>IG</th>
                <th style={{ ...TH, width: "30px" }}>⏱</th>
                {assignedDrivers.map((d) => (
                  <th
                    key={d.drivers?.id}
                    style={{
                      ...TH,
                      minWidth: "50px",
                      color:
                        d.drivers?.id === selectedDriverId
                          ? "var(--accent)"
                          : "var(--text-dim)",
                    }}
                  >
                    <div>{formatDriverName(d.drivers?.name)}</div>
                    <div
                      style={{
                        fontSize: "0.58rem",
                        fontWeight: 400,
                        color: "var(--text-dim)",
                      }}
                    >
                      {driverCounts[d.drivers?.id] || 0}×30m
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slots.map((slot, i) => {
                const igTime = getIGTime(slot, irlStart, igStartTime);
                const phase = getPhase(igTime, igSunrise, igSunset);
                const newDay = i > 0 && !sameDay(slots[i - 1], slot);
                const rowStyle = getRowStyle(slot);

                return (
                  <React.Fragment key={slot.toISOString()}>
                    {newDay && (
                      <tr>
                        <td
                          colSpan={3 + assignedDrivers.length}
                          style={{
                            background: "var(--surface-2)",
                            padding: "0.3rem 0.75rem",
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            color: "var(--text-dim)",
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            borderBottom: "1px solid var(--border)",
                            borderTop: "2px solid var(--border)",
                          }}
                        >
                          {formatDate(slot)}
                        </td>
                      </tr>
                    )}
                    <tr style={rowStyle}>
                      <td
                        style={{
                          ...TD,
                          textAlign: "left",
                          position: "sticky",
                          left: 0,
                          zIndex: 1,
                          background: getStickyBg(slot),
                          borderRight: "1px solid var(--border)",
                          width: "56px",
                          minWidth: "56px",
                          padding: "0.2rem 0.3rem",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "3px",
                            flexWrap: "nowrap",
                          }}
                        >
                          <span
                            className="mono"
                            style={{
                              fontSize: "0.8rem",
                              fontWeight: 400,
                              color: isRaceStart(slot)
                                ? "#2eb460"
                                : isRaceEnd(slot)
                                  ? "var(--danger)"
                                  : "var(--text)",
                            }}
                          >
                            {formatTime(slot)}
                          </span>
                          {isRaceStart(slot) && (
                            <Badge
                              label="▶"
                              bg="#2eb460"
                              borderColor="#2eb460"
                            />
                          )}
                          {isRaceEnd(slot) && (
                            <Badge
                              label="■"
                              bg="var(--danger)"
                              borderColor="var(--danger)"
                            />
                          )}
                        </div>
                      </td>

                      <td style={TD}>
                        <span
                          className="mono"
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--text-dim)",
                          }}
                        >
                          {igTime ? formatTime(igTime) : "—"}
                        </span>
                      </td>

                      <td style={{ ...TD, fontSize: "0.85rem" }}>
                        {phase || ""}
                      </td>

                      {assignedDrivers.map((d) => {
                        const driverId = d.drivers?.id;
                        // When archived, no cell is interactive
                        const isMe = !archived && driverId === selectedDriverId;
                        const state = getSlotState(driverId, slot);

                        const cellBg =
                          state === true
                            ? "#1a3a1a"
                            : state === false
                              ? "#3a1010"
                              : state === null
                                ? "rgba(212, 144, 74, 0.15)"
                                : isMe
                                  ? "var(--surface-2)"
                                  : "transparent";
                        const cellBorder =
                          state === true
                            ? "#2eb460"
                            : state === false
                              ? "var(--danger)"
                              : state === null
                                ? "#d4904a"
                                : isMe
                                  ? "var(--border)"
                                  : "transparent";

                        return (
                          <td
                            key={driverId}
                            style={{ ...TD, padding: "2px 3px" }}
                            onMouseDown={() => isMe && startDrag(slot)}
                            onMouseEnter={() => isMe && applyDrag(slot)}
                            onTouchStart={(e) => {
                              if (!isMe) return;
                              e.preventDefault();
                              startDrag(slot);
                            }}
                            onTouchMove={(e) => {
                              if (!isMe || !isDragging.current) return;
                              e.preventDefault();
                              const touch = e.touches[0];
                              const el = document.elementFromPoint(
                                touch.clientX,
                                touch.clientY,
                              );
                              if (el?.dataset?.slot)
                                applyDrag(new Date(el.dataset.slot));
                            }}
                          >
                            <div
                              data-slot={slot.toISOString()} // touch target: elementFromPoint reads this to identify slot on drag
                              style={{
                                width: "100%",
                                height: "22px",
                                border: "1px solid",
                                borderColor: cellBorder,
                                borderRadius: "3px",
                                background: cellBg,
                                cursor: isMe ? "pointer" : "default",
                                transition: "background 0.08s",
                              }}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
