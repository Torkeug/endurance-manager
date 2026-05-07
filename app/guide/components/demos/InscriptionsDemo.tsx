const CREWS: Record<string, { bg: string; border: string }> = {
  "Kronos Alpha": { bg: "rgba(99,102,241,0.12)",  border: "#6366f1" },
  "Kronos Beta":  { bg: "rgba(16,185,129,0.12)",  border: "#10b981" },
  "Kronos Gamma": { bg: "rgba(245,158,11,0.12)",  border: "#f59e0b" },
};

function CrewPill({ name }: { name: string }) {
  const c = CREWS[name] ?? { bg: "var(--surface-2)", border: "var(--border)" };
  return (
    <span style={{ padding: "0.15rem 0.5rem", borderRadius: "3px", background: c.bg, border: `1px solid ${c.border}`, fontSize: "0.82rem", fontWeight: 600, whiteSpace: "nowrap", color: "var(--text)" }}>
      {name}
    </span>
  );
}

const ROWS = [
  { name: "Marc Dubois",   irating: 4210, crew: "Kronos Alpha", prefs: "GT3, Audi R8",      slot: "Départ A · 14:00", tags: ["chill", "gros rouleur"] },
  { name: "Léa Fontaine",  irating: 3870, crew: "Kronos Alpha", prefs: "GT3",               slot: "Départ A · 14:00", tags: ["compet"] },
  { name: "Léa Fontaine",  irating: 3870, crew: "Kronos Beta",  prefs: "GT3",               slot: "Départ B · 20:00", tags: ["compet"] },
  { name: "Théo Bernard",  irating: 5120, crew: "Kronos Beta",  prefs: "GTE, Ferrari 488", slot: "Départ A · 14:00", tags: [] },
  { name: "Jules Martin",  irating: 3200, crew: "Kronos Gamma", prefs: "GT3",               slot: "Départ B · 20:00", tags: ["solo", "chill"] },
];

const TH: React.CSSProperties = {
  padding: "0.5rem 0.65rem",
  textAlign: "left",
  fontSize: "0.72rem",
  fontWeight: 700,
  letterSpacing: "0.07em",
  textTransform: "uppercase" as const,
  color: "var(--text-dim)",
  borderBottom: "1px solid var(--border)",
  whiteSpace: "nowrap",
};

const TD: React.CSSProperties = { padding: "0.5rem 0.65rem", borderBottom: "1px solid var(--border)", fontSize: "0.88rem" };

import type { CSSProperties } from "react";

export default function InscriptionsDemo() {
  return (
    <div className="table-wrap inscriptions-table" style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "620px" }}>
        <thead>
          <tr>
            <th style={TH}>Pilote</th>
            <th style={TH}>iRating</th>
            <th style={TH}>Équipe</th>
            <th style={TH}>Préférences</th>
            <th style={TH}>Créneaux</th>
            <th style={TH}>Tags</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r, i) => {
            const prevSame = i > 0 && ROWS[i - 1].name === r.name;
            return (
              <tr key={i} style={{ borderTop: !prevSame && i > 0 ? "2px solid var(--border)" : undefined }}>
                <td style={{ ...TD, fontWeight: 600 }}>{prevSame ? "" : r.name}</td>
                <td style={{ ...TD, fontFamily: "var(--font-mono), monospace", color: "var(--accent)", fontSize: "0.85rem" }}>{prevSame ? "" : r.irating}</td>
                <td style={TD}><CrewPill name={r.crew} /></td>
                <td style={{ ...TD, color: "var(--text-dim)" }}>{r.prefs}</td>
                <td style={{ ...TD, fontSize: "0.82rem" }}>
                  <div style={{ fontWeight: 600, fontSize: "0.82rem" }}>{r.slot.split(" · ")[0]}</div>
                  <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.75rem", color: "var(--accent)" }}>{r.slot.split(" · ")[1]}</div>
                </td>
                <td style={TD}>
                  {r.tags.length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                      {r.tags.map((tag) => (
                        <span key={tag} style={{ fontSize: "0.72rem", fontWeight: 600, padding: "0.1rem 0.45rem", borderRadius: "3px", background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-dim)", whiteSpace: "nowrap" }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : <span style={{ color: "var(--text-dim)" }}>—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
