import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

type TabId = "pilotes" | "equipages" | "voitures" | "classes" | "circuits" | "types" | "garage61" | "parametres";

export default function AdminDemoShell({ activeTab, children }: { activeTab: TabId; children: ReactNode }) {
  const t = useTranslations("admin");
  const TABS = [
    { id: "pilotes" as TabId,    label: t("tabDrivers"),   badge: 2 },
    { id: "equipages" as TabId,  label: t("tabEntries") },
    { id: "voitures" as TabId,   label: t("tabCars") },
    { id: "classes" as TabId,    label: t("tabClasses") },
    { id: "circuits" as TabId,   label: t("tabCircuits") },
    { id: "types" as TabId,      label: t("tabEventTypes") },
    { id: "garage61" as TabId,   label: t("tabGarage61") },
    { id: "parametres" as TabId, label: t("tabSettings") },
  ];
  return (
    <div>
      {/* Tab bar */}
      <div style={{
        display: "flex", gap: "0.25rem", borderBottom: "1px solid var(--border)",
        marginBottom: "1.5rem", overflowX: "auto", scrollbarWidth: "none" as any,
      }}>
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              style={{
                padding: "0.6rem 1.25rem", background: "transparent", border: "none",
                borderBottom: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                color: isActive ? "var(--accent)" : "var(--text-dim)",
                fontFamily: "var(--font-rajdhani),sans-serif", fontSize: "0.9rem",
                fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const,
                cursor: "default", marginBottom: "-1px", whiteSpace: "nowrap" as const, flexShrink: 0,
              }}
            >
              {tab.label}
              {"badge" in tab && (tab as any).badge > 0 && (
                <span style={{
                  marginLeft: "0.4rem", background: "var(--danger)", color: "#fff",
                  fontSize: "0.65rem", fontWeight: 700, padding: "1px 5px",
                  borderRadius: "10px", verticalAlign: "middle",
                }}>
                  {(tab as any).badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {children}
    </div>
  );
}
