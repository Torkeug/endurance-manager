"use client";
import { useRef } from "react";
import useScrollSpy from "./useScrollSpy";
import type { GuideSection } from "../guide.data";

const NAV_TAB_ORDER = ["Accueil", "Pilotes", "Événements", "Inventaire", "Admin"];

export default function Sidebar({
  sections,
  scrollContainerId,
}: {
  sections: GuideSection[];
  scrollContainerId: string;
}) {
  const ids = sections.map((s) => s.id);
  const active = useScrollSpy(ids, scrollContainerId);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Group sections by navTab, preserving insertion order within each tab
  const byNavTab = new Map<string, GuideSection[]>();
  for (const section of sections) {
    if (!byNavTab.has(section.navTab)) byNavTab.set(section.navTab, []);
    byNavTab.get(section.navTab)!.push(section);
  }

  const orderedTabs = NAV_TAB_ORDER.filter((t) => byNavTab.has(t));

  return (
    <aside
      ref={sidebarRef}
      style={{
        width: "260px",
        flexShrink: 0,
        overflowY: "auto",
        height: "100%",
        backgroundColor: "var(--surface)",
        borderRight: "1px solid var(--border)",
        padding: "1.5rem 0",
      }}
    >
      {orderedTabs.map((navTab) => {
        const tabSections = byNavTab.get(navTab)!;

        // Collect sub-group labels in order of first appearance
        const labelOrder: string[] = [];
        const byLabel = new Map<string, GuideSection[]>();
        for (const s of tabSections) {
          if (!byLabel.has(s.label)) {
            byLabel.set(s.label, []);
            labelOrder.push(s.label);
          }
          byLabel.get(s.label)!.push(s);
        }

        // Is any section in this navTab currently active?
        const tabIsActive = tabSections.some((s) => s.id === active);

        return (
          <div key={navTab} style={{ marginBottom: "1.5rem" }}>
            {/* Nav tab header */}
            <div
              style={{
                fontSize: "0.7rem",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                padding: "0 1.25rem",
                marginBottom: "0.375rem",
                color: tabIsActive ? "var(--accent)" : "var(--text-dim)",
              }}
            >
              {navTab}
            </div>

            {labelOrder.map((label) => {
              const labelSections = byLabel.get(label)!;
              const isSubGroup = label !== navTab;

              return (
                <div key={label}>
                  {isSubGroup && (
                    <div
                      style={{
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "var(--text-dim)",
                        padding: "0.5rem 1.25rem 0.25rem 2rem",
                        opacity: 0.7,
                      }}
                    >
                      {label}
                    </div>
                  )}

                  {labelSections.map((s) => {
                    const isActive = active === s.id;
                    const isIndented = isSubGroup || !!s.parent;
                    return (
                      <a
                        key={s.id}
                        href={`#${s.id}`}
                        style={{
                          display: "block",
                          padding: isIndented
                            ? "0.3rem 1.25rem 0.3rem 2.5rem"
                            : "0.35rem 1.25rem 0.35rem 1.25rem",
                          fontSize: "0.85rem",
                          fontWeight: isActive ? 700 : 500,
                          color: isActive ? "var(--accent)" : "var(--text)",
                          backgroundColor: isActive ? "var(--surface-2)" : "transparent",
                          borderLeft: isActive
                            ? "2px solid var(--accent)"
                            : "2px solid transparent",
                          textDecoration: "none",
                          transition: "color 0.12s, background-color 0.12s",
                          lineHeight: 1.4,
                        }}
                      >
                        {s.title}
                      </a>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })}
    </aside>
  );
}
