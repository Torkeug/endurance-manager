"use client";

import { useState } from "react";
import CrewNamesManager from "./CrewNamesManager";
import ChampionshipTeamsManager from "./ChampionshipTeamsManager";

// Sub-tab definitions for the Équipages admin section
const TABS = [
  { key: "numeros", label: "Gestion des numéros" },
  { key: "noms",    label: "Configuration" },
];

export default function EquipagesManager({ initialCrewNames }) {
  const [activeTab, setActiveTab] = useState("numeros");

  return (
    <div className="space-y-6">
      {/* ── Sub-tab bar ───────────────────────────────────────────────── */}
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
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: "0.6rem 1.25rem",
              background: "transparent",
              border: "none",
              borderBottom:
                activeTab === tab.key
                  ? "2px solid var(--accent)"
                  : "2px solid transparent",
              color:
                activeTab === tab.key ? "var(--accent)" : "var(--text-dim)",
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
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab panels ───────────────────────────────────────────────── */}
      {activeTab === "noms" && (
        <CrewNamesManager initialCrewNames={initialCrewNames} />
      )}
      {activeTab === "numeros" && <ChampionshipTeamsManager />}
    </div>
  );
}
