"use client";
import { useState, useEffect } from "react";

// Thin client shell — only manages tab state.
// All content is server-rendered and passed as JSX props (planningTab / incompleteTab).
// This avoids serializing large data objects to the client.
export default function HomeTabs({
  planningTab,
  incompleteTab,
  signupCount,
  incompleteCount,
}) {
  const [activeTab, setActiveTab] = useState("planning");

  // Read persisted tab in useEffect — never in useState to avoid hydration mismatch
  useEffect(() => {
    const saved = localStorage.getItem("home-tab");
    if (saved === "planning" || saved === "incomplete") setActiveTab(saved);
  }, []);

  const switchTab = (tabId) => {
    setActiveTab(tabId);
    localStorage.setItem("home-tab", tabId);
  };

  const tabs = [
    { id: "planning", label: "Mon planning", count: signupCount },
    { id: "incomplete", label: "Suivi", count: incompleteCount, danger: true },
  ];

  return (
    <div>
      {/* Tab bar */}
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
                  ? "2px solid var(--accent)"
                  : "2px solid transparent",
              color: activeTab === tab.id ? "var(--accent)" : "var(--text-dim)",
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
            {/* Count badge — red for incomplete teams, neutral for planning */}
            {tab.count > 0 && (
              <span
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  padding: "0.05rem 0.35rem",
                  borderRadius: "10px",
                  background: tab.danger
                    ? activeTab === tab.id
                      ? "var(--danger)"
                      : "rgba(224,85,85,0.15)"
                    : activeTab === tab.id
                      ? "var(--accent)"
                      : "var(--surface-2)",
                  color: tab.danger
                    ? activeTab === tab.id
                      ? "#fff"
                      : "var(--danger)"
                    : activeTab === tab.id
                      ? "#fff"
                      : "var(--text-dim)",
                  border: tab.danger
                    ? activeTab === tab.id
                      ? "none"
                      : "1px solid var(--danger)"
                    : activeTab === tab.id
                      ? "none"
                      : "1px solid var(--border)",
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content — both are rendered server-side, shown/hidden via display */}
      <div style={{ display: activeTab === "planning" ? "block" : "none" }}>
        {planningTab}
      </div>
      <div style={{ display: activeTab === "incomplete" ? "block" : "none" }}>
        {incompleteTab}
      </div>
    </div>
  );
}
