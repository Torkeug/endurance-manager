"use client";
import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

// Tab IDs — these match the activeTab prop values passed from guide.data.ts
const TAB_IDS = ["Pilotes", "Disponibilités", "Relais", "Planning", "Performances", "Course"];

export default function TabsDemo({ activeTab = "Pilotes" }: { activeTab?: string }) {
  const t = useTranslations("equipageTabs");
  const activeRef = useRef<HTMLDivElement>(null);

  const TAB_LABELS: Record<string, string> = {
    "Pilotes":        t("tabPilotes"),
    "Disponibilités": t("tabDisponibilites"),
    "Relais":         t("tabRelais"),
    "Planning":       t("tabPlanning"),
    "Performances":   t("tabPerformances"),
    "Course":         t("tabCourse"),
  };

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
      {TAB_IDS.map((tabId) => {
        const isActive = tabId === activeTab;
        const label = TAB_LABELS[tabId] ?? tabId;
        return (
          <div
            key={tabId}
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
            {label}
          </div>
        );
      })}
    </div>
  );
}
