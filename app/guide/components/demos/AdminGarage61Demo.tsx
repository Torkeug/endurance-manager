const thStyle = {
  background: "var(--surface-2)", color: "var(--text-dim)", fontSize: "0.72rem", fontWeight: 700,
  letterSpacing: "0.08em", textTransform: "uppercase" as const, padding: "0.6rem 1rem",
  textAlign: "left" as const, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" as const,
};
const tdStyle = { padding: "0.55rem 1rem", borderBottom: "1px solid var(--border)", fontSize: "0.85rem" };

const STATUS_META: Record<string, { label: string; color: string }> = {
  confirmed: { label: "✓ Lié",                     color: "#2eb460" },
  exact:     { label: "→ Correspondance exacte",    color: "var(--accent)" },
  fuzzy:     { label: "~ Correspondance partielle", color: "#7eb8e0" },
  conflict:  { label: "⚠ Conflit",                 color: "#e07b39" },
  ambiguous: { label: "⚠ Ambigu",                  color: "#c9a84c" },
  no_match:  { label: "Inconnu",                    color: "var(--text-dim)" },
};

const ROWS = [
  { g61: "Marc Dubois",   slug: "marc-dubois",   db: "Marc Dubois",   status: "confirmed" },
  { g61: "Léa Fontaine",  slug: "lea-fontaine",  db: "Léa Fontaine",  status: "exact" },
  { g61: "Theo Bernard",  slug: "theo-bernard",  db: "Théo Bernard",  status: "fuzzy" },
  { g61: "J. Martin",     slug: "j-martin",      db: "Jules Martin / Jean Martin", status: "ambiguous" },
  { g61: "Paul Renard",   slug: "paul-renard",   db: "—",             status: "no_match" },
];

export default function AdminGarage61Demo() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Controls */}
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-secondary">🔄 Actualiser</button>
        <span style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>Dernière détection : 02/06/2026 à 10:14</span>
        <button className="btn btn-primary">✓ Appliquer 1 correspondance exacte</button>
      </div>

      {/* Detection account */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <span style={{ fontSize: "0.78rem", color: "var(--text-dim)", whiteSpace: "nowrap" }}>Compte de détection :</span>
        <select style={{ fontSize: "0.82rem", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "3px", color: "var(--text)", padding: "0.25rem 0.5rem" }}>
          <option>Raphaël Laurent</option>
        </select>
        <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Choisissez un pilote membre de toutes les équipes.</span>
      </div>

      {/* Warning summary */}
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <div style={{ fontSize: "0.82rem", color: "#e07b39" }}>⚠ 0 conflit</div>
        <div style={{ fontSize: "0.82rem", color: "#c9a84c" }}>⚠ 1 correspondance ambiguë — plusieurs pilotes ont le même nom normalisé.</div>
      </div>

      {/* Table */}
      <div>
        <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--text-dim)", marginBottom: "0.5rem" }}>
          Pilotes détectés sur Garage61 ({ROWS.length})
        </div>
        <div className="table-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Nom Garage61</th>
                <th style={thStyle}>Slug</th>
                <th style={thStyle}>Pilote en base</th>
                <th style={thStyle}>Statut</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => {
                const meta = STATUS_META[r.status];
                return (
                  <tr key={r.g61}>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{r.g61}</td>
                    <td className="mono" style={{ ...tdStyle, fontSize: "0.78rem", color: "var(--text-dim)" }}>{r.slug}</td>
                    <td style={tdStyle}>{r.db}</td>
                    <td style={{ ...tdStyle, fontWeight: 600, color: meta.color }}>{meta.label}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {r.status === "exact" && <button className="btn btn-secondary btn-sm">Appliquer</button>}
                      {(r.status === "fuzzy" || r.status === "ambiguous") && <button className="btn btn-secondary btn-sm">Résoudre</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
