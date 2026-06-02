"use client";
import { useState } from "react";
import AdminDemoShell from "./AdminDemoShell";

const ENTRIES = [
  { id: 1, crew: "Kronos Alpha", car: "Audi R8 LMS GT3 EVO II", cls: "GT3", rounds: [{ label: "Round 1 · Spa 6H", num: 56 }, { label: "Round 2 · Le Mans 24H", num: 56 }, { label: "Round 3 · Portimão 3H", num: 56 }] },
  { id: 2, crew: "Kronos Beta",  car: "Ferrari 296 GT3",         cls: "GT3", rounds: [{ label: "Round 1 · Spa 6H", num: 88 }, { label: "Round 2 · Le Mans 24H", num: null }, { label: "Round 3 · Portimão 3H", num: 88 }] },
  { id: 3, crew: "Kronos Gamma", car: "Porsche 992 GT3 R",       cls: "GT3", rounds: [{ label: "Round 1 · Spa 6H", num: 911 }, { label: "Round 2 · Le Mans 24H", num: 911 }] },
];

function isConsistent(rounds: typeof ENTRIES[0]["rounds"]) {
  const nums = rounds.map((r) => r.num);
  return nums.every((n) => n === nums[0]);
}

export default function AdminChampionshipTeamsDemo() {
  const [view, setView] = useState<"team" | "championship">("team");
  const [expanded, setExpanded] = useState<Record<number, boolean>>({ 2: true });

  return (
    <AdminDemoShell activeTab="equipages">
    <div>
      {/* View toggle */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        {([["team", "Par équipe"], ["championship", "Par championnat"]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            style={{
              padding: "0.3rem 0.9rem", borderRadius: "999px", border: "1px solid",
              borderColor: view === key ? "var(--accent)" : "var(--border)",
              background: view === key ? "var(--accent-dim)" : "transparent",
              color: view === key ? "var(--accent)" : "var(--text-dim)",
              fontSize: "0.82rem", fontWeight: 600, cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Championship block */}
      <div style={{ border: "1px solid var(--border)", borderRadius: "4px", overflow: "hidden" }}>
        {/* Championship header */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.7rem 1rem", background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
          <span style={{ color: "var(--text-dim)", fontSize: "0.65rem" }}>▼</span>
          <span style={{ fontWeight: 700, fontFamily: "var(--font-rajdhani),sans-serif", letterSpacing: "0.04em", fontSize: "0.95rem" }}>
            {view === "team" ? "Kronos Beta" : "Kronos Endurance Championship"}
          </span>
          <span style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>· Saison 2025 ·</span>
          <span style={{ marginLeft: "auto", color: "var(--text-dim)", fontSize: "0.78rem" }}>
            {view === "team" ? "1 championnat" : "3 équipes"}
          </span>
        </div>

        {/* Team rows */}
        {ENTRIES.map((entry) => {
          const consistent = isConsistent(entry.rounds);
          const sharedNum = consistent ? entry.rounds[0].num : null;
          const isOpen = expanded[entry.id] || (!consistent);
          return (
            <div key={entry.id} style={{ borderBottom: "1px solid var(--border)" }}>
              <div
                onClick={() => setExpanded((p) => ({ ...p, [entry.id]: !p[entry.id] }))}
                style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.55rem 1rem", cursor: "pointer", fontSize: "0.88rem", userSelect: "none" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{ color: "var(--text-dim)", fontSize: "0.65rem", width: "0.75rem", flexShrink: 0 }}>{isOpen ? "▼" : "▶"}</span>
                <span style={{ fontWeight: 600, color: "var(--text)", width: "11rem", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.crew}</span>
                <span style={{ color: "var(--text-dim)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.85rem" }}>{entry.car}</span>
                <span style={{ color: "var(--text-dim)", fontSize: "0.8rem", width: "4rem", textAlign: "right", flexShrink: 0 }}>{entry.cls}</span>
                <span style={{ width: "4rem", textAlign: "right", flexShrink: 0, fontFamily: "var(--font-mono),monospace" }}>
                  {consistent ? (
                    <span style={{ color: sharedNum != null ? "var(--accent)" : "var(--text-dim)" }}>
                      {sharedNum != null ? `#${sharedNum}` : "—"}
                    </span>
                  ) : (
                    <span style={{ color: "#f59e0b", fontSize: "0.78rem", fontStyle: "italic" }}>varie</span>
                  )}
                </span>
              </div>
              {isOpen && (
                <div style={{ background: "var(--surface-2)", paddingBottom: "0.25rem" }}>
                  {entry.rounds.map((r) => (
                    <div key={r.label} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.35rem 1rem 0.35rem 2.5rem", fontSize: "0.85rem" }}>
                      <span style={{ color: "var(--text-dim)", flex: 1 }}>{r.label}</span>
                      <input
                        readOnly
                        value={r.num ?? ""}
                        placeholder="—"
                        type="number"
                        style={{
                          width: "4rem", background: "var(--surface)", border: "1px solid var(--border)",
                          borderRadius: "3px", padding: "0.2rem 0.4rem", fontSize: "0.85rem",
                          color: r.num != null ? "var(--accent)" : "var(--text-dim)",
                          fontFamily: "var(--font-mono),monospace", textAlign: "center",
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
    </AdminDemoShell>
  );
}
