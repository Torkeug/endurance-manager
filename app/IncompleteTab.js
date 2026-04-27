"use client";
import { useState, useEffect } from "react";

// Thin client shell for the "Suivi" sub-tabs.
// All section content is server-rendered and passed as JSX props.
export default function IncompleteTab({
  noDriversSection,
  noStintsSection,
  unassignedSection,
  noDriversCount,
  noStintsCount,
  unassignedCount,
}) {
  const [activeTab, setActiveTab] = useState("noDrivers");

  // Read persisted sub-tab in useEffect — never in useState to avoid hydration mismatch
  useEffect(() => {
    const saved = localStorage.getItem("home-incomplete-tab");
    if (["noDrivers", "noStints", "unassigned"].includes(saved))
      setActiveTab(saved);
  }, []);

  const switchTab = (tabId) => {
    setActiveTab(tabId);
    localStorage.setItem("home-incomplete-tab", tabId);
  };

  const tabs = [
    { id: "noDrivers", label: "Sans pilotes", count: noDriversCount },
    { id: "noStints", label: "Sans relais", count: noStintsCount },
    { id: "unassigned", label: "Sans équipage", count: unassignedCount },
  ];

  return (
    <div>
      {/* Sub-tab bar */}
      <div
        style={{
          display: "flex",
          gap: "0.25rem",
          borderBottom: "1px solid var(--border)",
          marginBottom: "1.5rem",
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => switchTab(tab.id)}
            style={{
              padding: "0.6rem 1.25rem",
              background: "transparent",
              border: "none",
              borderBottom:
                activeTab === tab.id
                  ? "2px solid var(--danger)"
                  : "2px solid transparent",
              color: activeTab === tab.id ? "var(--danger)" : "var(--text-dim)",
              fontFamily: "var(--font-rajdhani), sans-serif",
              fontSize: "0.9rem",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: "pointer",
              transition: "color 0.15s",
              marginBottom: "-1px",
              whiteSpace: "nowrap",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            {tab.label}
            {/* Count badge — always danger-colored since all sub-tabs are alert categories */}
            {tab.count > 0 && (
              <span
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  padding: "0.05rem 0.35rem",
                  borderRadius: "10px",
                  background:
                    activeTab === tab.id
                      ? "var(--danger)"
                      : "rgba(224,85,85,0.15)",
                  color: activeTab === tab.id ? "#fff" : "var(--danger)",
                  border:
                    activeTab === tab.id ? "none" : "1px solid var(--danger)",
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Sub-tab content — server-rendered slots, toggled via display */}
      <div style={{ display: activeTab === "noDrivers" ? "block" : "none" }}>
        {noDriversSection}
      </div>
      <div style={{ display: activeTab === "noStints" ? "block" : "none" }}>
        {noStintsSection}
      </div>
      <div style={{ display: activeTab === "unassigned" ? "block" : "none" }}>
        {unassignedSection}
      </div>
    </div>
  );
}
