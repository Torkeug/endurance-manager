"use client";
import React, { useState } from "react";

const TH = {
  background: "var(--surface-2)", color: "var(--text-dim)", fontSize: "0.72rem", fontWeight: 700,
  letterSpacing: "0.08em", textTransform: "uppercase" as const, padding: "0.6rem 1rem",
  textAlign: "left" as const, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" as const,
};
const TD = { padding: "0.6rem 1rem", borderBottom: "1px solid var(--border)", verticalAlign: "middle" as const };

const GROUPS = [
  { name: "Circuit de la Sarthe", circuits: [
    { name: "Le Mans 24H", pit: 95 },
    { name: "Le Mans 24H (Chicanes)", pit: 98 },
  ]},
  { name: "Circuit de Spa-Francorchamps", circuits: [
    { name: "Spa-Francorchamps", pit: 72 },
  ]},
  { name: "Autodromo Internacional do Algarve", circuits: [
    { name: "Portimão GP", pit: 58 },
  ]},
];

export default function AdminCircuitsDemo() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["Circuit de la Sarthe"]));

  const toggle = (name: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  return (
    <div>
      <button className="btn btn-primary" style={{ marginBottom: "0.75rem" }}>+ Ajouter un circuit</button>
      <div className="table-wrap" style={{ marginBottom: "0.75rem" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={TH}>Circuit</th>
              <th style={TH}>Pit lane</th>
              <th style={{ ...TH, background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }} />
            </tr>
          </thead>
          <tbody>
            {GROUPS.map(({ name, circuits }) => {
              const isOpen = expanded.has(name);
              return (
                <React.Fragment key={name}>
                  <tr onClick={() => toggle(name)} style={{ cursor: "pointer" }}>
                    <td colSpan={3} style={{ padding: "0.5rem 1rem", background: "var(--surface-2)", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: "0.82rem", userSelect: "none" }}>
                      <span style={{ display: "inline-block", marginRight: "0.5rem", fontSize: "0.6rem", color: "var(--text-dim)", transition: "transform 0.15s", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
                      {name}
                      <span style={{ marginLeft: "0.6rem", fontSize: "0.75rem", fontWeight: 400, color: "var(--accent)", fontFamily: "var(--font-mono),monospace" }}>{circuits.length}</span>
                    </td>
                  </tr>
                  {isOpen && circuits.map((c) => (
                    <tr key={c.name}>
                      <td style={{ ...TD, fontWeight: 600, paddingLeft: "2.5rem" }}>{c.name}</td>
                      <td className="mono" style={{ ...TD, color: "var(--accent)" }}>{c.pit}s</td>
                      <td style={{ ...TD, textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                          <button className="btn btn-secondary btn-sm">Modifier</button>
                          <button className="btn btn-danger btn-sm">Supprimer</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
