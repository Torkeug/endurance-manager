import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";

// Abbreviated driver name format: firstName.slice(0,3) + " " + lastName[0] + "."
const DRIVER_COLS = [
  { abbr: "Mar D.", id: 0 },
  { abbr: "Léa F.", id: 1 },
  { abbr: "Thé B.", id: 2 },
];

const DOT_COLORS: Record<string, string> = {
  available:   "#2eb460",
  partial:     "#c9a84c",
  unavailable: "#e05555",
  tentative:   "#4a4a6a",
  none:        "#3a3a5a",
};

// [marc, léa, théo] per stint — "assigned" = outlined dot
const DOTS: Array<[string, string, string]> = [
  ["assigned",    "unavailable", "available"  ],  // stint 1
  ["available",   "assigned",    "available"  ],  // stint 2
  ["available",   "unavailable", "assigned"   ],  // stint 3
  ["assigned",    "unavailable", "available"  ],  // stint 4
  ["available",   "unavailable", "assigned"   ],  // stint 5
];

const STINTS = [
  { n: 1, driver: "Marc Dubois",  start: "14/06 14:00", end: "14/06 15:52", endActual: "14/06 15:50", duration: "1h 52min", laps: 42, fuel: "87.4", skipFuel: "47.20", igTime: "14:00", phase: "☀️", rain: false, tyre: false, isLast: false },
  { n: 2, driver: "Léa Fontaine", start: "14/06 15:52", end: "14/06 17:44", endActual: null,           duration: "1h 52min", laps: 42, fuel: "87.4", skipFuel: "47.20", igTime: "15:52", phase: "🌗", rain: false, tyre: true,  isLast: false },
  { n: 3, driver: "Théo Bernard", start: "14/06 17:44", end: "14/06 19:36", endActual: null,           duration: "1h 52min", laps: 41, fuel: "85.3", skipFuel: "48.10", igTime: "17:44", phase: "🌑", rain: false, tyre: false, isLast: false },
  { n: 4, driver: "Marc Dubois",  start: "14/06 19:36", end: "14/06 21:28", endActual: null,           duration: "1h 52min", laps: 38, fuel: "82.1", skipFuel: "51.30", igTime: "19:36", phase: "🌑", rain: true,  tyre: false, isLast: false },
  { n: 5, driver: "Théo Bernard", start: "14/06 21:28", end: "14/06 23:02", endActual: null,           duration: "1h 34min", laps: 36, fuel: "74.8", skipFuel: null,    igTime: "21:28", phase: "🌑", rain: false, tyre: false, isLast: true  },
];

// Fair share — total 199 laps / 3 drivers ≈ 66 equal share, min 25% = 17
const FAIR_SHARE = [
  { name: "Marc Dubois",  laps: 80 },
  { name: "Léa Fontaine", laps: 42 },
  { name: "Théo Bernard", laps: 77 },
];
const FAIR_SHARE_EQUAL = 66;
const FAIR_SHARE_MIN   = 17;

// ── Embedded Gantt data ────────────────────────────────────────────────────────
const G_START    = 14;
const G_RACE_END = 23;
const G_END      = 23.25;
const G_HOURS    = [14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
const G_NIGHT    = { s: 20.5, e: 23.25 };

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

// ── Shared styles matching StintGrid.js ───────────────────────────────────────
const TH: CSSProperties = {
  background: "var(--surface-2)",
  color: "var(--text-dim)",
  fontSize: "0.65rem",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  padding: "0.5rem 0.5rem",
  borderBottom: "2px solid var(--border)",
  whiteSpace: "nowrap",
  textAlign: "center",
};

const TD: CSSProperties = {
  padding: "0.35rem 0.5rem",
  borderBottom: "1px solid var(--border)",
  verticalAlign: "middle",
  fontSize: "0.82rem",
};

const MONO: CSSProperties = {
  fontFamily: "var(--font-mono), monospace",
  fontSize: "0.75rem",
};

// Group separator (between column groups) and inner separator
const GS: CSSProperties = { borderLeft: "2px solid var(--border)" };
const IS: CSSProperties = { borderLeft: "1px solid var(--border-dim)" };

export default function StintGridDemo() {
  const t    = useTranslations("stintGrid");
  const tPlan = useTranslations("planningTab");

  return (
    <div>

      {/* ── Strategy tab bar ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: "0.25rem", borderBottom: "1px solid var(--border)", marginBottom: "0.75rem", alignItems: "flex-end" }}>
        {/* Plan A — active (underline + accent color) */}
        <div style={{ padding: "0.5rem 1rem", borderBottom: "2px solid var(--accent)", color: "var(--accent)", fontFamily: "var(--font-rajdhani), sans-serif", fontSize: "0.85rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "default", marginBottom: "-1px", display: "flex", alignItems: "center", gap: "0.3rem" }}>
          <span style={{ color: "#c9a84c", fontSize: "0.75rem" }}>★</span>
          Plan A
        </div>
        {/* Plan B — inactive */}
        <div style={{ padding: "0.5rem 1rem", borderBottom: "2px solid transparent", color: "var(--text-dim)", fontFamily: "var(--font-rajdhani), sans-serif", fontSize: "0.85rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "default", marginBottom: "-1px" }}>
          Plan B
        </div>
        {/* Add strategy */}
        <div style={{ padding: "0.4rem 0.75rem", borderBottom: "2px solid transparent", color: "var(--text-dim)", fontFamily: "var(--font-rajdhani), sans-serif", fontSize: "0.85rem", fontWeight: 700, cursor: "default", marginBottom: "-1px" }}>
          {t("addStrategy")}
        </div>
      </div>

      {/* ── Strategy metadata (editable in real app) ─────────────────────────── */}
      <div style={{ marginBottom: "1rem", padding: "0.75rem 1rem", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "4px", display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", minWidth: "140px" }}>
          <span style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-dim)" }}>{t("strategyName")}</span>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "3px", padding: "0.3rem 0.5rem", fontSize: "0.82rem", fontWeight: 700, fontFamily: "var(--font-rajdhani), sans-serif", color: "var(--text)" }}>Plan A</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1, minWidth: "180px" }}>
          <span style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-dim)" }}>{t("strategyDesc")}</span>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "3px", padding: "0.3rem 0.5rem", fontSize: "0.82rem", color: "var(--text-dim)" }}>Météo sèche — nominal</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-dim)" }} title={t("startOffsetTitle")}>{t("startOffset")}</span>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "3px", padding: "0.3rem 0.5rem", fontSize: "0.82rem", fontFamily: "var(--font-mono), monospace", color: "var(--text)", width: "64px", textAlign: "right" }}>0</div>
            <span style={{ fontSize: "0.82rem", color: "var(--text-dim)" }}>{t("minutes")}</span>
          </div>
        </div>
        {/* Active badge — shown when strategy is active */}
        <span style={{ fontSize: "0.75rem", color: "#c9a84c", padding: "0.3rem 0.6rem", background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.3)", borderRadius: "3px", whiteSpace: "nowrap" }}>
          {t("setActive")}
        </span>
      </div>

      {/* ── Summary bar ──────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        {[
          { label: t("startLabel"), value: "14/06 14:00" },
          { label: t("raceEnd"),    value: "14/06 23:00" },
          { label: t("stint"),      value: "5" },
          { label: t("plannedEnd"), value: "14/06 23:02", color: "#2eb460" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "4px", padding: "0.6rem 1rem", flex: 1, minWidth: "120px" }}>
            <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: "0.2rem" }}>{label}</div>
            <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.85rem", color: color ?? "var(--text)" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Planning Gantt (PlanningTab embedded) ────────────────────────────── */}
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
                    {d.avail.map((a, i) => (
                      <div key={i} style={{ position: "absolute", top: 0, bottom: 0, left: `${gPct(a.s)}%`, width: `${gPct(a.e) - gPct(a.s)}%`, background: a.ok ? "rgba(46,180,96,0.18)" : "rgba(224,85,85,0.18)", pointerEvents: "none", zIndex: 0 }} />
                    ))}
                    <div style={{ position: "absolute", top: 0, bottom: 0, left: `${gPct(G_NIGHT.s)}%`, width: `${gPct(G_NIGHT.e) - gPct(G_NIGHT.s)}%`, background: "rgba(10,10,30,0.45)", pointerEvents: "none", zIndex: 0 }} />
                    <div style={{ position: "absolute", top: 0, bottom: 0, left: `${G_RACE_END_PCT}%`, width: "2px", background: "rgba(224,85,85,0.5)", zIndex: 2, pointerEvents: "none" }} />
                    {d.stints.map((s) => (
                      <div key={s.n} style={{ position: "absolute", top: "4px", bottom: "4px", left: `${gPct(s.s)}%`, width: `${gPct(s.e) - gPct(s.s)}%`, background: d.color, borderRadius: "3px", display: "flex", alignItems: "center", paddingLeft: "5px", overflow: "hidden", opacity: 0.88, zIndex: 1 }}>
                        <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "#fff", whiteSpace: "nowrap", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>R{s.n}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Hover hint */}
            <div style={{ marginTop: "0.75rem", padding: "0.65rem 0.9rem", fontSize: "0.75rem", color: "var(--text-dim)", fontStyle: "italic", opacity: 0.5 }}>
              {tPlan("hoverHint")}
            </div>

            {/* Gantt legend */}
            <div style={{ marginTop: "0.75rem", display: "flex", gap: "1.25rem", flexWrap: "wrap", fontSize: "0.72rem", color: "var(--text-dim)", alignItems: "center" }}>
              {[
                { bg: "rgba(46,180,96,0.35)",  label: t("legendAvailable") },
                { bg: "rgba(224,85,85,0.35)",  label: t("legendUnavailable") },
                { bg: "rgba(74,74,106,0.35)",  label: t("legendUncertain") },
                { bg: "rgba(10,10,30,0.45)",   label: tPlan("legendNight") },
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

      {/* ── Fair share indicators ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: "1rem" }}>
        <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: "0.5rem" }}>
          {t("fairShare")} {FAIR_SHARE_MIN} {t("laps")} ({FAIR_SHARE_EQUAL} {t("fairSharePart")}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {FAIR_SHARE.map((d) => (
            <div key={d.name} style={{ background: "var(--surface-2)", border: "1px solid #2eb460", borderRadius: "3px", padding: "0.4rem 0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span>✅</span>
              <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>{d.name}</span>
              <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.75rem", color: "var(--text-dim)" }}>{d.laps} {t("laps")}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Per-driver stint clear ────────────────────────────────────────────── */}
      <div style={{ marginBottom: "1rem", padding: "0.75rem 1rem", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "4px" }}>
        <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: "0.6rem" }}>
          {t("releaseStints")}
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {[
            { name: "Marc Dubois", count: 1 },
            { name: "Léa Fontaine", count: 1 },
            { name: "Théo Bernard", count: 2 },
          ].map((d) => (
            <div key={d.name} style={{ padding: "0.3rem 0.6rem", background: "var(--surface)", border: "1px solid #a06020", borderRadius: "3px", color: "#d4904a", fontSize: "0.8rem", cursor: "default", display: "flex", alignItems: "center", gap: "0.35rem" }}>
              ✕ {d.name}{" "}
              <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.72rem", opacity: 0.8 }}>({d.count})</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Legend line 1: availability toggle + dot legend ──────────────────── */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "0.25rem", fontSize: "0.72rem", color: "var(--text-dim)", flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", cursor: "pointer", fontWeight: 700, color: "var(--text)", userSelect: "none" }}>
          <input type="checkbox" defaultChecked readOnly style={{ cursor: "pointer" }} />
          {t("availCol")}
        </label>
        {[
          { color: "#2eb460", label: t("legendAvailable") },
          { color: "#c9a84c", label: t("legendPartial") },
          { color: "#e05555", label: t("legendUnavailable") },
          { color: "#4a4a6a", label: t("legendUncertain") },
        ].map(({ color, label }) => (
          <span key={label} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <span style={{ width: 12, height: 12, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
            {label}
          </span>
        ))}
        <span style={{ marginLeft: "0.5rem" }}>{t("legendIcons")}</span>
      </div>

      {/* ── Legend line 2: data estimation tiers ─────────────────────────────── */}
      <div style={{ display: "flex", gap: "1.25rem", marginBottom: "0.5rem", fontSize: "0.72rem", color: "var(--text-dim)", flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontWeight: 700, color: "var(--text)" }}>{t("dataSourceShort")}</span>
        {[
          { color: "#c9a84c", marker: "*", label: t("teamModifier") },
          { color: "#a07830", marker: "~", label: t("noModifier")   },
          { color: "#4a9fd4", marker: "†", label: t("teamAverage")  },
        ].map(({ color, marker, label }) => (
          <span key={marker} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ display: "inline-block", width: "3px", height: "14px", background: color, borderRadius: "1px", flexShrink: 0 }} />
            <span><span style={{ color }}>{marker}</span> {label}</span>
          </span>
        ))}
      </div>

      {/* ── Legend line 3: tyre / fuel rate ──────────────────────────────────── */}
      <div style={{ marginBottom: "0.5rem", fontSize: "0.72rem", color: "var(--text-dim)" }}>
        {t("tyreChangeTime")} 30s — {t("fuelRate")} 2.5 {t("fuelRateVar")}
      </div>

      {/* ── Stint grid table ──────────────────────────────────────────────────── */}
      <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: "4px", marginBottom: "1rem" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: `${680 + DRIVER_COLS.length * 32}px` }}>
          <thead>
            <tr>
              <th style={{ ...TH, width: "28px" }}>#</th>
              {/* Availability dot columns — left of driver, with group separator on first */}
              {DRIVER_COLS.map((d, di) => (
                <th key={d.id} style={{ ...TH, ...(di === 0 ? GS : {}), width: "32px", textAlign: "center", fontSize: "0.58rem" }}>
                  {d.abbr}
                </th>
              ))}
              <th style={{ ...TH, ...GS, minWidth: "130px", textAlign: "left" }}>{t("colDriverHeader")}</th>
              <th style={{ ...TH, ...GS, textAlign: "center" }}>{t("colStartIRL")}</th>
              <th style={{ ...TH, ...IS, textAlign: "center" }}>{t("colEndIRL")}</th>
              <th style={{ ...TH, ...IS, minWidth: "110px", textAlign: "center" }}>{t("colActualEnd")}</th>
              <th style={{ ...TH, ...GS, minWidth: "68px" }}>{t("colDuration")}</th>
              <th style={{ ...TH, ...IS, minWidth: "52px" }}>{t("colLaps")}</th>
              <th style={{ ...TH, ...IS, minWidth: "60px" }}>{t("colFuel")}</th>
              <th style={{ ...TH, ...IS, minWidth: "90px" }} title={t("skipEndTitle")}>{t("skipEnd")}</th>
              <th style={{ ...TH, ...GS, width: "52px" }}>{t("inGame")}</th>
              {/* ⏱ column shows the day/night phase emoji */}
              <th style={{ ...TH, width: "24px" }}>⏱</th>
              <th style={{ ...TH, ...GS, width: "24px" }}>💧</th>
              <th style={{ ...TH, width: "24px" }}>🛞</th>
              <th style={{ ...TH, ...GS, width: "36px" }}></th>
            </tr>
          </thead>
          <tbody>
            {STINTS.map((s, si) => {
              // Row background — stint 1 is the active stint (currently running)
              const isActive = s.n === 1;
              const isLast   = s.isLast;
              const rowBg    = isActive
                ? "rgba(46,180,96,0.13)"
                : isLast
                  ? "rgba(46,180,96,0.12)"
                  : si % 2 === 0 ? "transparent" : "var(--zebra)";

              // Left-border color on the # cell
              const borderColor = isActive ? "#2eb460" : isLast ? "#2eb460" : "transparent";

              return (
                <tr key={s.n} style={{ background: rowBg, outline: isActive ? "1px solid #2eb460" : "none" }}>

                  {/* # — active pulse dot on currently-running stint */}
                  <td style={{ ...TD, textAlign: "center", boxShadow: `inset 3px 0 0 0 ${borderColor}`, background: isActive ? "rgba(46,180,96,0.1)" : undefined }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.3rem" }}>
                      {isActive && (
                        <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#2eb460", flexShrink: 0 }} />
                      )}
                      <span style={{ ...MONO, color: isActive ? "#2eb460" : "var(--text-dim)", fontWeight: isActive ? 700 : 400 }}>
                        {s.n}
                      </span>
                    </div>
                  </td>

                  {/* Availability dots */}
                  {DRIVER_COLS.map((d, di) => {
                    const status    = DOTS[si][d.id];
                    const isAssigned = status === "assigned";
                    const dotColor  = isAssigned ? DOT_COLORS.available : (DOT_COLORS[status] ?? DOT_COLORS.none);
                    return (
                      <td key={d.id} style={{ ...TD, ...(di === 0 ? GS : {}), textAlign: "center", padding: "0.35rem 0.2rem" }}>
                        <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: dotColor, margin: "0 auto", outline: isAssigned ? "2px solid var(--accent)" : "none", outlineOffset: "2px" }} />
                      </td>
                    );
                  })}

                  {/* Driver */}
                  <td style={{ ...TD, ...GS, fontWeight: s.driver === "À définir" ? 400 : 600, color: s.driver === "À définir" ? "var(--text-dim)" : "var(--text)" }}>
                    {s.driver}
                  </td>

                  {/* IRL start — green when actual start stamped (stint 1) */}
                  <td style={{ ...TD, ...GS, textAlign: "center" }}>
                    <span style={{ ...MONO, color: isActive ? "#2eb460" : undefined }}>{s.start}</span>
                  </td>

                  {/* IRL end — strikethrough when actual end exists */}
                  <td style={{ ...TD, ...IS, textAlign: "center" }}>
                    <span style={{ ...MONO, textDecoration: s.endActual ? "line-through" : "none", color: s.endActual ? "var(--text-dim)" : "var(--text)" }}>
                      {s.end}
                    </span>
                    {/* Last stint optimal end hint */}
                    {isLast && (
                      <div style={{ ...MONO, fontSize: "0.68rem", color: "var(--accent)", marginTop: "0.1rem" }}>
                        {t("labelOpt")} 14/06 23:00
                      </div>
                    )}
                  </td>

                  {/* Actual end */}
                  <td style={{ ...TD, ...IS, textAlign: "center" }}>
                    <span style={{ ...MONO, color: s.endActual ? "#2eb460" : "var(--text-dim)" }}>
                      {s.endActual ?? "—"}
                    </span>
                  </td>

                  {/* Duration */}
                  <td style={{ ...TD, ...GS, textAlign: "center" }}>
                    {s.endActual ? (
                      <div>
                        <span style={{ ...MONO, color: "#2eb460" }}>{s.duration}</span>
                        <div style={{ fontSize: "0.65rem", color: "var(--text-dim)", marginTop: "0.1rem" }}>{t("labelActual")}</div>
                      </div>
                    ) : isLast ? (
                      <div>
                        <span style={{ ...MONO, color: "#2eb460" }}>🏁 {s.duration}</span>
                      </div>
                    ) : (
                      <span style={MONO}>{s.duration}</span>
                    )}
                  </td>

                  {/* Laps */}
                  <td style={{ ...TD, ...IS, textAlign: "center" }}>
                    <span style={MONO}>{s.laps}</span>
                    {isLast && (
                      <div style={{ ...MONO, fontSize: "0.68rem", color: "var(--accent)", marginTop: "0.1rem" }}>
                        {t("labelOpt")} 38
                      </div>
                    )}
                  </td>

                  {/* Fuel */}
                  <td style={{ ...TD, ...IS, textAlign: "center" }}>
                    <span style={{ ...MONO, color: "var(--accent)" }}>{s.fuel}L</span>
                  </td>

                  {/* Skip last pit target consumption */}
                  <td style={{ ...TD, ...IS, textAlign: "center" }}>
                    {isLast ? (
                      <span style={{ color: "var(--text-dim)", fontSize: "0.72rem" }}>—</span>
                    ) : s.skipFuel ? (
                      <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.72rem", color: "var(--accent)" }}>
                        {s.skipFuel} {t("lPerLap")}
                      </div>
                    ) : (
                      <span style={{ color: "var(--text-dim)", fontSize: "0.72rem" }}>—</span>
                    )}
                  </td>

                  {/* IG start time (in-game clock) */}
                  <td style={{ ...TD, ...GS, textAlign: "center" }}>
                    <span style={{ ...MONO, color: "var(--text-dim)" }}>{s.igTime}</span>
                  </td>

                  {/* Phase emoji — shown in the ⏱ column */}
                  <td style={{ ...TD, textAlign: "center", fontSize: "0.8rem" }}>{s.phase}</td>

                  {/* Rain checkbox */}
                  <td style={{ ...TD, ...GS, textAlign: "center" }}>
                    <input type="checkbox" checked={s.rain} readOnly style={{ accentColor: "#4a9fd4" }} />
                  </td>

                  {/* Tyre change checkbox */}
                  <td style={{ ...TD, textAlign: "center" }}>
                    <input type="checkbox" checked={s.tyre} readOnly style={{ accentColor: "var(--accent)" }} />
                  </td>

                  {/* Reset + delete buttons */}
                  <td style={{ ...TD, ...GS, textAlign: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem", alignItems: "center" }}>
                      <button className="btn btn-secondary btn-sm" style={{ padding: "0.15rem 0.4rem" }} disabled>↺</button>
                      <button className="btn btn-danger btn-sm"    style={{ padding: "0.15rem 0.4rem" }} disabled>×</button>
                    </div>
                  </td>

                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Actions ──────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
        <button className="btn btn-secondary" disabled>{t("addStint")}</button>
        <button className="btn btn-danger btn-sm" disabled>{t("clearAllLabel")}</button>
      </div>

    </div>
  );
}
