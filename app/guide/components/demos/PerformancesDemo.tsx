import type { CSSProperties } from "react";

const DRIVERS = [
  { name: "Marc Dubois",   dry: "1:52.340", wet: "1:58.120", fuelDry: "2.14", fuelWet: "2.09", setDry: "Base",  setWet: "Pluie" },
  { name: "Léa Fontaine",  dry: "1:53.810", wet: null,       fuelDry: "2.11", fuelWet: null,   setDry: "Soft",  setWet: null    },
  { name: "Théo Bernard",  dry: "1:50.990", wet: "1:56.440", fuelDry: "2.18", fuelWet: "2.13", setDry: "Base",  setWet: "Pluie" },
];

const G61_LAPS = [
  { cond: "☀️", time: "1:50.990", fuel: "2.18", tank: "8.2",  temp: "38°", date: "23/05/25", car: "Ferrari 296 GT3", sess: "P" },
  { cond: "☀️", time: "1:51.340", fuel: "2.21", tank: "24.5", temp: "36°", date: "18/05/25", car: "Ferrari 296 GT3", sess: "P" },
  { cond: "☀️", time: "1:51.780", fuel: "2.19", tank: "45.1", temp: "34°", date: "10/05/25", car: "Ferrari 296 GT3", sess: "R" },
  { cond: "💧", time: "1:56.440", fuel: "2.13", tank: "12.0", temp: "22°", date: "02/05/25", car: "Ferrari 296 GT3", sess: "P" },
];

const TH: CSSProperties = {
  padding: "0.5rem 0.6rem",
  textAlign: "left",
  fontSize: "0.72rem",
  fontWeight: 700,
  letterSpacing: "0.07em",
  textTransform: "uppercase" as const,
  color: "var(--text-dim)",
  borderBottom: "1px solid var(--border)",
  whiteSpace: "nowrap",
};

const TD: CSSProperties = {
  padding: "0.55rem 0.6rem",
  borderBottom: "1px solid var(--border)",
  fontSize: "0.85rem",
};

const MONO: CSSProperties = {
  fontFamily: "var(--font-mono), monospace",
  fontSize: "0.82rem",
};

const G61TH: CSSProperties = {
  ...TH,
  fontSize: "0.65rem",
  padding: "0.35rem 0.6rem",
  background: "var(--surface-2)",
};

const G61TD: CSSProperties = {
  padding: "0.3rem 0.6rem",
  borderBottom: "1px solid var(--border)",
  fontSize: "0.78rem",
  fontFamily: "var(--font-mono), monospace",
  color: "var(--text-dim)",
};

const chipActive: CSSProperties = {
  fontSize: "0.68rem",
  padding: "0.12rem 0.45rem",
  background: "var(--accent)",
  color: "#000",
  border: "1px solid var(--border)",
  borderRadius: "3px",
  cursor: "default",
};

const chipInactive: CSSProperties = {
  ...chipActive,
  background: "var(--surface-2)",
  color: "var(--text-dim)",
};

export default function PerformancesDemo() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* ── Main performance table ── */}
      <div className="table-wrap" style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "560px" }}>
          <thead>
            <tr>
              <th style={TH}>Pilote</th>
              <th style={TH}>Chrono ☀️</th>
              <th style={TH}>Chrono 💧</th>
              <th style={TH}>Conso ☀️</th>
              <th style={TH}>Conso 💧</th>
              <th style={TH}>Réglages ☀️</th>
              <th style={TH}>Réglages 💧</th>
              <th style={TH}></th>
            </tr>
          </thead>
          <tbody>
            {DRIVERS.map((d) => (
              <tr key={d.name}>
                <td style={{ ...TD, fontWeight: 600 }}>{d.name}</td>
                <td style={{ ...TD, ...MONO }}>{d.dry}</td>
                <td style={{ ...TD, ...MONO, color: d.wet ? "var(--text)" : "var(--text-dim)" }}>
                  {d.wet ?? <span style={{ fontSize: "0.72rem" }}>~{d.dry}</span>}
                </td>
                <td style={{ ...TD, ...MONO }}>{d.fuelDry} L/t</td>
                <td style={{ ...TD, ...MONO, color: d.fuelWet ? "var(--text)" : "var(--text-dim)" }}>
                  {d.fuelWet ? `${d.fuelWet} L/t` : <span style={{ fontSize: "0.72rem" }}>~{d.fuelDry} L/t</span>}
                </td>
                <td style={{ ...TD, color: "var(--text-dim)", fontSize: "0.82rem" }}>{d.setDry}</td>
                <td style={{ ...TD, color: "var(--text-dim)", fontSize: "0.82rem" }}>{d.setWet ?? "—"}</td>
                <td style={TD}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                    <button className="btn btn-secondary btn-sm" style={{ fontSize: "0.75rem" }}>Modifier</button>
                    <button className="btn btn-secondary btn-sm" style={{ fontSize: "0.72rem" }}>📥 Garage61</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: "0.5rem 0.75rem", fontSize: "0.72rem", color: "var(--text-dim)", display: "flex", gap: "1.25rem", flexWrap: "wrap" }}>
          <span style={{ color: "#a07830" }}>* modificateur équipage</span>
          <span style={{ color: "#806020" }}>~ sans modificateur configuré</span>
        </div>
      </div>

      {/* ── Garage61 import panel ── */}
      <div style={{ border: "1px solid var(--border)", borderRadius: "6px", padding: "0.75rem", background: "var(--surface-1)" }}>
        <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: "0.75rem" }}>
          📥 Panneau d'import Garage61
        </div>

        {/* Filter row 1 */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.4rem", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "0.2rem" }}>
            <span style={chipActive}>Tous</span>
            <span style={chipInactive}>☀️ Sec</span>
            <span style={chipInactive}>💧 Pluie</span>
          </div>
          <div style={{ display: "flex", gap: "0.2rem" }}>
            <span style={chipActive}>Tous</span>
            <span style={chipInactive}>P</span>
            <span style={chipInactive}>Q</span>
            <span style={chipInactive}>R</span>
          </div>
          <div style={{ display: "flex", gap: "0.2rem" }}>
            <span style={chipActive}>Tous</span>
            <span style={chipInactive}>☀️ Jour</span>
            <span style={chipInactive}>🌙 Nuit</span>
          </div>
          <span style={{ fontSize: "0.72rem", color: "var(--text-dim)", marginLeft: "auto" }}>4/4 chronos</span>
        </div>

        {/* Filter row 2 */}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.75rem", alignItems: "center", fontSize: "0.72rem", color: "var(--text-dim)" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", cursor: "default" }}>
            <input type="checkbox" readOnly /> Même voiture
          </label>
          <span>Réservoir</span>
          <input readOnly value="" placeholder="min L" style={{ width: "52px", fontSize: "0.72rem", padding: "0.1rem 0.3rem", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "3px", color: "var(--text)" }} />
          <span>–</span>
          <input readOnly value="" placeholder="max L" style={{ width: "52px", fontSize: "0.72rem", padding: "0.1rem 0.3rem", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "3px", color: "var(--text)" }} />
          <div style={{ display: "flex", gap: "0.2rem" }}>
            <span style={chipActive}>Tout</span>
            <span style={chipInactive}>7j</span>
            <span style={chipInactive}>30j</span>
            <span style={chipInactive}>3 mois</span>
          </div>
        </div>

        {/* Lap table */}
        <div style={{ border: "1px solid var(--border)", borderRadius: "4px", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem", minWidth: "560px" }}>
            <thead>
              <tr>
                {["", "Chrono", "Conso", "Réservoir", "T. Piste", "Date", "Voiture", "Session", ""].map((h, i) => (
                  <th key={i} style={G61TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {G61_LAPS.map((lap, i) => (
                <tr key={i}>
                  <td style={{ ...G61TD, color: "var(--text)" }}>{lap.cond}</td>
                  <td style={{ ...G61TD, color: "var(--text)" }}>{lap.time}</td>
                  <td style={G61TD}>{lap.fuel}L</td>
                  <td style={G61TD}>{lap.tank}L</td>
                  <td style={G61TD}>{lap.temp}</td>
                  <td style={G61TD}>{lap.date}</td>
                  <td style={{ ...G61TD, maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lap.car}</td>
                  <td style={G61TD}>{lap.sess}</td>
                  <td style={{ ...G61TD, whiteSpace: "nowrap" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.15rem" }}>
                      {["☀️", "💧", "🌙☀️", "🌙💧"].map((icon) => (
                        <span key={icon} style={{ fontSize: "0.62rem", padding: "0.12rem 0.3rem", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "3px", textAlign: "center", cursor: "default" }}>→ {icon}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
