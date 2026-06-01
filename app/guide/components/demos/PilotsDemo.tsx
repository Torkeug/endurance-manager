import type { CSSProperties } from "react";

const DRIVERS = [
  { name: "Marc Dubois",  irating: 4210, prefs: "GT3, Audi R8 LMS",  tags: ["chill", "gros rouleur"] },
  { name: "Léa Fontaine", irating: 3870, prefs: "GT3",                tags: [] },
  { name: "Théo Bernard", irating: 5120, prefs: "GTE, Ferrari 488",   tags: ["compet"] },
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
            <th style={TH}>Tags</th>
            <th style={TH}></th>
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
              <td style={TD}>
                {d.tags.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                    {[...d.tags].sort().map((tag) => (
                      <span key={tag} style={{ fontSize: "0.72rem", fontWeight: 600, padding: "0.1rem 0.45rem", borderRadius: "3px", background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-dim)", whiteSpace: "nowrap" }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : <span style={{ color: "var(--text-dim)" }}>—</span>}
              </td>
              <td style={TD}>
                <button className="btn btn-secondary btn-sm">Voir</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
