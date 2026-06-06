"use client";
import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

export default function EventDetailTabsDemo({ activeTab = "inscriptions" }: { activeTab?: string }) {
  const t = useTranslations("events");
  const activeRef = useRef<HTMLDivElement>(null);

  const TABS = [
    { id: "inscriptions", label: t("tabInscriptions"), count: 8 },
    { id: "equipages",    label: t("tabEquipages"),    count: 3 },
    { id: "horaires",     label: t("tabStartTimes") },
    { id: "inventaire",   label: t("tabInventory") },
  ];

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
        const isActive = tab.id === activeTab;
        return (
          <div
            key={tab.id}
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
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span style={{
                fontSize: "0.65rem",
                fontWeight: 700,
                padding: "0.05rem 0.35rem",
                borderRadius: "10px",
                background: isActive ? "var(--accent)" : "var(--surface-2)",
                color: isActive ? "#fff" : "var(--text-dim)",
                border: isActive ? "none" : "1px solid var(--border)",
              }}>
                {tab.count}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
