"use client";
import { useState, useEffect } from "react";

// Collapsible info grid + notes panel for the event detail page.
// Collapse state is persisted per event in localStorage.
export default function CollapsibleEventInfo({ eventId, items, notes }) {
  const [collapsed, setCollapsed] = useState(false);

  // Read persisted state in useEffect — never in useState initializer
  // to avoid hydration mismatch (server has no localStorage).
  useEffect(() => {
    const saved = localStorage.getItem(`event-info-${eventId}`);
    if (saved !== null) setCollapsed(saved === "true");
  }, [eventId]);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(`event-info-${eventId}`, String(next));
  };

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      {/* Toggle button */}
      <button
        onClick={toggle}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          color: "var(--text-dim)",
          fontSize: "0.72rem",
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          padding: "0 0 0.75rem 0",
        }}
      >
        <span style={{ fontSize: "0.6rem" }}>{collapsed ? "▶" : "▼"}</span>
        Informations
      </button>

      {!collapsed && (
        <>
          {/* Info grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: "0.75rem",
              marginBottom: notes ? "1rem" : 0,
            }}
          >
            {items.map(({ label, value }) => (
              <div key={label} className="card" style={{ padding: "0.85rem" }}>
                <div
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--text-dim)",
                    marginBottom: "0.35rem",
                  }}
                >
                  {label}
                </div>
                <div
                  className="mono"
                  style={{ fontSize: "0.9rem", color: "var(--text)" }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>

          {/* Notes card — only rendered when notes exist */}
          {notes && (
            <div className="card">
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
                Notes
              </div>
              <p style={{ color: "var(--text)", fontSize: "0.95rem" }}>
                {notes}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
