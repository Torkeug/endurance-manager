import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";

const DRIVERS = [
  { name: "Marc Dubois",  iracingId: 482910, irating: 4210, discord: "marc#1234",  twitch: null,         role: "admin" },
  { name: "Léa Fontaine", iracingId: 371045, irating: 3870, discord: "lea#5678",   twitch: "leafontsim", role: "driver" },
  { name: "Théo Bernard", iracingId: 519203, irating: 5120, discord: null,          twitch: null,         role: "driver" },
];

const TH: CSSProperties = {
  padding: "0.6rem 0.75rem",
  textAlign: "left",
  fontSize: "0.75rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  color: "var(--text-dim)",
  borderBottom: "1px solid var(--border)",
  whiteSpace: "nowrap",
};

const TD: CSSProperties = {
  padding: "0.65rem 0.75rem",
  borderBottom: "1px solid var(--border)",
  fontSize: "0.9rem",
};

export default function PilotsDemo() {
  const t = useTranslations("driverList");
  return (
    <div className="table-wrap">
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={TH}>{t("colName")}</th>
            <th style={TH}>{t("colIRacingId")}</th>
            <th style={TH}>{t("colIRating")}</th>
            <th style={TH}>{t("colDiscord")}</th>
            <th style={TH}>{t("colTwitch")}</th>
            <th style={TH}>{t("colRole")}</th>
            <th style={TH}></th>
          </tr>
        </thead>
        <tbody>
          {DRIVERS.map((d) => (
            <tr key={d.name}>
              <td style={{ ...TD, fontWeight: 600 }}>{d.name}</td>
              <td style={{ ...TD, fontFamily: "var(--font-mono), monospace", fontSize: "0.85rem", color: "var(--text-dim)" }}>
                {d.iracingId}
              </td>
              <td style={{ ...TD, fontFamily: "var(--font-mono), monospace", color: "var(--accent)", fontSize: "0.85rem" }}>
                {d.irating}
              </td>
              <td style={{ ...TD, color: "var(--text-dim)", fontSize: "0.9rem" }}>{d.discord ?? "—"}</td>
              <td style={{ ...TD, fontSize: "0.9rem" }}>
                {d.twitch ? (
                  <span style={{ color: "#9147ff" }}>{d.twitch}</span>
                ) : (
                  <span style={{ color: "var(--text-dim)" }}>—</span>
                )}
              </td>
              <td style={TD}>
                <span
                  className="badge badge-driver"
                  style={{
                    color: d.role === "admin" ? "var(--accent)" : "var(--text-dim)",
                    borderColor: d.role === "admin" ? "var(--accent)" : "var(--border)",
                  }}
                >
                  {t(d.role === "admin" ? "roleAdmin" : "roleDriver")}
                </span>
              </td>
              <td style={TD}>
                <button className="btn btn-secondary btn-sm">{t("view")}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
