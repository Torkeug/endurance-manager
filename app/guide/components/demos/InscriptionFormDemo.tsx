import type { CSSProperties } from "react";

const sectionTitle: CSSProperties = {
  fontSize: "0.68rem",
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--text-dim)",
  marginBottom: "1.25rem",
};

const subText: CSSProperties = {
  fontSize: "0.8rem",
  color: "var(--text-dim)",
  marginBottom: "1rem",
};

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: "3px",
  color: "var(--text)",
  fontSize: "0.88rem",
  padding: "0.55rem 0.75rem",
  fontFamily: "var(--font-rajdhani), sans-serif",
};

function RadioCard({ label, sub, mono, selected, mismatch }: { label: string; sub?: string; mono?: string; selected?: boolean; mismatch?: "hard" | "soft" }) {
  return (
    <label style={{
      display: "flex",
      alignItems: "center",
      gap: "0.75rem",
      padding: "0.75rem 1rem",
      background: selected ? "var(--accent-dim)" : "var(--surface-2)",
      border: "1px solid",
      borderColor: selected ? "var(--accent)" : "var(--border)",
      borderRadius: "3px",
      cursor: "default",
    }}>
      <input type="radio" readOnly checked={!!selected} style={{ accentColor: "var(--accent)", pointerEvents: "none" }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: selected ? "0.95rem" : "0.9rem", color: selected || !sub ? "var(--text)" : "var(--text-dim)" }}>{label}</div>
        {sub && <div style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>{sub}</div>}
        {mono && <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.75rem", color: "var(--accent)", marginTop: "0.15rem" }}>{mono}</div>}
      </div>
      {mismatch && (
        <span style={{
          fontSize: "0.7rem",
          padding: "0.15rem 0.4rem",
          borderRadius: "2px",
          ...(mismatch === "hard"
            ? { background: "rgba(224,85,85,0.12)", border: "1px solid var(--danger)", color: "var(--danger)" }
            : { background: "#2a1a00", border: "1px solid #a06020", color: "#d4904a" }),
        }}>⚠️ {mismatch === "hard" ? "classe" : "voiture"}</span>
      )}
    </label>
  );
}

function CheckCard({ label, checked }: { label: string; checked?: boolean }) {
  return (
    <label style={{
      display: "flex",
      alignItems: "center",
      gap: "0.75rem",
      padding: "0.6rem 0.85rem",
      background: checked ? "var(--accent-dim)" : "var(--surface-2)",
      border: "1px solid",
      borderColor: checked ? "var(--accent)" : "var(--border)",
      borderRadius: "3px",
      cursor: "default",
      minWidth: "160px",
    }}>
      <input type="checkbox" readOnly checked={!!checked} style={{ accentColor: "var(--accent)", width: "15px", height: "15px", pointerEvents: "none" }} />
      <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>{label}</span>
    </label>
  );
}

export default function InscriptionFormDemo() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

      {/* Qui êtes-vous */}
      <div className="card">
        <div style={sectionTitle}>Qui êtes-vous ?</div>
        <div className="form-group">
          <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--text-dim)", marginBottom: "0.3rem" }}>Votre nom *</label>
          <div style={{ ...inputStyle, color: "var(--text)" }}>Marc Dubois</div>
        </div>
      </div>

      {/* Créneaux de départ préférés */}
      <div className="card">
        <div style={sectionTitle}>Créneaux de départ préférés</div>
        <p style={subText}>Optionnel — cochez les créneaux auxquels vous souhaitez participer.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {[
            { label: "Vague A", mono: "Départ à 14:00", checked: true },
            { label: "Vague B", mono: "Départ à 20:00", checked: false },
          ].map((st) => (
            <label key={st.label} style={{
              display: "flex", alignItems: "center", gap: "0.75rem",
              padding: "0.75rem 1rem",
              background: st.checked ? "var(--accent-dim)" : "var(--surface-2)",
              border: `1px solid ${st.checked ? "var(--accent)" : "var(--border)"}`,
              borderRadius: "3px", cursor: "default",
            }}>
              <input type="checkbox" readOnly checked={st.checked} style={{ accentColor: "var(--accent)", pointerEvents: "none" }} />
              <div>
                <div style={{ fontWeight: 600 }}>{st.label}</div>
                <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.8rem", color: "var(--accent)", marginTop: "0.1rem" }}>{st.mono}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Équipe */}
      <div className="card">
        <div style={sectionTitle}>Équipe</div>
        <p style={subText}>Optionnel — sélectionnez l'équipe que vous souhaitez rejoindre.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <RadioCard label="Pas de préférence" />
          <RadioCard label="Kronos Alpha" sub="Audi R8 LMS GT3 Evo 2 · GT3" mono="Vague A · Départ à 14:00" selected />
          <RadioCard label="Kronos Beta" sub="Ferrari 488 GT3 Evo 2022 · GT3" mono="Vague B · Départ à 20:00" mismatch="soft" />
          <RadioCard label="Kronos Gamma" sub="Porsche 911 GT3 R · GT3" mono="Vague A · Départ à 14:00" />
        </div>
        {/* MismatchWarning below team list */}
        <div style={{
          marginTop: "0.75rem",
          padding: "0.65rem 0.9rem",
          background: "#2a1a00",
          border: "1px solid #a06020",
          borderRadius: "3px",
          fontSize: "0.82rem",
          color: "#d4904a",
          display: "flex",
          gap: "0.5rem",
          alignItems: "flex-start",
        }}>
          <span>⚠️</span>
          <span>La voiture de cette équipe (Ferrari 488 GT3 Evo 2022) ne correspond pas à vos préférences (Audi R8 LMS GT3 Evo 2). La classe correspond (GT3).</span>
        </div>
      </div>

      {/* Classes préférées */}
      <div className="card">
        <div style={sectionTitle}>Classes préférées</div>
        <p style={subText}>Optionnel — sélectionnez une ou plusieurs classes.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <CheckCard label="GT3" checked />
          <CheckCard label="GTE" />
          <CheckCard label="LMP2" />
        </div>
      </div>

      {/* Voitures préférées */}
      <div className="card">
        <div style={sectionTitle}>Voitures préférées</div>
        <p style={subText}>Optionnel — sélectionnez une ou plusieurs voitures spécifiques.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {[
            { cls: "GT3", cars: ["Audi R8 LMS GT3 Evo 2", "Ferrari 488 GT3 Evo 2022", "Porsche 911 GT3 R"] },
            { cls: "GTE", cars: ["Ferrari 488 GTE"] },
          ].map(({ cls, cars }) => (
            <div key={cls}>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: "0.5rem" }}>{cls}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {cars.map((car) => <CheckCard key={car} label={car} checked={car === "Audi R8 LMS GT3 Evo 2"} />)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div className="card">
        <div style={sectionTitle}>Tags</div>
        <p style={subText}>Optionnel — sélectionnez un ou plusieurs tags pour décrire votre profil de pilote.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {[
            { name: "chill", selected: true },
            { name: "compet", selected: false },
            { name: "solo", selected: false },
            { name: "gros rouleur", selected: true },
          ].map((tag) => (
            <button key={tag.name} type="button" style={{
              padding: "0.35rem 0.85rem",
              borderRadius: "3px",
              border: `1px solid ${tag.selected ? "var(--accent)" : "var(--border)"}`,
              background: tag.selected ? "var(--accent-dim)" : "var(--surface-2)",
              color: tag.selected ? "var(--accent)" : "var(--text-dim)",
              fontSize: "0.88rem",
              fontWeight: 600,
              cursor: "default",
              fontFamily: "var(--font-rajdhani), sans-serif",
            }}>
              {tag.selected ? "✓ " : ""}{tag.name}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button className="btn btn-primary">✓ S'inscrire</button>
          <button className="btn btn-secondary">Annuler</button>
        </div>
        <button className="btn btn-danger" style={{ fontSize: "0.88rem" }}>Se désinscrire</button>
      </div>
    </div>
  );
}
