import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";

const START_TIMES = [
  { label: "Samedi 23 avril 2026", time: "14:00" },
  { label: "Samedi 23 avril 2026", time: "20:00" },
];

const TH: CSSProperties = {
  padding: "0.5rem 0.75rem",
  textAlign: "left",
  fontSize: "0.72rem",
  fontWeight: 700,
  letterSpacing: "0.07em",
  textTransform: "uppercase" as const,
  color: "var(--text-dim)",
  borderBottom: "1px solid var(--border)",
  whiteSpace: "nowrap",
  background: "var(--surface-2)",
};

const TD: CSSProperties = {
  padding: "0.65rem 0.75rem",
  borderBottom: "1px solid var(--border)",
};

export default function StartTimesDemo() {
  const t = useTranslations("events");
  return (
    <div className="table-wrap" style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={TH}>Créneau de départ</th>
          </tr>
        </thead>
        <tbody>
          {START_TIMES.map((st, i) => (
            <tr key={i}>
              <td style={TD}>
                <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{st.label}</div>
                <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.82rem", color: "var(--accent)", marginTop: "0.1rem" }}>
                  {t("startAt", { time: st.time })}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
