import React from "react";

const TH = {
  background: "var(--surface-2)", color: "var(--text-dim)", fontSize: "0.72rem", fontWeight: 700,
  letterSpacing: "0.08em", textTransform: "uppercase" as const, padding: "0.6rem 1rem",
  textAlign: "left" as const, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" as const,
};
const TD = { padding: "0.6rem 1rem", borderBottom: "1px solid var(--border)", verticalAlign: "middle" as const };

const CARS = [
  { name: "Audi R8 LMS GT3 EVO II",  cls: "GT3", type: "gt3",  tank: 120, fuel: null },
  { name: "Ferrari 296 GT3",           cls: "GT3", type: "gt3",  tank: 110, fuel: null },
  { name: "Porsche 992 GT3 R",         cls: "GT3", type: "gt3",  tank: 115, fuel: 2.8  },
  { name: "Ferrari 499P",              cls: "GTP", type: "gtp",  tank: 90,  fuel: null },
  { name: "Porsche 963 GTP",           cls: "GTP", type: "gtp",  tank: 88,  fuel: null },
];

const byClass: Record<string, typeof CARS> = {};
for (const c of CARS) {
  if (!byClass[c.cls]) byClass[c.cls] = [];
  byClass[c.cls].push(c);
}

export default function AdminCarsDemo() {
  return (
    <div>
      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: "0.25rem", borderBottom: "1px solid var(--border)", marginBottom: "1.5rem" }}>
        {["Kronos Endurance", "Catalogue iRacing"].map((tab, i) => (
          <button key={tab} style={{
            padding: "0.5rem 1.25rem", background: "transparent", border: "none",
            borderBottom: i === 0 ? "2px solid var(--accent)" : "2px solid transparent",
            color: i === 0 ? "var(--accent)" : "var(--text-dim)",
            fontFamily: "var(--font-rajdhani),sans-serif", fontSize: "0.85rem",
            fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const,
            cursor: "default", marginBottom: "-1px",
          }}>{tab}</button>
        ))}
      </div>

      <button className="btn btn-primary" style={{ marginBottom: "0.75rem" }}>+ Ajouter une voiture</button>

      <div className="table-wrap" style={{ marginBottom: "0.75rem" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={TH}>Voiture</th>
              <th style={TH}>Classe</th>
              <th style={TH}>Type iRacing</th>
              <th style={TH}>Réservoir</th>
              <th style={TH}>Ravit.</th>
              <th style={TH} />
            </tr>
          </thead>
          <tbody>
            {Object.entries(byClass).map(([cls, cars]) => (
              <React.Fragment key={cls}>
                <tr style={{ background: "var(--surface-2)" }}>
                  <td colSpan={6} style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "var(--text-dim)", padding: "0.4rem 1rem" }}>
                    {cls}
                  </td>
                </tr>
                {cars.map((car) => (
                  <tr key={car.name}>
                    <td style={{ ...TD, fontWeight: 600 }}>{car.name}</td>
                    <td style={TD}><span className="badge badge-driver">{car.cls}</span></td>
                    <td style={TD}>
                      {car.type
                        ? <span className="mono" style={{ fontSize: "0.78rem", color: "var(--accent)" }}>{car.type.toUpperCase()}</span>
                        : <span style={{ color: "var(--text-dim)", fontSize: "0.78rem" }}>—</span>}
                    </td>
                    <td className="mono" style={{ ...TD, color: "var(--accent)" }}>{car.tank}L</td>
                    <td className="mono" style={{ ...TD, fontSize: "0.82rem" }}>
                      {car.fuel != null
                        ? <span style={{ color: "var(--accent)" }}>{car.fuel} L/s</span>
                        : <span style={{ color: "var(--text-dim)" }}>classe</span>}
                    </td>
                    <td style={{ ...TD, textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                        <button className="btn btn-secondary btn-sm">Modifier</button>
                        <button className="btn btn-danger btn-sm">Supprimer</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
