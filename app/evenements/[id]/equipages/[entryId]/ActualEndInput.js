"use client";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { formatTimeInZone, utcToInputValues, localToUTC } from "../../../../../lib/timezone";

export default function ActualEndInput({
  plannedEnd,
  actualEnd,
  onSave,
  saving,
  archived = false,
  timezone = "Europe/Paris",
}) {
  // Default date to planned end date so the user only needs to enter the time.
  // If an actual end is already saved, pre-fill both date and time from it.
  // Use timezone-aware helpers so the date/time match the event's local timezone,
  // not the browser's timezone (which would be wrong for cross-timezone users).
  const initDate = actualEnd
    ? utcToInputValues(actualEnd, timezone).date
    : plannedEnd
      ? utcToInputValues(plannedEnd, timezone).date
      : "";

  const initTime = actualEnd
    ? formatTimeInZone(actualEnd, timezone)
    : "";

  const [time, setTime] = useState(initTime);
  const [date, setDate] = useState(initDate);
  // Date is hidden by default — most actual ends are on the same day as planned.
  // The toggle avoids cluttering the grid for the common case.
  const [showDate, setShowDate] = useState(false);

  // Reset inputs when plannedEnd changes (e.g. stint recalculated) and no actual end is set.
  // Resets form fields when actualEnd is cleared — prop-driven state sync.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (!actualEnd) {
      setTime("");
      setDate(plannedEnd ? utcToInputValues(plannedEnd, timezone).date : "");
      setShowDate(false);
    }
  }, [plannedEnd]);

  const handleTimeChange = (val) => {
    setTime(val);
    if (val && date) {
      const utc = localToUTC(date, val, timezone);
      if (utc) onSave(utc);
    }
  };

  const handleDateChange = (val) => {
    setDate(val);
    if (val && time) {
      const utc = localToUTC(val, time, timezone);
      if (utc) onSave(utc);
    }
  };

  const handleClear = () => {
    setTime("");
    setDate(plannedEnd ? utcToInputValues(plannedEnd, timezone).date : "");
    setShowDate(false);
    onSave(null);
  };

  const t = useTranslations("actualEndInput");
  const isSet = !!actualEnd;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "2px",
        minWidth: "80px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
        <input
          type="time"
          value={time}
          onChange={(e) => handleTimeChange(e.target.value)}
          disabled={archived || saving}
          style={{
            background: "var(--surface)",
            border: "1px solid",
            borderColor: isSet ? "var(--accent)" : "var(--border)",
            borderRadius: "3px",
            color: isSet ? "var(--accent)" : "var(--text)",
            fontFamily: "var(--font-mono), monospace",
            fontSize: "0.78rem",
            padding: "0.2rem 0.3rem",
            width: "90px",
          }}
        />
        {isSet && !archived && (
          <button
            onClick={handleClear}
            title={t("clearTitle")}
            style={{
              background: "none",
              border: "none",
              color: "var(--danger)",
              cursor: "pointer",
              fontSize: "0.85rem",
              lineHeight: 1,
              padding: "0 2px",
            }}
          >
            ×
          </button>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
        <button
          onClick={() => setShowDate(!showDate)}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-dim)",
            cursor: "pointer",
            fontSize: "0.65rem",
            padding: 0,
            textDecoration: "underline",
          }}
        >
          {showDate ? t("hideDate") : t("showDate")}
        </button>
        {showDate && (
          <input
            type="date"
            value={date}
            onChange={(e) => handleDateChange(e.target.value)}
            disabled={archived}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "3px",
              color: "var(--text)",
              fontFamily: "var(--font-mono), monospace",
              fontSize: "0.72rem",
              padding: "0.15rem 0.3rem",
              width: "110px",
            }}
          />
        )}
      </div>
    </div>
  );
}
