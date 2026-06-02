import type { ReactNode } from "react";

const TABS = [
  { id: "pilotes",    label: "Pilotes",          badge: 2 },
  { id: "equipages",  label: "Équipages" },
  { id: "voitures",   label: "Voitures" },
  { id: "classes",    label: "Classes" },
  { id: "circuits",   label: "Circuits" },
  { id: "types",      label: "Types d'événement" },
  { id: "garage61",   label: "Garage61" },
  { id: "parametres", label: "Paramètres" },
] as const;

type TabId = typeof TABS[number]["id"];

export default function AdminDemoShell({ activeTab, children }: { activeTab: TabId; children: ReactNode }) {
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
