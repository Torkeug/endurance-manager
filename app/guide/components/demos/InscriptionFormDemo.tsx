const START_TIMES = [
  { id: "a", label: "Samedi 23 avril 2026", time: "14:00" },
  { id: "b", label: "Samedi 23 avril 2026", time: "20:00" },
];

const TEAMS = [
  { id: "none", label: "Pas de préférence", car: null, crew: null },
  { id: "1",   label: "Kronos Alpha",       car: "Audi R8 LMS GT3 Evo 2", crew: "GT3 · Départ A · 14:00" },
  { id: "2",   label: "Kronos Beta",        car: "Ferrari 488 GT3 Evo 2022", crew: "GT3 · Départ B · 20:00" },
];

import type { CSSProperties } from "react";

const fieldLabel: CSSProperties = {
  fontSize: "0.72rem",
  fontWeight: 700,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  color: "var(--text-dim)",
  marginBottom: "0.5rem",
  display: "block",
};

export default function InscriptionFormDemo() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Créneaux */}
      <div className="card">
        <label style={fieldLabel}>Créneaux de départ préférés</label>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {START_TIMES.map((st, i) => (
            <label key={st.id} style={{ display: "flex", alignItems: "center", gap: "0.65rem", cursor: "pointer" }}>
              <input type="checkbox" defaultChecked={i === 0} style={{ accentColor: "var(--accent)", width: "15px", height: "15px" }} />
              <div>
                <div style={{ fontSize: "0.88rem", fontWeight: 600 }}>{st.label}</div>
                <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.78rem", color: "var(--accent)" }}>Départ à {st.time}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Équipe */}
      <div className="card">
        <label style={fieldLabel}>Équipe</label>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {TEAMS.map((t, i) => (
            <label key={t.id} style={{ display: "flex", alignItems: "flex-start", gap: "0.65rem", cursor: "pointer" }}>
              <input type="radio" name="team" defaultChecked={i === 1} style={{ accentColor: "var(--accent)", marginTop: "3px", width: "15px", height: "15px" }} />
              <div>
                <div style={{ fontSize: "0.88rem", fontWeight: t.id === "none" ? 400 : 600, color: t.id === "none" ? "var(--text-dim)" : "var(--text)" }}>{t.label}</div>
                {t.car && <div style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>{t.car}</div>}
                {t.crew && <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.75rem", color: "var(--accent)" }}>{t.crew}</div>}
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Classes préférées */}
      <div className="card">
        <label style={fieldLabel}>Classes préférées</label>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          {["GT3", "GTE", "LMP2"].map((cls, i) => (
            <label key={cls} style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
              <input type="checkbox" defaultChecked={i === 0} style={{ accentColor: "var(--accent)", width: "15px", height: "15px" }} />
              <span style={{ fontSize: "0.88rem" }}>{cls}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="card">
        <label style={fieldLabel}>Notes</label>
        <textarea
          rows={2}
          defaultValue="Disponible uniquement samedi soir"
          style={{ width: "100%", boxSizing: "border-box", resize: "vertical", fontFamily: "var(--font-rajdhani), sans-serif", fontSize: "0.88rem", background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "3px", padding: "0.5rem 0.65rem" }}
        />
      </div>

      {/* Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button className="btn btn-primary" style={{ opacity: 0.85 }}>✓ S'inscrire</button>
          <button className="btn btn-secondary" style={{ opacity: 0.85 }}>Annuler</button>
        </div>
        <button className="btn btn-danger" style={{ opacity: 0.85, fontSize: "0.8rem" }}>Se désinscrire</button>
      </div>
    </div>
  );
}
