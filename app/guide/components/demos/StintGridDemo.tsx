import type { CSSProperties } from "react";

// Driver names (abbreviated as in actual app: firstName + initial)
const DRIVER_COLS = [
  { abbr: "Marc", id: 0 },
  { abbr: "Léa",  id: 1 },
  { abbr: "Théo", id: 2 },
];

// Dot color from availability status
const DOT_COLORS: Record<string, string> = {
  available:   "#2eb460",
  partial:     "#c9a84c",
  unavailable: "#e05555",
  tentative:   "#4a4a6a",
  none:        "#3a3a5a",
};

// [driver]: availability status per stint
// "assigned" means this driver is driving this stint (outlined dot)
const DOTS: Array<[string, string, string]> = [
  // Marc,        Léa,          Théo
  ["assigned",    "unavailable", "available"  ],  // stint 1
  ["available",   "assigned",    "available"  ],  // stint 2
  ["available",   "unavailable", "assigned"   ],  // stint 3
  ["assigned",    "unavailable", "available"  ],  // stint 4
  ["available",   "unavailable", "assigned"   ],  // stint 5
];

const STINTS = [
  { n: 1, driver: "Marc Dubois",  start: "14:00", end: "15:52", endActual: "15:50", duration: "1h 52min", laps: 42, fuel: 87.4, skipFuel: "47.20 L/tr", ig: "☀️", timer: false, rain: false, tyre: false },
  { n: 2, driver: "Léa Fontaine", start: "15:52", end: "17:44", endActual: null,    duration: "1h 52min", laps: 42, fuel: 87.4, skipFuel: "47.20 L/tr", ig: "🌗", timer: false, rain: false, tyre: true  },
  { n: 3, driver: "Théo Bernard", start: "17:44", end: "19:36", endActual: null,    duration: "1h 52min", laps: 41, fuel: 85.3, skipFuel: "48.10 L/tr", ig: "🌑", timer: false, rain: false, tyre: false },
  { n: 4, driver: "Marc Dubois",  start: "19:36", end: "21:28", endActual: null,    duration: "1h 52min", laps: 38, fuel: 82.1, skipFuel: "51.30 L/tr", ig: "🌑", timer: true,  rain: true,  tyre: false },
  { n: 5, driver: "À définir",    start: "21:28", end: "23:20", endActual: null,    duration: "1h 52min", laps: 42, fuel: 87.4, skipFuel: null,          ig: "🌑", timer: false, rain: false, tyre: false },
];

const TH: CSSProperties = {
  padding: "0.5rem 0.4rem",
  textAlign: "left",
  fontSize: "0.68rem",
  fontWeight: 700,
  letterSpacing: "0.07em",
  textTransform: "uppercase" as const,
  color: "var(--text-dim)",
  borderBottom: "1px solid var(--border)",
  whiteSpace: "nowrap",
  background: "var(--surface-2)",
};

const TD: CSSProperties = {
  padding: "0.5rem 0.4rem",
  borderBottom: "1px solid var(--border)",
  fontSize: "0.82rem",
};

const MONO: CSSProperties = {
  fontFamily: "var(--font-mono), monospace",
  fontSize: "0.8rem",
};

const STRATEGIES = [
  { id: 1, name: "Plan A", desc: "Météo sèche — nominal", offset: 0,  active: true  },
  { id: 2, name: "Plan B", desc: "Pluie probable",         offset: 3,  active: false },
];

export default function StintGridDemo() {
  return (
    <div>
      {/* ── Strategy tabs ── */}
      <div style={{ display: "flex", gap: "0.25rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
        {STRATEGIES.map((s, i) => (
          <div
            key={s.id}
            style={{
              padding: "0.3rem 0.85rem",
              borderRadius: "3px",
              fontSize: "0.8rem",
              fontWeight: 700,
              fontFamily: "var(--font-rajdhani), sans-serif",
              letterSpacing: "0.05em",
              cursor: "default",
              background: i === 0 ? "var(--accent)" : "var(--surface-2)",
              color: i === 0 ? "#000" : "var(--text-dim)",
              border: i === 0 ? "1px solid var(--accent)" : "1px solid var(--border)",
            }}
          >
            {s.name}
          </div>
        ))}
        <div style={{
          padding: "0.3rem 0.75rem",
          borderRadius: "3px",
          fontSize: "0.8rem",
          cursor: "default",
          background: "var(--surface-2)",
          color: "var(--text-dim)",
          border: "1px solid var(--border)",
        }}>
          + Nouvelle
        </div>
      </div>

      {/* ── Strategy metadata ── */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "0.75rem", padding: "0.65rem 0.85rem", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "4px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
          <span style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-dim)" }}>Nom</span>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "3px", padding: "0.28rem 0.5rem", fontSize: "0.82rem", fontWeight: 700, fontFamily: "var(--font-rajdhani), sans-serif", color: "var(--text)", minWidth: "90px" }}>Plan A</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem", flex: 1, minWidth: "160px" }}>
          <span style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-dim)" }}>Description</span>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "3px", padding: "0.28rem 0.5rem", fontSize: "0.82rem", color: "var(--text-dim)" }}>Météo sèche — nominal</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
          <span style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-dim)" }}>Décalage départ</span>
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "3px", padding: "0.28rem 0.5rem", fontSize: "0.82rem", fontFamily: "var(--font-mono), monospace", color: "var(--text)", width: "36px", textAlign: "right" }}>0</div>
            <span style={{ fontSize: "0.82rem", color: "var(--text-dim)" }}>min</span>
          </div>
        </div>
        <span style={{ fontSize: "0.75rem", color: "#c9a84c", padding: "0.3rem 0.6rem", background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.3)", borderRadius: "3px", whiteSpace: "nowrap" }}>★ Active</span>
      </div>

      {/* ── Summary bar ── */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
        {[
          { label: "Départ",     value: "14:00" },
          { label: "Fin course", value: "23:00" },
          { label: "Relais",     value: "5" },
          { label: "Fin prévue", value: "23:02", color: "#2eb460" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "4px", padding: "0.5rem 0.85rem", flex: 1, minWidth: "100px" }}>
            <div style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: "0.15rem" }}>{label}</div>
            <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.88rem", fontWeight: 700, color: color ?? "var(--text)" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Legend — availability dots */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "0.35rem", fontSize: "0.72rem", color: "var(--text-dim)", flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontWeight: 700, color: "var(--text)" }}>Dispo :</span>
        {[
          { color: "#2eb460", label: "Disponible" },
          { color: "#c9a84c", label: "Partielle" },
          { color: "#e05555", label: "Indisponible" },
          { color: "#4a4a6a", label: "Incertain" },
        ].map(({ color, label }) => (
          <span key={label} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
            {label}
          </span>
        ))}
        <span style={{ marginLeft: "0.5rem" }}>🛞 = Chgt pneus · 💧 = Pluie</span>
      </div>

      <div className="table-wrap" style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: `${760 + DRIVER_COLS.length * 26}px` }}>
          <thead>
            <tr>
              <th style={{ ...TH, width: "28px" }}>#</th>
              <th style={{ ...TH, minWidth: "130px" }}>Pilote</th>
              <th style={TH}>Départ IRL</th>
              <th style={TH}>Fin IRL</th>
              <th style={{ ...TH, minWidth: "110px" }}>Fin réelle</th>
              <th style={{ ...TH, width: "80px" }}>Durée</th>
              <th style={{ ...TH, width: "52px" }}>Tours</th>
              <th style={{ ...TH, width: "62px" }}>Conso</th>
              <th style={{ ...TH, width: "92px" }}>Skip fin</th>
              <th style={{ ...TH, width: "52px" }}>IG</th>
              <th style={{ ...TH, width: "24px" }}>⏱</th>
              <th style={{ ...TH, width: "24px" }}>💧</th>
              <th style={{ ...TH, width: "24px" }}>🛞</th>
              {DRIVER_COLS.map((d) => (
                <th key={d.id} style={{ ...TH, width: "26px", textAlign: "center", fontSize: "0.58rem" }}>
                  {d.abbr}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {STINTS.map((s, si) => (
              <tr key={s.n} style={{ background: s.driver === "À définir" ? "rgba(120,120,140,0.06)" : undefined }}>
                <td style={{ ...TD, ...MONO, color: "var(--text-dim)", textAlign: "center" }}>{s.n}</td>
                <td style={{ ...TD, fontWeight: s.driver === "À définir" ? 400 : 600, color: s.driver === "À définir" ? "var(--text-dim)" : "var(--text)" }}>
                  {s.driver}
                </td>
                <td style={{ ...TD, ...MONO }}>{s.start}</td>
                <td style={{ ...TD, ...MONO }}>{s.end}</td>
                {/* Fin réelle */}
                <td style={{ ...TD, ...MONO, color: s.endActual ? "#2eb460" : "var(--text-dim)" }}>
                  {s.endActual ?? "—"}
                </td>
                <td style={{ ...TD, ...MONO }}>{s.duration}</td>
                <td style={{ ...TD, textAlign: "center" }}>{s.laps}</td>
                <td style={{ ...TD, ...MONO }}>
                  <span style={{ color: s.fuel > 86 ? "var(--danger)" : "var(--text)" }}>{s.fuel}L</span>
                </td>
                {/* Skip fin */}
                <td style={{ ...TD, ...MONO, fontSize: "0.72rem", color: s.skipFuel ? "var(--accent)" : "var(--text-dim)" }}>
                  {s.skipFuel ?? "—"}
                </td>
                <td style={{ ...TD, textAlign: "center" }}>{s.ig}</td>
                <td style={{ ...TD, textAlign: "center", fontSize: "0.75rem" }}>{s.timer ? "✓" : ""}</td>
                <td style={{ ...TD, textAlign: "center" }}>{s.rain ? "✓" : ""}</td>
                <td style={{ ...TD, textAlign: "center" }}>{s.tyre ? "✓" : ""}</td>
                {/* Availability dots */}
                {DRIVER_COLS.map((d) => {
                  const status = DOTS[si][d.id];
                  const isAssigned = status === "assigned";
                  const dotColor = isAssigned ? DOT_COLORS.available : (DOT_COLORS[status] ?? DOT_COLORS.none);
                  return (
                    <td key={d.id} style={{ ...TD, textAlign: "center", padding: "0.35rem 0.2rem" }}>
                      <div style={{
                        width: "9px",
                        height: "9px",
                        borderRadius: "50%",
                        background: dotColor,
                        margin: "0 auto",
                        outline: isAssigned ? "2px solid var(--accent)" : "none",
                        outlineOffset: "2px",
                      }} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
