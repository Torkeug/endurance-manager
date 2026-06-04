"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";

export default function DriverPageTabs({ engagementsContent, statsContent }) {
  const t = useTranslations("driverPageTabs");
  const [activeTab, setActiveTab] = useState("engagements");

  const TABS = [
    { id: "engagements", label: t("engagements") },
    { id: "statistiques", label: t("stats") },
  ];

  return (
    <div>
      {/* ── Tab bar — same style as AdminTabs / EventPageTabs ─────────── */}
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
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
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
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab panels ───────────────────────────────────────────────── */}
      {{ engagements: engagementsContent, statistiques: statsContent }[activeTab]}
    </div>
  );
}
