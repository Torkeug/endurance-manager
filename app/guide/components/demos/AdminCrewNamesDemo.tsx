import type { CSSProperties } from "react";
import AdminDemoShell from "./AdminDemoShell";

const TH: CSSProperties = {
  padding: "0.5rem 0.75rem", textAlign: "left", fontSize: "0.72rem", fontWeight: 700,
  letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-dim)",
  borderBottom: "1px solid var(--border)", whiteSpace: "nowrap",
};
const TD: CSSProperties = { padding: "0.55rem 0.75rem", borderBottom: "1px solid var(--border)", fontSize: "0.88rem" };

const CREW_NAMES = [
  { name: "Kronos Alpha",   color: "#6366f1" },
  { name: "Kronos Beta",    color: "#10b981" },
  { name: "Kronos Gamma",   color: "#f59e0b" },
  { name: "Kronos Silver",  color: null },
];

const PALETTE = ["#000000", "#c9a84c", "#808080", "#ffffff", "#0774eb", "#10b981", "#ef4444", "#8b5cf6"];

function CrewPill({ name, color }: { name: string; color: string | null }) {
  if (!color) return <span style={{ fontWeight: 600 }}>{name}</span>;
  return (
    <span style={{
      padding: "0.15rem 0.5rem", borderRadius: "3px",
      background: `${color}20`, border: `1px solid ${color}`,
      color, fontSize: "0.82rem", fontWeight: 600, whiteSpace: "nowrap",
    }}>
      {name}
    </span>
  );
}

export default function AdminCrewNamesDemo() {
  return (
    <AdminDemoShell activeTab="equipages">
    <div>
      {/* Équipages sub-tabs */}
      <div style={{ display: "flex", gap: "0.25rem", borderBottom: "1px solid var(--border)", marginBottom: "1.5rem" }}>
        {(["Équipages utilisés en championnats", "Configuration"] as const).map((label, i) => (
          <button key={label} style={{
            padding: "0.5rem 1.25rem", background: "transparent", border: "none",
            borderBottom: i === 1 ? "2px solid var(--accent)" : "2px solid transparent",
            color: i === 1 ? "var(--accent)" : "var(--text-dim)",
            fontFamily: "var(--font-rajdhani),sans-serif", fontSize: "0.85rem",
            fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const,
            cursor: "default", marginBottom: "-1px",
          }}>{label}</button>
        ))}
      </div>
      <button className="btn btn-primary" style={{ marginBottom: "0.75rem", fontSize: "0.82rem" }}>
        + Ajouter un nom d'équipage
      </button>

      {/* Inline edit form — static preview */}
      <div style={{ padding: "1rem", background: "var(--surface-2)", marginBottom: "0.75rem", borderRadius: "3px" }}>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: "160px" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, marginBottom: "0.3rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Nom</div>
            <input readOnly value="Kronos Delta" style={{ padding: "0.4rem 0.6rem", background: "var(--surface)", border: "1px solid var(--accent)", borderRadius: "3px", color: "var(--text)", fontSize: "0.88rem", width: "100%" }} />
          </div>
          <button className="btn btn-primary btn-sm">✓ Ajouter</button>
          <button className="btn btn-secondary btn-sm">Annuler</button>
        </div>
        {/* Color picker preview */}
        <div style={{ marginTop: "0.75rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, marginBottom: "0.4rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Couleur de l'équipage</div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
            <div style={{ width: "36px", height: "36px", padding: "2px", borderRadius: "3px", border: "1px solid var(--border)", background: "#0774eb", cursor: "default" }} />
            {PALETTE.map((hex) => (
              <div key={hex} style={{ width: "22px", height: "22px", borderRadius: "3px", background: hex, border: hex === "#0774eb" ? "2px solid var(--text)" : "2px solid transparent", flexShrink: 0 }} />
            ))}
            <button className="btn btn-secondary btn-sm">Effacer</button>
            <span style={{ padding: "0.15rem 0.5rem", borderRadius: "3px", background: "#0774eb20", border: "1px solid #0774eb", color: "#0774eb", fontSize: "0.82rem", fontWeight: 600 }}>
              Kronos Delta
            </span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={TH}>Nom d'équipage</th>
              <th style={TH}>Couleur</th>
              <th style={TH}></th>
            </tr>
          </thead>
          <tbody>
            {CREW_NAMES.map((c) => (
              <tr key={c.name}>
                <td style={TD}><CrewPill name={c.name} color={c.color} /></td>
                <td style={TD}>
                  {c.color ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ width: "14px", height: "14px", borderRadius: "2px", background: c.color, display: "inline-block" }} />
                      <span style={{ fontSize: "0.78rem", color: "var(--text-dim)", fontFamily: "var(--font-mono),monospace" }}>{c.color}</span>
                    </div>
                  ) : (
                    <span style={{ color: "var(--text-dim)", fontSize: "0.82rem" }}>Auto</span>
                  )}
                </td>
                <td style={TD}>
                  <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end" }}>
                    <button className="btn btn-secondary btn-sm">Modifier</button>
                    <button className="btn btn-danger btn-sm">Supprimer</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </AdminDemoShell>
  );
}
