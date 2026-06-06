import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";

const G61_LAPS = [
  { cond: "☀️", time: "1:50.990", fuel: "2.181", tank: "8.2",  temp: "38°", date: "23/05/25", car: "Ferrari 296 GT3", sess: "P" },
  { cond: "☀️", time: "1:51.340", fuel: "2.193", tank: "24.5", temp: "36°", date: "18/05/25", car: "Ferrari 296 GT3", sess: "P" },
  { cond: "☀️", time: "1:51.780", fuel: "2.196", tank: "45.1", temp: "34°", date: "10/05/25", car: "Ferrari 296 GT3", sess: "R" },
  { cond: "💧", time: "1:56.440", fuel: "2.134", tank: "12.0", temp: "22°", date: "02/05/25", car: "Ferrari 296 GT3", sess: "P" },
];

const inputStyle: CSSProperties = {
  fontSize: "0.72rem",
  padding: "0.1rem 0.3rem",
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: "3px",
  color: "var(--text)",
};

const TH: CSSProperties = {
  padding: "0.35rem 0.6rem",
  textAlign: "left",
  fontSize: "0.65rem",
  fontWeight: 700,
  letterSpacing: "0.07em",
  textTransform: "uppercase" as const,
  color: "var(--text-dim)",
  background: "var(--surface-2)",
  borderBottom: "1px solid var(--border)",
  whiteSpace: "nowrap",
};

const TD: CSSProperties = {
  padding: "0.3rem 0.6rem",
  borderBottom: "1px solid var(--border)",
  fontSize: "0.78rem",
  fontFamily: "var(--font-mono), monospace",
  color: "var(--text-dim)",
};

function Chip({ label, active }: { label: string; active?: boolean }) {
  const style: CSSProperties = {
    fontSize: "0.7rem",
    padding: "0.15rem 0.5rem",
    background: active ? "var(--accent)" : "var(--surface-2)",
    color: active ? "#000" : "var(--text-dim)",
    border: "1px solid var(--border)",
    borderRadius: "3px",
    cursor: "default",
    userSelect: "none",
  };
  return <span style={style}>{label}</span>;
}

export default function Garage61ImportDemo() {
  const t = useTranslations("performanceData");
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "6px", padding: "0.75rem 1rem", background: "var(--surface-1)" }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-dim)" }}>
          {t("importFromGarage61")}
        </span>
        <button className="btn btn-secondary btn-sm" style={{ fontSize: "0.72rem" }}>{t("loadLaps")}</button>
        <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Circuit des 24 Heures du Mans</span>
      </div>

      {/* Filter row 1 — condition / session / day-night / count */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "0.6rem" }}>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: "0.25rem" }}>
            <Chip label={t("filterAll")} active />
            <Chip label={t("filterDry")} />
            <Chip label={t("filterWet")} />
          </div>
          <div style={{ display: "flex", gap: "0.25rem" }}>
            <Chip label={t("filterAll")} active />
            <Chip label={t("filterP")} />
            <Chip label={t("filterQ")} />
            <Chip label={t("filterR")} />
          </div>
          <span style={{ fontSize: "0.72rem", color: "var(--text-dim)", marginLeft: "auto" }}>
            4/4 chronos
          </span>
        </div>

        {/* Filter row 2 — same car / fuel range / date presets + range */}
        <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.72rem", color: "var(--text-dim)", cursor: "default" }}>
            <input type="checkbox" readOnly defaultChecked /> {t("sameCar")}
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.72rem", color: "var(--text-dim)" }}>
            <span>{t("fuelRange")}</span>
            <input readOnly placeholder={t("fuelMin")} style={{ ...inputStyle, width: "58px" }} />
            <span>–</span>
            <input readOnly placeholder={t("fuelMax")} style={{ ...inputStyle, width: "58px" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.72rem", color: "var(--text-dim)" }}>
            <span>{t("trackTemp")}</span>
            <input readOnly placeholder={t("trackTempMin")} style={{ ...inputStyle, width: "58px" }} />
            <span>–</span>
            <input readOnly placeholder={t("trackTempMax")} style={{ ...inputStyle, width: "58px" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.72rem", color: "var(--text-dim)", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: "0.25rem" }}>
              <Chip label={t("dateAll")} active />
              <Chip label={t("date7d")} />
              <Chip label={t("date30d")} />
              <Chip label={t("date3m")} />
            </div>
            <span>{t("dateFrom")}</span>
            <input readOnly placeholder="aaaa-mm-jj" style={{ ...inputStyle, width: "100px" }} />
            <span>{t("dateTo")}</span>
            <input readOnly placeholder="aaaa-mm-jj" style={{ ...inputStyle, width: "100px" }} />
          </div>
        </div>
      </div>

      {/* Lap table */}
      <div style={{ border: "1px solid var(--border)", borderRadius: "4px", overflowX: "auto", maxHeight: "180px", overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem", minWidth: "520px" }}>
          <thead>
            <tr>
              {["", t("colLapTime"), t("colFuel"), t("colTank"), t("colTrackTemp"), t("colDate"), t("colCar"), t("colSession"), ""].map((h, i) => (
                <th key={i} style={TH}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {G61_LAPS.map((lap, i) => (
              <tr key={i}>
                <td style={{ ...TD, color: "var(--text)" }}>{lap.cond}</td>
                <td style={{ ...TD, color: "var(--text)" }}>{lap.time}</td>
                <td style={TD}>{lap.fuel}L</td>
                <td style={TD}>{lap.tank}L</td>
                <td style={TD}>{lap.temp}</td>
                <td style={TD}>{lap.date}</td>
                <td style={{ ...TD, maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lap.car}</td>
                <td style={TD}>{lap.sess}</td>
                <td style={{ ...TD, whiteSpace: "nowrap" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.15rem" }}>
                    {["☀️", "💧", "🌙☀️", "🌙💧"].map((icon) => (
                      <span key={icon} style={{ fontSize: "0.62rem", padding: "0.12rem 0.3rem", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "3px", textAlign: "center", cursor: "default" }}>
                        → {icon}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
