import { useState } from "react";
import type { CSSProperties } from "react";

const EVENTS = [
  { day: "17", month: "MAI", year: "2026", name: "Spa 6 Heures",               circuit: "Circuit de Spa",        format: "GT3",     duration: "6h",  pilotes: 6,  equipages: 2, type: "normal",      inscrit: true  },
  { day: "07", month: "JUN", year: "2026", name: "KRGT Endurance — Manche 2",  circuit: "Nürburgring",           format: "GT3",     duration: "3h",  pilotes: 4,  equipages: 1, type: "championnat", inscrit: false, manche: 2 },
  { day: "23", month: "JUL", year: "2026", name: "Endurance GT 24h Le Mans",   circuit: "Circuit de la Sarthe",  format: "GT3/GTE", duration: "24h", pilotes: 9,  equipages: 3, type: "special",     inscrit: false },
  { day: "12", month: "SEP", year: "2026", name: "Watkins Glen 12 Heures",     circuit: "Watkins Glen",          format: "GT3",     duration: "12h", pilotes: 7,  equipages: 2, type: "normal",      inscrit: false },
];

const TABS = ["Tous", "Normaux", "Spéciaux", "Championnats"];

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

function TypeBadge({ type, manche }: { type: string; manche?: number }) {
  if (type === "special") {
    return (
      <span style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", padding: "0.1rem 0.4rem", background: "rgba(255,170,0,0.1)", border: "1px solid #ffaa00", borderRadius: "2px", color: "#ffaa00" }}>
        Spécial
      </span>
    );
  }
  if (type === "championnat") {
    return (
      <>
        <span style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", padding: "0.1rem 0.4rem", background: "rgba(160,100,240,0.1)", border: "1px solid #a064f0", borderRadius: "2px", color: "#a064f0" }}>
          Championnat
        </span>
        {manche && (
          <span style={{ fontSize: "0.6rem", fontWeight: 700, padding: "0.1rem 0.4rem", background: "var(--accent-dim)", border: "1px solid var(--accent)", borderRadius: "2px", color: "var(--accent)" }}>
            Manche {manche}
          </span>
        )}
      </>
    );
  }
  return null;
}

export default function EvenementsDemo() {
  const [activeTab, setActiveTab] = useState(0);

  const visibleEvents = activeTab === 0 ? EVENTS
    : activeTab === 1 ? EVENTS.filter((e) => e.type === "normal")
    : activeTab === 2 ? EVENTS.filter((e) => e.type === "special")
    : EVENTS.filter((e) => e.type === "championnat");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.25rem", borderBottom: "1px solid var(--border)", marginBottom: "1rem" }}>
        {TABS.map((t, i) => (
          <div
            key={t}
            onClick={() => setActiveTab(i)}
            style={{ padding: "0.5rem 1rem", borderBottom: activeTab === i ? "2px solid var(--accent)" : "2px solid transparent", color: activeTab === i ? "var(--accent)" : "var(--text-dim)", fontFamily: "var(--font-rajdhani), sans-serif", fontSize: "0.88rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer" }}
          >
            {t}
          </div>
        ))}
      </div>

      {/* Event cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {visibleEvents.map((ev) => (
          <div key={ev.name} style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.75rem 1rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "4px" }}>
            {/* Date block */}
            <div style={{ textAlign: "center", flexShrink: 0, minWidth: "40px" }}>
              <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: "1.5rem", fontWeight: 700, color: "var(--accent)", lineHeight: 1 }}>{ev.day}</div>
              <div style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-dim)" }}>{ev.month}</div>
              <div style={{ fontSize: "0.6rem", color: "var(--text-dim)" }}>{ev.year}</div>
            </div>

            {/* Event info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", gap: "0.35rem", marginBottom: "0.25rem", flexWrap: "wrap", alignItems: "center" }}>
                <TypeBadge type={ev.type} manche={"manche" in ev ? ev.manche : undefined} />
                {ev.inscrit && (
                  <span style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", padding: "0.1rem 0.4rem", background: "rgba(46,180,96,0.15)", border: "1px solid #2eb460", color: "#2eb460", borderRadius: "2px" }}>
                    Inscrit ✓
                  </span>
                )}
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
        {visibleEvents.length === 0 && (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-dim)", fontSize: "0.9rem" }}>
            Aucun événement dans cette catégorie.
          </div>
        )}
      </div>
    </div>
  );
}
