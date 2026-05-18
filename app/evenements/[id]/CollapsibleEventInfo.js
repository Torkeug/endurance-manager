"use client";
import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

function resolveDiscordTimestamps(text) {
  return text.replace(/<t:(\d+):([tTdDfFR])>/g, (match, ts, format) => {
    const date = new Date(parseInt(ts, 10) * 1000);
    const locale = "fr-FR";
    switch (format) {
      case "t":
        return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
      case "T":
        return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      case "d":
        return date.toLocaleDateString(locale);
      case "D":
        return date.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
      case "f":
        return date.toLocaleString(locale, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
      case "F":
        return date.toLocaleString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
      case "R": {
        const diff = date - Date.now();
        const abs = Math.abs(diff);
        const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
        if (abs < 60_000) return rtf.format(Math.round(diff / 1000), "second");
        if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), "minute");
        if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), "hour");
        return rtf.format(Math.round(diff / 86_400_000), "day");
      }
      default:
        return match;
    }
  });
}

const markdownComponents = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul style={{ paddingLeft: "1.5rem", marginBottom: "0.5rem", listStyleType: "disc" }}>
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol style={{ paddingLeft: "1.5rem", marginBottom: "0.5rem", listStyleType: "decimal" }}>
      {children}
    </ol>
  ),
  li: ({ children }) => <li style={{ marginBottom: "0.15rem" }}>{children}</li>,
  p: ({ children }) => <p style={{ marginBottom: "0.5rem" }}>{children}</p>,
  h1: ({ children }) => (
    <h1 style={{ fontSize: "1.3rem", fontWeight: 700, textTransform: "none", letterSpacing: "normal", marginBottom: "0.4rem" }}>
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 style={{ fontSize: "1.1rem", fontWeight: 700, textTransform: "none", letterSpacing: "normal", marginBottom: "0.35rem" }}>
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 style={{ fontSize: "1rem", fontWeight: 600, textTransform: "none", letterSpacing: "normal", marginBottom: "0.3rem" }}>
      {children}
    </h3>
  ),
  blockquote: ({ children }) => (
    <blockquote style={{ borderLeft: "3px solid var(--border)", paddingLeft: "0.75rem", color: "var(--text-dim)", margin: "0.5rem 0" }}>
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.85em", background: "var(--surface-2)", padding: "0.1em 0.3em", borderRadius: "3px" }}>
      {children}
    </code>
  ),
};

// Collapsible info grid + notes panel for the event detail page.
// When collapsed, shows a condensed one-line summary of the first 4 items
// (Circuit · Format · Durée · Départ IG) so key facts are always visible.
// Collapse state is persisted per event in localStorage.
export default function CollapsibleEventInfo({ eventId, items, notes }) {
  const [collapsed, setCollapsed] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);

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

  // Condensed summary: values of the first 4 items joined with ·
  // Assumes page.js sends items in order: Circuit · Format · Durée · Départ IG
  const condensed = items
    .slice(0, 4)
    .map((item) => item.value)
    .filter((v) => v && v !== "—")
    .join(" · ");

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      {/* Toggle button — shows condensed summary inline when collapsed */}
      <button
        onClick={toggle}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0 0 0.75rem 0",
          width: "100%",
          textAlign: "left",
        }}
      >
        <span
          style={{
            fontSize: "0.6rem",
            color: "var(--text-dim)",
            flexShrink: 0,
          }}
        >
          {collapsed ? "▶" : "▼"}
        </span>
        <span
          style={{
            fontSize: "0.72rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-dim)",
            flexShrink: 0,
          }}
        >
          Informations
        </span>
        {/* Condensed summary — only visible when collapsed */}
        {collapsed && condensed && (
          <span
            style={{
              fontSize: "0.82rem",
              color: "var(--text-dim)",
              fontWeight: 400,
              letterSpacing: 0,
              textTransform: "none",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            — {condensed}
          </span>
        )}
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
          {notes && (() => {
            const isLong = notes.length > 100 || notes.includes("\n");
            return (
              <div className="card">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "0.5rem",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "var(--text-dim)",
                    }}
                  >
                    Notes
                  </div>
                  {isLong && (
                    <button
                      onClick={() => setNotesExpanded((v) => !v)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "0.75rem",
                        color: "var(--accent)",
                        padding: "0 0.25rem",
                      }}
                    >
                      {notesExpanded ? "Voir moins" : "Voir plus"}
                    </button>
                  )}
                </div>
                <div
                  style={{
                    color: "var(--text)",
                    fontSize: "0.95rem",
                    overflowWrap: "break-word",
                    ...(isLong && !notesExpanded
                      ? {
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }
                      : {}),
                  }}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkBreaks]}
                    components={markdownComponents}
                  >
                    {resolveDiscordTimestamps(notes)}
                  </ReactMarkdown>
                </div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
