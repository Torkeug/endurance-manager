const EVENTS = [
  { day: "23", month: "AVR", year: "2026", name: "Endurance GT 24h Le Mans", circuit: "Circuit de la Sarthe", format: "GT3", duration: "24h", pilotes: 9, equipages: 3, special: true,  inscrit: true  },
  { day: "07", month: "MAI", year: "2026", name: "Spa 6 Heures",              circuit: "Circuit de Spa",        format: "GT3",     duration: "6h",  pilotes: 6, equipages: 2, special: false, inscrit: false },
  { day: "21", month: "JUN", year: "2026", name: "Nürburgring 24h",           circuit: "Nürburgring",           format: "GT3/GTE", duration: "24h", pilotes: 3, equipages: 1, special: false, inscrit: false },
];

const TABS = ["Normaux", "Spéciaux", "Championnats"];

import type { CSSProperties } from "react";

const statLabel: CSSProperties = {
  fontSize: "0.58rem",
  fontWeight: 700,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  color: "var(--text-dim)",
  marginBottom: "0.2rem",
  textAlign: "center",
};

const statVal: CSSProperties = {
  fontFamily: "var(--font-mono), monospace",
  fontSize: "0.95rem",
  fontWeight: 700,
  textAlign: "center",
};

export default function EvenementsDemo() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.25rem", borderBottom: "1px solid var(--border)", marginBottom: "1rem" }}>
        {TABS.map((t, i) => (
          <div key={t} style={{ padding: "0.5rem 1rem", borderBottom: i === 0 ? "2px solid var(--accent)" : "2px solid transparent", color: i === 0 ? "var(--accent)" : "var(--text-dim)", fontFamily: "var(--font-rajdhani), sans-serif", fontSize: "0.88rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {t}
          </div>
        ))}
      </div>

      {/* Event cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {EVENTS.map((ev) => (
          <div key={ev.name} style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.75rem 1rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "4px" }}>
            {/* Date block */}
            <div style={{ textAlign: "center", flexShrink: 0, minWidth: "40px" }}>
              <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: "1.5rem", fontWeight: 700, color: "var(--accent)", lineHeight: 1 }}>{ev.day}</div>
              <div style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-dim)" }}>{ev.month}</div>
              <div style={{ fontSize: "0.6rem", color: "var(--text-dim)" }}>{ev.year}</div>
            </div>

            {/* Event info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", gap: "0.35rem", marginBottom: "0.25rem", flexWrap: "wrap" }}>
                {ev.special && <span style={{ fontSize: "0.6rem", fontWeight: 700, padding: "0.1rem 0.4rem", background: "var(--accent)", color: "#fff", borderRadius: "2px" }}>Spécial</span>}
                {ev.inscrit && <span style={{ fontSize: "0.6rem", fontWeight: 700, padding: "0.1rem 0.4rem", background: "rgba(46,180,96,0.15)", border: "1px solid #2eb460", color: "#2eb460", borderRadius: "2px" }}>Inscrit ✓</span>}
              </div>
              <div style={{ fontWeight: 700, fontSize: "0.9rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ev.name}</div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>{ev.circuit}</div>
            </div>

            {/* Stats */}
            <div style={{ display: "flex", gap: "1.25rem", flexShrink: 0 }}>
              <div>
                <div style={statLabel}>Format</div>
                <div style={{ ...statVal, fontSize: "0.78rem" }}>{ev.format}</div>
              </div>
              <div>
                <div style={statLabel}>Pilotes</div>
                <div style={statVal}>{ev.pilotes}</div>
              </div>
              <div>
                <div style={statLabel}>Équipages</div>
                <div style={statVal}>{ev.equipages}</div>
              </div>
              <div>
                <div style={statLabel}>Durée</div>
                <div style={statVal}>{ev.duration}</div>
              </div>
            </div>

            <div style={{ color: "var(--text-dim)", flexShrink: 0 }}>›</div>
          </div>
        ))}
      </div>
    </div>
  );
}
