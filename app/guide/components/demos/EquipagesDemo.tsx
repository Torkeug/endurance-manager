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

const ENTRIES = [
  { crew: "Kronos Alpha", car: "Audi R8 LMS GT3",  class: "GT3", pilots: "Dubois, Fontaine, Martin", sof: "3 820", start: "14:00" },
  { crew: "Kronos Beta",  car: "Ferrari 488 GT3",   class: "GT3", pilots: "Bernard, Fontaine",         sof: "4 495", start: "14:00" },
  { crew: "Kronos Gamma", car: "Porsche 911 GT3 R", class: "GT3", pilots: "Martin, Durand",            sof: "3 200", start: "20:00" },
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

export default function EquipagesDemo({ showCreate }: { showCreate?: boolean }) {
  return (
    <div>
      {showCreate && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.75rem" }}>
          <button className="btn btn-primary" style={{ opacity: 0.85 }}>+ Ajouter un équipage</button>
        </div>
      )}
    <div className="table-wrap" style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "580px" }}>
        <thead>
          <tr>
            <th style={TH}>Équipage</th>
            <th style={TH}>Voiture</th>
            <th style={TH}>Classe</th>
            <th style={TH}>Pilotes</th>
            <th style={TH}>SoF</th>
            <th style={TH}>Départ IRL</th>
          </tr>
        </thead>
        <tbody>
          {ENTRIES.map((e) => (
            <tr key={e.crew}>
              <td style={TD}><CrewPill name={e.crew} /></td>
              <td style={{ ...TD, color: "var(--text-dim)", fontSize: "0.85rem" }}>{e.car}</td>
              <td style={TD}>
                <span className="badge badge-driver">{e.class}</span>
              </td>
              <td style={{ ...TD, fontSize: "0.82rem", color: "var(--text-dim)" }}>{e.pilots}</td>
              <td style={{ ...TD, fontFamily: "var(--font-mono), monospace", color: "var(--accent)", fontSize: "0.85rem" }}>{e.sof}</td>
              <td style={{ ...TD, fontFamily: "var(--font-mono), monospace", fontSize: "0.85rem" }}>{e.start}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </div>
  );
}
