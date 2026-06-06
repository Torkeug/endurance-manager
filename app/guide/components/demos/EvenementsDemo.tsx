import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";

const EVENTS = [
  { day: "17", month: "MAI", year: "2026", name: "Spa 6 Heures",              circuit: "Circuit de Spa",       format: "GT3",     duration: "6h",  pilotes: 6, equipages: 2, type: "normal",      inscrit: true,  manche: undefined },
  { day: "07", month: "JUN", year: "2026", name: "KRGT Endurance — Manche 2", circuit: "Nürburgring",          format: "GT3",     duration: "3h",  pilotes: 4, equipages: 1, type: "championnat", inscrit: false, manche: 2 },
  { day: "23", month: "JUL", year: "2026", name: "Endurance GT 24h Le Mans",  circuit: "Circuit de la Sarthe", format: "GT3/GTE", duration: "24h", pilotes: 9, equipages: 3, type: "special",     inscrit: false, manche: undefined },
];

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
  const t = useTranslations("events");

  const TABS = [t("tabAll"), t("tabNormal"), t("tabSpecial"), t("tabChampionships")];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
      {/* Tabs — static, Tous active */}
      <div style={{ display: "flex", gap: "0.25rem", borderBottom: "1px solid var(--border)", marginBottom: "1rem" }}>
        {TABS.map((tab, i) => (
          <div key={tab} style={{ padding: "0.5rem 1rem", borderBottom: i === 0 ? "2px solid var(--accent)" : "2px solid transparent", color: i === 0 ? "var(--accent)" : "var(--text-dim)", fontFamily: "var(--font-rajdhani), sans-serif", fontSize: "0.88rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {tab}
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
              <div style={{ display: "flex", gap: "0.35rem", marginBottom: "0.25rem", flexWrap: "wrap", alignItems: "center" }}>
                {ev.type === "special" && (
                  <span style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", padding: "0.1rem 0.4rem", background: "rgba(255,170,0,0.1)", border: "1px solid #ffaa00", borderRadius: "2px", color: "#ffaa00" }}>{t("badgeSpecial")}</span>
                )}
                {ev.type === "championnat" && (
                  <>
                    <span style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", padding: "0.1rem 0.4rem", background: "rgba(160,100,240,0.1)", border: "1px solid #a064f0", borderRadius: "2px", color: "#a064f0" }}>{t("badgeChampionship")}</span>
                    <span style={{ fontSize: "0.6rem", fontWeight: 700, padding: "0.1rem 0.4rem", background: "var(--accent-dim)", border: "1px solid var(--accent)", borderRadius: "2px", color: "var(--accent)" }}>{t("badgeRound", { number: ev.manche })}</span>
                  </>
                )}
                {ev.inscrit && (
                  <span style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", padding: "0.1rem 0.4rem", background: "rgba(46,180,96,0.15)", border: "1px solid #2eb460", color: "#2eb460", borderRadius: "2px" }}>{t("badgeSignedUp")}</span>
                )}
              </div>
              <div style={{ fontWeight: 700, fontSize: "0.9rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ev.name}</div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>{ev.circuit}</div>
            </div>

            {/* Stats */}
            <div style={{ display: "flex", gap: "1.25rem", flexShrink: 0 }}>
              <div>
                <div style={statLabel}>{t("infoFormat")}</div>
                <div style={{ ...statVal, fontSize: "0.78rem" }}>{ev.format}</div>
              </div>
              <div>
                <div style={statLabel}>{t("driverCount_other")}</div>
                <div style={statVal}>{ev.pilotes}</div>
              </div>
              <div>
                <div style={statLabel}>{t("teamEntryCount_other")}</div>
                <div style={statVal}>{ev.equipages}</div>
              </div>
              <div>
                <div style={statLabel}>{t("duration")}</div>
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
