import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";

const DRIVERS = [
  { name: "Marc Dubois",   dry: "1:52.340", wet: "1:58.120", fuelDry: "2.14", fuelWet: "2.09", setDry: "Base",  setWet: "Pluie" },
  { name: "Léa Fontaine",  dry: "1:53.810", wet: null,       fuelDry: "2.11", fuelWet: null,   setDry: "Soft",  setWet: null    },
  { name: "Théo Bernard",  dry: "1:50.990", wet: "1:56.440", fuelDry: "2.18", fuelWet: "2.13", setDry: "Base",  setWet: "Pluie" },
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

export default function PerformancesDemo() {
  const t = useTranslations("performanceData");
  return (
    <div className="table-wrap" style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "560px" }}>
        <thead>
          <tr>
            <th style={TH}>{t("colDriver")}</th>
            <th style={TH}>{t("colDryLap")}</th>
            <th style={TH}>{t("colWetLap")}</th>
            <th style={TH}>{t("colDryFuel")}</th>
            <th style={TH}>{t("colWetFuel")}</th>
            <th style={TH}>{t("colDrySetup")}</th>
            <th style={TH}>{t("colWetSetup")}</th>
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
                  <button className="btn btn-secondary btn-sm" style={{ fontSize: "0.75rem" }}>{t("edit")}</button>
                  <button className="btn btn-secondary btn-sm" style={{ fontSize: "0.72rem" }}>{t("importGarage61")}</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ padding: "0.5rem 0.75rem", fontSize: "0.72rem", color: "var(--text-dim)", display: "flex", gap: "1.25rem", flexWrap: "wrap" }}>
        <span style={{ color: "#a07830" }}>* {t("teamModifier")}</span>
        <span style={{ color: "#806020" }}>~ {t("noModifier")}</span>
      </div>
    </div>
  );
}
