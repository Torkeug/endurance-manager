"use client";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";

export default function CollapsibleSummary({
  entryId,
  startTime,
  startLabel,
  infoItems,
  streamUrls,
}) {
  const t = useTranslations("collapsibleSummary");
  const [collapsed, setCollapsed] = useState(false);

  // Persist collapsed state per team entry so each equipage remembers its own state.
  // Key includes entryId to avoid collisions between different team entries.
  useEffect(() => {
    const saved = localStorage.getItem(`equipage-summary-collapsed-${entryId}`);
    if (saved !== null) setCollapsed(saved === "true");
  }, []);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(`equipage-summary-collapsed-${entryId}`, String(next));
  };

  return (
    <div style={{ marginBottom: "2rem" }}>
      {/* When collapsed, show just the start time as a quick reference bar.
      Clicking anywhere on it expands the full summary. */}
      {collapsed ? (
        <div
          onClick={toggle}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--surface)",
            border: "1px solid var(--accent-dim)",
            borderRadius: "4px",
            padding: "0.6rem 1rem",
            cursor: "pointer",
            transition: "background 0.15s",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            {startTime ? (
              <>
                <div
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--text-dim)",
                  }}
                >
                  {t("startLabel")}
                </div>
                <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                  {startLabel}
                </div>
                <div
                  className="mono"
                  style={{ fontSize: "0.82rem", color: "var(--accent)" }}
                >
                  {t("startAt", { time: startTime })}
                </div>
              </>
            ) : (
              <div style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>
                {t("entrySummary")}
              </div>
            )}
          </div>
          <span style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>
            {t("expand")}
          </span>
        </div>
      ) : (
        <>
          {/* Start time card */}
          {startTime && (
            <div
              className="card"
              style={{
                marginBottom: "1rem",
                borderColor: "var(--accent-dim)",
                cursor: "pointer",
              }}
              onClick={toggle}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
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
                    {t("startTimeLabel")}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                    {startLabel}
                  </div>
                  <div
                    className="mono"
                    style={{ fontSize: "0.82rem", color: "var(--accent)" }}
                  >
                    {t("startAt", { time: startTime })}
                  </div>
                </div>
                <button
                  onClick={toggle}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-dim)",
                    cursor: "pointer",
                    fontSize: "0.82rem",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t("collapse")}
                </button>
              </div>
            </div>
          )}

          {/* Info grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
              gap: "0.75rem",
              marginBottom: "1rem",
            }}
          >
            {infoItems.map(({ label, value }) => (
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

{/* Streams */}
{streamUrls.length > 0 && (
  <div className="card" style={{ marginBottom: "1rem" }}>
    <div
      style={{
        fontSize: "0.7rem",
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "var(--text-dim)",
        marginBottom: "0.4rem",
      }}
    >
      {streamUrls.length > 1 ? t("streams") : t("stream")}
    </div>

    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      {streamUrls.map((url, idx) => (
        <a
          key={idx}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#9147ff", fontSize: "0.9rem" }}
        >
          {url} ↗
        </a>
      ))}
    </div>
  </div>
)}

          {!startTime && (
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginBottom: "0.5rem",
              }}
            >
              <button
                onClick={toggle}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-dim)",
                  cursor: "pointer",
                  fontSize: "0.82rem",
                }}
              >
                ▲ Réduire
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
