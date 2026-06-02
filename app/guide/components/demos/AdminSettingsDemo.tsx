import AdminDemoShell from "./AdminDemoShell";

const TH = {
  background: "var(--surface-2)", color: "var(--text-dim)", fontSize: "0.72rem", fontWeight: 700,
  letterSpacing: "0.08em", textTransform: "uppercase" as const, padding: "0.6rem 1rem",
  textAlign: "left" as const, borderBottom: "1px solid var(--border)",
};
const TD = { padding: "0.6rem 1rem", borderBottom: "1px solid var(--border)", verticalAlign: "middle" as const };

function formatDuration(min: number) {
  const h = Math.floor(min / 60), m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

const PRESETS = [180, 360, 600, 720, 1440];
const DEFAULT_DUR = 360;
const SPECIAL_TIMES = [
  { id: 1, day: "Vendredi", h: 20, m: 0 },
  { id: 2, day: "Samedi",   h: 14, m: 0 },
  { id: 3, day: "Samedi",   h: 22, m: 0 },
  { id: 4, day: "Dimanche", h: 9,  m: 0 },
];
const TAGS = ["chill", "compet", "gros rouleur", "solo"];

export default function AdminSettingsDemo() {
  return (
    <AdminDemoShell activeTab="parametres">
    <div>
      {/* Duration presets */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h3 style={{ marginBottom: "1.25rem", color: "var(--text-dim)" }}>Durées disponibles à la création d'événement</h3>
        <button className="btn btn-primary" style={{ marginBottom: "0.75rem" }}>+ Ajouter une durée</button>
        <div className="table-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={TH}>Durée</th><th style={TH}>Minutes</th><th style={TH}></th></tr></thead>
            <tbody>
              {PRESETS.map((p) => (
                <tr key={p}>
                  <td style={TD}><span className="mono" style={{ fontWeight: 600, color: "var(--accent)" }}>{formatDuration(p)}</span></td>
                  <td className="mono" style={TD}>{p} min</td>
                  <td style={{ ...TD, textAlign: "right" }}><button className="btn btn-danger btn-sm">Supprimer</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Default duration */}
      <div className="card">
        <h3 style={{ marginBottom: "1.25rem", color: "var(--text-dim)" }}>Durée par défaut</h3>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
          {PRESETS.map((p) => (
            <button key={p} style={{
              padding: "0.45rem 1rem", borderRadius: "3px", border: "1px solid",
              borderColor: p === DEFAULT_DUR ? "var(--accent)" : "var(--border)",
              background: p === DEFAULT_DUR ? "var(--accent-dim)" : "var(--surface-2)",
              color: p === DEFAULT_DUR ? "var(--accent)" : "var(--text-dim)",
              fontFamily: "var(--font-mono),monospace", fontWeight: 600, cursor: "pointer", fontSize: "0.9rem",
            }}>{formatDuration(p)}</button>
          ))}
        </div>
        <button className="btn btn-primary">✓ Enregistrer</button>
      </div>

      {/* Special start times */}
      <div className="card" style={{ marginTop: "1.5rem" }}>
        <h3 style={{ marginBottom: "1.25rem", color: "var(--text-dim)" }}>Horaires prédéfinis (événements spéciaux)</h3>
        <button className="btn btn-primary" style={{ marginBottom: "0.75rem" }}>+ Ajouter un horaire</button>
        <div className="table-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={TH}>Horaire</th><th style={TH}></th></tr></thead>
            <tbody>
              {SPECIAL_TIMES.map((st) => (
                <tr key={st.id}>
                  <td className="mono" style={{ ...TD, fontWeight: 600, color: "var(--accent)" }}>
                    {st.day} à {String(st.h).padStart(2, "0")}:{String(st.m).padStart(2, "0")}
                  </td>
                  <td style={{ ...TD, textAlign: "right" }}>
                    <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
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

      {/* Signup tags */}
      <div className="card" style={{ marginTop: "1.5rem" }}>
        <h3 style={{ marginBottom: "1.25rem", color: "var(--text-dim)" }}>Tags d'inscription</h3>
        <button className="btn btn-primary" style={{ marginBottom: "0.75rem" }}>+ Ajouter un tag</button>
        <div className="table-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={TH}>Tag</th><th style={TH}></th></tr></thead>
            <tbody>
              {TAGS.map((tag) => (
                <tr key={tag}>
                  <td style={TD}>
                    <span style={{ fontSize: "0.82rem", fontWeight: 600, padding: "0.15rem 0.55rem", borderRadius: "3px", background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}>{tag}</span>
                  </td>
                  <td style={{ ...TD, textAlign: "right" }}><button className="btn btn-danger btn-sm">Supprimer</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    </AdminDemoShell>
  );
}
