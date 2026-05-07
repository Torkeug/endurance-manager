import type { CSSProperties } from "react";

const DRIVERS = [
  { name: "Marc Dubois",  irating: 4210, prefs: "GT3, Audi R8 LMS",  notes: "Disponible samedi soir" },
  { name: "Léa Fontaine", irating: 3870, prefs: "GT3",                notes: "" },
  { name: "Théo Bernard", irating: 5120, prefs: "GTE, Ferrari 488",   notes: "Préfère relais nuit" },
];

const TH: CSSProperties = {
  padding: "0.6rem 0.75rem",
  textAlign: "left",
  fontSize: "0.75rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  color: "var(--text-dim)",
  borderBottom: "1px solid var(--border)",
  whiteSpace: "nowrap",
};

const TD: CSSProperties = {
  padding: "0.65rem 0.75rem",
  borderBottom: "1px solid var(--border)",
  fontSize: "0.9rem",
};

export default function PilotsDemo() {
  return (
    <div className="table-wrap">
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={TH}>Pilote</th>
            <th style={TH}>iRating</th>
            <th style={TH}>Préférences</th>
            <th style={TH}>Notes</th>
          </tr>
        </thead>
        <tbody>
          {DRIVERS.map((d) => (
            <tr key={d.name}>
              <td style={{ ...TD, fontWeight: 600 }}>{d.name}</td>
              <td style={{ ...TD, fontFamily: "var(--font-mono), monospace", color: "var(--accent)", fontSize: "0.85rem" }}>
                {d.irating}
              </td>
              <td style={{ ...TD, color: "var(--text-dim)", fontSize: "0.85rem" }}>{d.prefs}</td>
              <td style={{ ...TD, color: "var(--text-dim)", fontSize: "0.85rem" }}>{d.notes || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
