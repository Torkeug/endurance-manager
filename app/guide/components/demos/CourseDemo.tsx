const STINTS_DEMO = [
  { n: 1, done: true,   active: false },
  { n: 2, done: true,   active: false },
  { n: 3, done: false,  active: true  },
  { n: 4, done: false,  active: false },
  { n: 5, done: false,  active: false },
];

const labelStyle = {
  fontSize: "0.65rem",
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase" as const,
  color: "var(--text-dim)",
  marginBottom: "0.15rem",
};

export default function CourseDemo() {
  const progress = 38;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Race progress bar */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: "0.35rem" }}>
          <span>Progression de la course</span>
          <span style={{ fontFamily: "var(--font-mono), monospace" }}>−5h 33min 12s</span>
        </div>
        <div style={{ height: "8px", background: "var(--surface-2)", borderRadius: "4px", overflow: "hidden", border: "1px solid var(--border)" }}>
          <div style={{ height: "100%", width: `${progress}%`, background: "var(--accent)", borderRadius: "4px", transition: "width 1s linear" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--text-dim)", marginTop: "0.25rem" }}>
          <span style={{ fontFamily: "var(--font-mono), monospace" }}>14:00</span>
          <span style={{ fontFamily: "var(--font-mono), monospace", color: "var(--accent)", fontSize: "0.8rem" }}>{progress}%</span>
          <span style={{ fontFamily: "var(--font-mono), monospace" }}>23:00</span>
        </div>
      </div>

      {/* Stint progress pills */}
      <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
        {STINTS_DEMO.map((s) => (
          <div
            key={s.n}
            title={`Relais ${s.n}`}
            style={{
              flex: 1,
              minWidth: "24px",
              height: "6px",
              borderRadius: "3px",
              background: s.done ? "#2eb460" : s.active ? "var(--accent)" : "var(--surface-2)",
              border: `1px solid ${s.active ? "var(--accent)" : "var(--border)"}`,
              transition: "background 0.3s",
            }}
          />
        ))}
      </div>

      {/* Current stint card */}
      <div className="card" style={{ borderColor: "var(--accent-dim)" }}>
        {/* Status label */}
        <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent)", marginBottom: "0.75rem" }}>
          🟢 En course — Relais 3 / 5
        </div>

        {/* Driver name */}
        <div style={{ fontFamily: "var(--font-rajdhani), sans-serif", fontSize: "2rem", fontWeight: 700, color: "var(--text)", lineHeight: 1, marginBottom: "0.5rem" }}>
          Théo Bernard
        </div>

        {/* Timing row */}
        <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
          <div>
            <div style={labelStyle}>Départ relais</div>
            <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.95rem" }}>17:44</div>
          </div>
          <div>
            <div style={labelStyle}>Fin prévue</div>
            <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.95rem" }}>19:36</div>
          </div>
          <div>
            <div style={labelStyle}>Temps restant</div>
            <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: "1.5rem", fontWeight: 700, lineHeight: 1, color: "var(--text)" }}>
              01:12:08
            </div>
          </div>
        </div>

        {/* Undo button */}
        <div style={{ textAlign: "right", marginBottom: "0.5rem" }}>
          <button className="btn btn-danger" style={{ fontSize: "0.78rem", opacity: 0.85 }}>
            ↩ Annuler dernier arrêt
          </button>
        </div>

        {/* Pit stop buttons — flex column inside card */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <button style={{
            width: "100%",
            padding: "1rem",
            fontSize: "1rem",
            fontFamily: "var(--font-rajdhani), sans-serif",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            background: "var(--accent)",
            color: "#fff",
            border: "1px solid transparent",
            borderRadius: "4px",
            cursor: "pointer",
            opacity: 0.85,
          }}>
            ⏱ Marquer arrêt au stand
          </button>

          {/* Overdue stint button — teal, inside same flex column */}
          <button style={{
            width: "100%",
            padding: "0.6rem 1rem",
            fontSize: "0.82rem",
            fontFamily: "var(--font-rajdhani), sans-serif",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            background: "rgba(90,200,200,0.08)",
            color: "#5ac8c8",
            border: "1px solid rgba(90,200,200,0.4)",
            borderRadius: "4px",
            cursor: "pointer",
          }}>
            ⏱ Marquer fin relais précédent
          </button>
        </div>
      </div>
    </div>
  );
}
