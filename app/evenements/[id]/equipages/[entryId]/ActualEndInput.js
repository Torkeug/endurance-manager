"use client";
import { useState, useEffect } from "react";

export default function ActualEndInput({
  plannedEnd,
  actualEnd,
  onSave,
  saving,
  archived = false,
}) {
  const planned = plannedEnd ? new Date(plannedEnd) : null;

  // Default date to planned end date so the user only needs to enter the time.
  // If an actual end is already saved, pre-fill both date and time from it.
  const initDate = actualEnd
    ? new Date(actualEnd).toISOString().slice(0, 10)
    : planned
      ? planned.toISOString().slice(0, 10)
      : "";

  const initTime = actualEnd
    ? new Date(actualEnd).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : "";

  const [time, setTime] = useState(initTime);
  const [date, setDate] = useState(initDate);
  // Date is hidden by default — most actual ends are on the same day as planned.
  // The toggle avoids cluttering the grid for the common case.
  const [showDate, setShowDate] = useState(false);
  const [editing, setEditing] = useState(false);

  // Reset inputs when plannedEnd changes (e.g. stint recalculated) and no actual end is set.
  // Keeps the date default in sync with the new planned end.
  useEffect(() => {
    if (!actualEnd) {
      setTime("");
      setDate(planned ? planned.toISOString().slice(0, 10) : "");
      setShowDate(false);
    }
  }, [plannedEnd]);

  const handleTimeChange = (val) => {
    setTime(val);
    if (val && date) {
      const dt = new Date(`${date}T${val}:00`);
      if (!isNaN(dt)) onSave(dt.toISOString());
    }
  };

  const handleDateChange = (val) => {
    setDate(val);
    if (val && time) {
      const dt = new Date(`${val}T${time}:00`);
      if (!isNaN(dt)) onSave(dt.toISOString());
    }
  };

  const handleClear = () => {
    setTime("");
    setDate(planned ? planned.toISOString().slice(0, 10) : "");
    setShowDate(false);
    onSave(null);
  };

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
            title="Effacer"
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
          {showDate ? "▲ date" : "▼ date"}
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
