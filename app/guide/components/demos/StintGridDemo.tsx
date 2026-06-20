import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";

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

// ── Embedded planning Gantt data ───────────────────────────────────────────
const G_START   = 14;
const G_RACE_END = 23;
const G_END     = 23.25; // ~15 min buffer past race end
const G_HOURS   = [14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
const G_NIGHT   = { s: 20.5, e: 23.25 }; // sunset → end of timeline

const G_DRIVERS = [
  {
    name: "Marc Dubois", color: "#7c6af0",
    stints: [{ n: 1, s: 14, e: 15.87 }, { n: 4, s: 19.6, e: 21.47 }],
    avail:  [{ s: 14, e: 23, ok: true }],
  },
  {
    name: "Léa Fontaine", color: "#4a9fd4",
    stints: [{ n: 2, s: 15.87, e: 17.73 }],
    avail:  [{ s: 14, e: 18, ok: true }, { s: 18, e: 23, ok: false }],
  },
  {
    name: "Théo Bernard", color: "#2eb460",
    stints: [{ n: 3, s: 17.73, e: 19.6 }, { n: 5, s: 21.47, e: 23 }],
    avail:  [{ s: 16, e: 23, ok: true }],
  },
];

function gPct(h: number) { return ((h - G_START) / (G_END - G_START)) * 100; }
const G_RACE_END_PCT = gPct(G_RACE_END);

export default function StintGridDemo() {
  const t = useTranslations("stintGrid");
  const tPlan = useTranslations("planningTab");
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
          {t("addStrategy")}
        </div>
      </div>

      {/* ── Strategy metadata ── */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "0.75rem", padding: "0.65rem 0.85rem", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "4px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
          <span style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-dim)" }}>{t("strategyName")}</span>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "3px", padding: "0.28rem 0.5rem", fontSize: "0.82rem", fontWeight: 700, fontFamily: "var(--font-rajdhani), sans-serif", color: "var(--text)", minWidth: "90px" }}>Plan A</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem", flex: 1, minWidth: "160px" }}>
          <span style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-dim)" }}>{t("strategyDesc")}</span>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "3px", padding: "0.28rem 0.5rem", fontSize: "0.82rem", color: "var(--text-dim)" }}>Météo sèche — nominal</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
          <span style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-dim)" }}>{t("startOffset")}</span>
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "3px", padding: "0.28rem 0.5rem", fontSize: "0.82rem", fontFamily: "var(--font-mono), monospace", color: "var(--text)", width: "36px", textAlign: "right" }}>0</div>
            <span style={{ fontSize: "0.82rem", color: "var(--text-dim)" }}>{t("minutes")}</span>
          </div>
        </div>
        <span style={{ fontSize: "0.75rem", color: "#c9a84c", padding: "0.3rem 0.6rem", background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.3)", borderRadius: "3px", whiteSpace: "nowrap" }}>{t("setActive")}</span>
      </div>

      {/* ── Summary bar ── */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
        {[
          { label: t("startLabel"), value: "14:00" },
          { label: t("raceEnd"),    value: "23:00" },
          { label: t("stint"),      value: "5" },
          { label: t("plannedEnd"), value: "23:02", color: "#2eb460" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "4px", padding: "0.5rem 0.85rem", flex: 1, minWidth: "100px" }}>
            <div style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: "0.15rem" }}>{label}</div>
            <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.88rem", fontWeight: 700, color: color ?? "var(--text)" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Embedded Gantt (shown when Dispo is checked) ── */}
      <div style={{ marginBottom: "1rem" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: "600px", paddingRight: "20px" }}>

            {/* 🏁 flag row */}
            <div style={{ position: "relative", height: "14px", marginLeft: "130px" }}>
              <div style={{ position: "absolute", left: `${G_RACE_END_PCT}%`, transform: "translateX(-50%)", fontSize: "0.72rem", lineHeight: 1 }}>🏁</div>
            </div>

            {/* Hour axis */}
            <div style={{ position: "relative", height: "20px", marginLeft: "130px", marginBottom: "4px" }}>
              {G_HOURS.map((h) => (
                <div key={h} style={{ position: "absolute", left: `${gPct(h)}%`, transform: "translateX(-50%)", fontSize: "0.65rem", color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace", whiteSpace: "nowrap" }}>
                  {String(h % 24).padStart(2, "0")}:00
                </div>
              ))}
            </div>

            {/* Driver rows */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {G_DRIVERS.map((d) => (
                <div key={d.name} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ width: "122px", flexShrink: 0, fontSize: "0.78rem", color: "var(--text-dim)", textAlign: "right", paddingRight: "8px", borderRight: "2px solid var(--border)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {d.name}
                  </div>
                  <div style={{ flex: 1, position: "relative", height: "32px", background: "var(--surface-2)", borderRadius: "3px", overflow: "hidden" }}>
                    {/* Availability bands */}
                    {d.avail.map((a, i) => (
                      <div key={i} style={{ position: "absolute", top: 0, bottom: 0, left: `${gPct(a.s)}%`, width: `${gPct(a.e) - gPct(a.s)}%`, background: a.ok ? "rgba(46,180,96,0.18)" : "rgba(224,85,85,0.18)", pointerEvents: "none", zIndex: 0 }} />
                    ))}
                    {/* Night band */}
                    <div style={{ position: "absolute", top: 0, bottom: 0, left: `${gPct(G_NIGHT.s)}%`, width: `${gPct(G_NIGHT.e) - gPct(G_NIGHT.s)}%`, background: "rgba(10,10,30,0.45)", pointerEvents: "none", zIndex: 0 }} />
                    {/* Race-end marker */}
                    <div style={{ position: "absolute", top: 0, bottom: 0, left: `${G_RACE_END_PCT}%`, width: "2px", background: "rgba(224,85,85,0.5)", zIndex: 2, pointerEvents: "none" }} />
                    {/* Stint bars */}
                    {d.stints.map((s) => (
                      <div key={s.n} style={{ position: "absolute", top: "4px", bottom: "4px", left: `${gPct(s.s)}%`, width: `${gPct(s.e) - gPct(s.s)}%`, background: d.color, borderRadius: "3px", display: "flex", alignItems: "center", paddingLeft: "5px", overflow: "hidden", opacity: 0.88, zIndex: 1 }}>
                        <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "#fff", whiteSpace: "nowrap", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>R{s.n}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Hover detail panel placeholder */}
            <div style={{ marginTop: "0.75rem", padding: "0.65rem 0.9rem", fontSize: "0.75rem", color: "var(--text-dim)", fontStyle: "italic", opacity: 0.5 }}>
              {tPlan("hoverHint")}
            </div>

            {/* Legend */}
            <div style={{ marginTop: "0.75rem", display: "flex", gap: "1.25rem", flexWrap: "wrap", fontSize: "0.72rem", color: "var(--text-dim)", alignItems: "center" }}>
              {[
                { bg: "rgba(46,180,96,0.35)", label: t("legendAvailable") },
                { bg: "rgba(224,85,85,0.35)", label: t("legendUnavailable") },
                { bg: "rgba(74,74,106,0.35)", label: t("legendUncertain") },
                { bg: "rgba(10,10,30,0.45)",  label: tPlan("legendNight") },
                { bg: "rgba(74,159,212,0.8)",  label: `🌧 ${tPlan("rain")}` },
              ].map(({ bg, label }) => (
                <span key={label} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ display: "inline-block", width: "12px", height: "10px", background: bg, borderRadius: "2px", border: "1px solid var(--border)" }} />
                  {label}
                </span>
              ))}
            </div>

          </div>
        </div>
      </div>

      {/* Legend — availability dots */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "0.35rem", fontSize: "0.72rem", color: "var(--text-dim)", flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontWeight: 700, color: "var(--text)" }}>{t("availCol")} :</span>
        {[
          { color: "#2eb460", label: t("legendAvailable") },
          { color: "#c9a84c", label: t("legendPartial") },
          { color: "#e05555", label: t("legendUnavailable") },
          { color: "#4a4a6a", label: t("legendUncertain") },
        ].map(({ color, label }) => (
          <span key={label} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
            {label}
          </span>
        ))}
        <span style={{ marginLeft: "0.5rem" }}>{t("legendIcons")}</span>
      </div>

      <div className="table-wrap" style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: `${760 + DRIVER_COLS.length * 26}px` }}>
          <thead>
            <tr>
              <th style={{ ...TH, width: "28px" }}>#</th>
              <th style={{ ...TH, minWidth: "130px" }}>{t("colDriver")}</th>
              <th style={TH}>{t("colStartIRL")}</th>
              <th style={TH}>{t("colEndIRL")}</th>
              <th style={{ ...TH, minWidth: "110px" }}>{t("colActualEnd")}</th>
              <th style={{ ...TH, width: "80px" }}>{t("colDuration")}</th>
              <th style={{ ...TH, width: "52px" }}>{t("colLaps")}</th>
              <th style={{ ...TH, width: "62px" }}>{t("colFuel")}</th>
              <th style={{ ...TH, width: "92px" }}>{t("skipEnd")}</th>
              <th style={{ ...TH, width: "52px" }}>{t("inGame")}</th>
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
