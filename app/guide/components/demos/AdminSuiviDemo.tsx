import type { ReactNode } from "react";

// Shared shell: HomeTabs bar → Suivi active → IncompleteTab sub-tabs
function SuiviShell({ activeSubTab, children }: { activeSubTab: "noDrivers" | "noStints" | "unassigned"; children: ReactNode }) {
  const subTabs = [
    { id: "noDrivers",  label: "Sans pilotes",  count: 2 },
    { id: "noStints",   label: "Sans relais",   count: 3 },
    { id: "unassigned", label: "Sans équipage", count: 1 },
  ];
  const total = subTabs.reduce((s, t) => s + t.count, 0);

  return (
    <div>
      {/* HomeTabs bar */}
      <div style={{ display: "flex", gap: "0.25rem", borderBottom: "1px solid var(--border)", marginBottom: "1.5rem" }}>
        {(["Planning", "Suivi"] as const).map((tab) => {
          const isSuivi = tab === "Suivi";
          return (
            <button key={tab} style={{
              padding: "0.5rem 1.25rem", background: "transparent", border: "none",
              borderBottom: isSuivi ? "2px solid var(--accent)" : "2px solid transparent",
              color: isSuivi ? "var(--accent)" : "var(--text-dim)",
              fontFamily: "var(--font-rajdhani),sans-serif", fontSize: "0.9rem",
              fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const,
              cursor: "default", marginBottom: "-1px", display: "flex", alignItems: "center", gap: "0.4rem",
            }}>
              {tab}
              {isSuivi && (
                <span style={{ background: "var(--danger)", color: "#fff", fontSize: "0.65rem", fontWeight: 700, padding: "1px 5px", borderRadius: "10px" }}>{total}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* IncompleteTab sub-tabs */}
      <div style={{ display: "flex", gap: "0.25rem", borderBottom: "1px solid var(--border)", marginBottom: "1.5rem", overflowX: "auto", scrollbarWidth: "none" as any }}>
        {subTabs.map((tab) => {
          const isActive = tab.id === activeSubTab;
          return (
            <button key={tab.id} style={{
              padding: "0.6rem 1.25rem", background: "transparent", border: "none",
              borderBottom: isActive ? "2px solid var(--danger)" : "2px solid transparent",
              color: isActive ? "var(--danger)" : "var(--text-dim)",
              fontFamily: "var(--font-rajdhani),sans-serif", fontSize: "0.9rem",
              fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const,
              cursor: "default", marginBottom: "-1px", whiteSpace: "nowrap" as const,
              display: "flex", alignItems: "center", gap: "0.4rem",
            }}>
              {tab.label}
              {tab.count > 0 && (
                <span style={{
                  fontSize: "0.65rem", fontWeight: 700, padding: "0.05rem 0.35rem", borderRadius: "10px",
                  background: isActive ? "var(--danger)" : "rgba(224,85,85,0.15)",
                  color: isActive ? "#fff" : "var(--danger)",
                  border: isActive ? "none" : "1px solid var(--danger)",
                }}>{tab.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {children}
    </div>
  );
}

// Shared card group layout
function EventGroup({ eventName, urgency, children }: { eventName: string; urgency: string; children: ReactNode }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginBottom: "0.4rem" }}>
        <span style={{ fontWeight: 700, fontSize: "0.85rem" }}>{eventName}</span>
        <span style={{ fontSize: "0.75rem", color: "var(--accent)" }}>{urgency}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", paddingLeft: "0.75rem", borderLeft: "2px solid var(--border)" }}>
        {children}
      </div>
    </div>
  );
}

function StatusCard({ label, badge }: { label: string; badge: string }) {
  return (
    <div className="card event-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", cursor: "pointer", padding: "0.6rem 0.85rem" }}>
      <div style={{ fontWeight: 600 }}>{label}</div>
      <span style={{ fontSize: "0.72rem", padding: "0.15rem 0.4rem", background: "rgba(224,85,85,0.1)", border: "1px solid var(--danger)", borderRadius: "2px", color: "var(--danger)" }}>
        {badge}
      </span>
    </div>
  );
}

// ── Sub-tab 1: Sans pilotes ───────────────────────────────────────────────────

export function AdminSuiviSansPilotesDemo() {
  return (
    <SuiviShell activeSubTab="noDrivers">
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <EventGroup eventName="Endurance GT 24h Le Mans" urgency="dans 5j 2h">
          <StatusCard label="Kronos Alpha" badge="Aucun pilote" />
        </EventGroup>
        <EventGroup eventName="Spa 6H" urgency="dans 12j">
          <StatusCard label="Kronos Beta" badge="Aucun pilote" />
        </EventGroup>
      </div>
    </SuiviShell>
  );
}

// ── Sub-tab 2: Sans relais ────────────────────────────────────────────────────

export function AdminSuiviSansRelaisDemo() {
  return (
    <SuiviShell activeSubTab="noStints">
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <EventGroup eventName="Endurance GT 24h Le Mans" urgency="dans 5j 2h">
          <StatusCard label="Kronos Alpha" badge="Aucun relais" />
          <StatusCard label="Kronos Gamma" badge="Aucun relais" />
        </EventGroup>
        <EventGroup eventName="Spa 6H" urgency="dans 12j">
          <StatusCard label="Kronos Beta" badge="Aucun relais" />
        </EventGroup>
      </div>
    </SuiviShell>
  );
}

// ── Sub-tab 3: Sans équipage ──────────────────────────────────────────────────

export function AdminSuiviSansEquipageDemo() {
  return (
    <SuiviShell activeSubTab="unassigned">
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <EventGroup eventName="Endurance GT 24h Le Mans" urgency="dans 5j 2h">
          <StatusCard label="Jules Martin" badge="Sans équipage" />
        </EventGroup>
      </div>
    </SuiviShell>
  );
}
