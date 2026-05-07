"use client";
import { useEffect, useRef } from "react";

const TABS = ["Pilotes", "Disponibilités", "Relais", "Planning", "Performances", "🏁 Course"];

export default function TabsDemo({ activeTab = "Pilotes" }: { activeTab?: string }) {
  const activeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: "start", block: "nearest" });
  }, [activeTab]);

  return (
    <div
      style={{
        display: "flex",
        gap: "0.25rem",
        borderBottom: "1px solid var(--border)",
        overflowX: "auto",
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none",
      }}
    >
      {TABS.map((tab) => {
        const isActive = tab === activeTab || tab.replace("🏁 ", "") === activeTab;
        return (
          <div
            key={tab}
            ref={isActive ? activeRef : null}
            style={{
              padding: "0.6rem 1.25rem",
              borderBottom: isActive ? "2px solid var(--accent)" : "2px solid transparent",
              color: isActive ? "var(--accent)" : "var(--text-dim)",
              fontFamily: "var(--font-rajdhani), sans-serif",
              fontSize: "0.9rem",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {tab}
          </div>
        );
      })}
    </div>
  );
}
