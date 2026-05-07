const labelStyle = {
  fontSize: "0.65rem",
  fontWeight: 700,
  letterSpacing: "0.07em",
  textTransform: "uppercase" as const,
  color: "var(--text-dim)",
  marginBottom: "0.5rem",
};

export default function AccueilDemo() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* 2-column planning grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        {/* Prochain événement */}
        <div className="card">
          <div style={labelStyle}>Prochain événement</div>
          <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.62rem", fontWeight: 700, padding: "0.1rem 0.45rem", background: "var(--accent)", color: "#fff", borderRadius: "2px" }}>Spécial</span>
          </div>
          <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "0.25rem" }}>Endurance GT 24h Le Mans</div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginBottom: "0.5rem" }}>Circuit de la Sarthe · GT3 · 24h</div>
          <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.9rem", color: "var(--accent)" }}>Sam. 23 avr. · 14:00</div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", marginTop: "0.2rem" }}>dans 5j 2h · 3 équipages</div>
        </div>

        {/* Mon prochain relais */}
        <div className="card">
          <div style={labelStyle}>Mon prochain relais</div>
          <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "0.2rem" }}>Endurance GT 24h</div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginBottom: "0.5rem" }}>Kronos Alpha · Relais 3</div>
          <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.9rem", color: "var(--accent)" }}>17:44 IRL</div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", marginTop: "0.2rem" }}>dans 3h 44min</div>
        </div>
      </div>

      {/* Mes événements à venir */}
      <div className="card">
        <div style={labelStyle}>Mes événements à venir</div>
        {[
          { name: "Endurance GT 24h Le Mans", circuit: "La Sarthe", date: "23 avr. 2026", crew: "Kronos Alpha", car: "Audi R8 LMS", inscrit: true },
          { name: "Spa 6h",                   circuit: "Spa",        date: "7 mai 2026",  crew: "Kronos Beta",  car: "Ferrari 488 GT3", inscrit: false },
        ].map((ev) => (
          <div key={ev.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.55rem 0", borderBottom: "1px solid var(--border)" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{ev.name}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>{ev.circuit} · {ev.date} · {ev.crew} · {ev.car}</div>
            </div>
            <button className="btn btn-secondary" style={{ fontSize: "0.78rem", padding: "0.25rem 0.6rem", opacity: 0.85 }}>Voir →</button>
          </div>
        ))}
      </div>
    </div>
  );
}
