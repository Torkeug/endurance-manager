import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";

type SlotState = true | false | null | undefined;

const DRIVERS = ["Marc D.", "Léa F.", "Théo B."];
const SELECTED_DRIVER = 0; // Marc D. is "editing"

const SLOTS = [
  { irl: "14:00", ig: "14:00", phase: "☀️", isStart: true,  isEnd: false },
  { irl: "14:30", ig: "14:30", phase: "☀️", isStart: false, isEnd: false },
  { irl: "15:00", ig: "15:00", phase: "☀️", isStart: false, isEnd: false },
  { irl: "15:30", ig: "15:30", phase: "☀️", isStart: false, isEnd: false },
  { irl: "16:00", ig: "16:00", phase: "☀️", isStart: false, isEnd: false },
  { irl: "16:30", ig: "16:30", phase: "☀️", isStart: false, isEnd: false },
  { irl: "17:00", ig: "17:00", phase: "🌗", isStart: false, isEnd: false },
  { irl: "17:30", ig: "17:30", phase: "🌑", isStart: false, isEnd: false },
  { irl: "18:00", ig: "18:00", phase: "🌑", isStart: false, isEnd: false },
  { irl: "18:30", ig: "18:30", phase: "🌑", isStart: false, isEnd: true  },
];

// DATA[slotIndex][driverIndex] — undefined = unset (shown as empty cell when editing)
const DATA: SlotState[][] = [
  [true,  false, true ],
  [true,  false, true ],
  [true,  true,  null ],
  [true,  true,  true ],
  [null,  true,  true ],
  [undefined, true,  true ],
  [false, true,  false],
  [false, null,  false],
  [true,  null,  true ],
  [true,  false, true ],
];

function cellStyle(state: SlotState, isEditing: boolean): CSSProperties {
  if (state === true)  return { background: "#1a3a1a", borderColor: "#2eb460" };
  if (state === false) return { background: "#3a1010", borderColor: "var(--danger)" };
  if (state === null)  return { background: "rgba(212,144,74,0.15)", borderColor: "#d4904a" };
  // undefined
  if (isEditing)       return { background: "var(--surface-2)", borderColor: "var(--border)" };
  return { background: "transparent", borderColor: "transparent" };
}

function getRowStyle(slot: typeof SLOTS[0]): CSSProperties {
  if (slot.isStart) return { background: "rgba(46,180,96,0.10)", borderTop: "2px solid #2eb460", borderBottom: "2px solid #2eb460" };
  if (slot.isEnd)   return { background: "rgba(224,85,85,0.08)", borderTop: "2px solid var(--danger)", borderBottom: "2px solid var(--danger)" };
  return {};
}

function getStickyBg(slot: typeof SLOTS[0]) {
  if (slot.isStart) return "rgba(46,180,96,0.15)";
  if (slot.isEnd)   return "rgba(224,85,85,0.12)";
  return "var(--bg)";
}

function Badge({ label, bg, border }: { label: string; bg: string; border: string }) {
  return (
    <span style={{ fontSize: "0.58rem", fontWeight: 700, color: "#fff", background: bg, border: `1px solid ${border}`, padding: "1px 4px", borderRadius: "2px", flexShrink: 0 }}>
      {label}
    </span>
  );
}

const TH: CSSProperties = {
  background: "var(--surface-2)",
  color: "var(--text-dim)",
  fontSize: "0.68rem",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  padding: "0.5rem 0.4rem",
  borderBottom: "2px solid var(--border)",
  whiteSpace: "nowrap",
  textAlign: "center",
};

const TD: CSSProperties = {
  padding: "0.2rem 0.4rem",
  borderBottom: "1px solid var(--border)",
  verticalAlign: "middle",
  fontSize: "0.8rem",
  textAlign: "center",
};

export default function AvailabilityDemo() {
  const t = useTranslations("availabilityGrid");
  return (
    <div>
      {/* Driver selector + controls card */}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <div className="form-group">
          <label>{t("fillMyAvailability")}</label>
          <select disabled style={{ opacity: 1 }}>
            <option>Marc Dubois</option>
          </select>
        </div>
        <p style={{ fontSize: "0.78rem", color: "var(--accent)", marginTop: "0.5rem" }}>
          {t("clickDragHint")}
        </p>

        {/* Paint mode buttons */}
        <div className="card" style={{ marginBottom: "1rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: "0.5rem" }}>
            {t("inputMode")}
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {[
              { label: t("available"),   color: "var(--accent)",  active: true  },
              { label: t("unavailable"), color: "var(--danger)",  active: false },
              { label: t("uncertain"),   color: "#3a8080",        active: false },
            ].map(({ label, color, active }) => (
              <button key={label} type="button" style={{ padding: "0.4rem 0.85rem", borderRadius: "3px", border: "1px solid", borderColor: active ? color : "var(--border)", background: active ? `${color}22` : "var(--surface-2)", color: active ? color : "var(--text-dim)", fontFamily: "var(--font-rajdhani), sans-serif", fontSize: "0.85rem", fontWeight: 700, cursor: "default", flexShrink: 0 }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
          <button className="btn btn-primary btn-sm">{t("markAllAvailable")}</button>
        </div>
      </div>

      {/* Discord notification card */}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <svg viewBox="0 0 24 24" fill="#5865F2" style={{ width: 18, height: 18, flexShrink: 0 }}>
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.001.033.022.063.044.083a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
          </svg>
          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {t("discordAlert")}
          </span>
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: "0.5rem" }}>
          {t("discordDefault")}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: "0.6rem", cursor: "default", fontSize: "0.85rem" }}>
          <input type="checkbox" checked readOnly />
          {t("discordEnable")}
        </label>
        <div style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>{t("discordNotify")}</span>
          <input type="number" defaultValue={5} min={1} max={60} style={{ width: "60px" }} readOnly />
          <span style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>{t("discordMinutesBefore")}</span>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: "1.25rem", marginBottom: "0.75rem", fontSize: "0.78rem", color: "var(--text-dim)", flexWrap: "wrap", alignItems: "center" }}>
        {[
          { bg: "#1a3a1a",                    border: "#2eb460",        label: t("legendAvailable")   },
          { bg: "rgba(212,144,74,0.15)",       border: "#d4904a",        label: t("legendUncertain")   },
          { bg: "#3a1010",                     border: "var(--danger)",  label: t("legendUnavailable") },
        ].map(({ bg, border, label }) => (
          <span key={label} style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <span style={{ width: 14, height: 14, background: bg, border: `1px solid ${border}`, borderRadius: 2, display: "inline-block" }} />
            {label}
          </span>
        ))}
        <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <Badge label="▶" bg="#2eb460" border="#2eb460" /> {t("legendStart")}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <Badge label="■" bg="var(--danger)" border="var(--danger)" /> {t("legendEnd")}
        </span>
      </div>

      {/* Grid */}
      <div style={{ border: "1px solid var(--border)", borderRadius: "4px", overflowX: "auto", maxHeight: "340px", overflowY: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: `${160 + DRIVERS.length * 52}px` }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 3 }}>
            <tr>
              <th style={{ ...TH, textAlign: "left", position: "sticky", left: 0, zIndex: 4, minWidth: "56px", width: "56px" }}>IRL</th>
              <th style={{ ...TH, minWidth: "52px" }}>IG</th>
              <th style={{ ...TH, width: "30px" }}>⏱</th>
              {DRIVERS.map((d, di) => (
                <th key={d} style={{ ...TH, minWidth: "50px", color: di === SELECTED_DRIVER ? "var(--accent)" : "var(--text-dim)" }}>
                  <div>{d}</div>
                  <div style={{ fontSize: "0.58rem", fontWeight: 400, color: "var(--text-dim)", letterSpacing: 0 }}>
                    {DATA.filter((row) => row[di] !== undefined).length}×30m
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SLOTS.map((slot, si) => {
              const rowStyle = getRowStyle(slot);
              const stickyBg = getStickyBg(slot);
              return (
                <tr key={slot.irl} style={rowStyle}>
                  {/* IRL time — sticky left */}
                  <td style={{ ...TD, textAlign: "left", fontFamily: "var(--font-mono), monospace", fontSize: "0.8rem", position: "sticky", left: 0, zIndex: 1, background: stickyBg, borderRight: "1px solid var(--border)", width: "56px", minWidth: "56px", padding: "0.2rem 0.3rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "3px", flexWrap: "nowrap" }}>
                      <span style={{ color: slot.isStart ? "#2eb460" : slot.isEnd ? "var(--danger)" : "var(--text)" }}>
                        {slot.irl}
                      </span>
                      {slot.isStart && <Badge label="▶" bg="#2eb460" border="#2eb460" />}
                      {slot.isEnd   && <Badge label="■" bg="var(--danger)" border="var(--danger)" />}
                    </div>
                  </td>
                  {/* IG time */}
                  <td style={TD}>
                    <span className="mono" style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>{slot.ig}</span>
                  </td>
                  {/* Phase */}
                  <td style={{ ...TD, fontSize: "0.85rem" }}>{slot.phase}</td>
                  {/* Driver cells */}
                  {DRIVERS.map((_, di) => {
                    const state = DATA[si][di];
                    const isEditing = di === SELECTED_DRIVER;
                    const cs = cellStyle(state, isEditing);
                    return (
                      <td key={di} style={{ ...TD, padding: "2px 3px" }}>
                        <div style={{ width: "100%", height: "22px", border: "1px solid", borderRadius: "3px", ...cs }} />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
