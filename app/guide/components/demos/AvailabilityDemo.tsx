import type { CSSProperties } from "react";

type SlotState = true | false | null | undefined;

const DRIVERS = ["Marc D.", "Léa F.", "Théo B."];

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

// DATA[slotIndex][driverIndex]
const DATA: SlotState[][] = [
  [true,  false, true ],
  [true,  false, true ],
  [true,  true,  null ],
  [true,  true,  true ],
  [null,  true,  true ],
  [null,  true,  true ],
  [false, true,  false],
  [false, null,  false],
  [true,  null,  true ],
  [true,  false, true ],
];

function cellBg(state: SlotState): CSSProperties {
  if (state === true)  return { background: "#1a3a1a", border: "1px solid #2eb460" };
  if (state === false) return { background: "#3a1010", border: "1px solid var(--danger)" };
  if (state === null)  return { background: "rgba(212,144,74,0.15)", border: "1px solid #d4904a" };
  return { background: "var(--surface-2)", border: "1px solid var(--border)" };
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
  return (
    <div>
      {/* Legend */}
      <div style={{ display: "flex", gap: "1.25rem", marginBottom: "0.75rem", fontSize: "0.78rem", color: "var(--text-dim)", flexWrap: "wrap", alignItems: "center" }}>
        {[
          { bg: "#1a3a1a", border: "#2eb460", label: "Disponible" },
          { bg: "rgba(212,144,74,0.15)", border: "#d4904a", label: "Incertain" },
          { bg: "#3a1010", border: "var(--danger)", label: "Indisponible" },
        ].map(({ bg, border, label }) => (
          <span key={label} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ display: "inline-block", width: "14px", height: "14px", borderRadius: "2px", background: bg, border: `1px solid ${border}` }} />
            {label}
          </span>
        ))}
      </div>

      {/* Grid */}
      <div style={{ border: "1px solid var(--border)", borderRadius: "4px", overflowX: "auto", maxHeight: "340px", overflowY: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: `${160 + DRIVERS.length * 56}px` }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 3 }}>
            <tr>
              <th style={{ ...TH, textAlign: "left", position: "sticky", left: 0, zIndex: 4, minWidth: "58px", width: "58px" }}>IRL</th>
              <th style={{ ...TH, minWidth: "52px" }}>IG</th>
              <th style={{ ...TH, width: "30px" }}>⏱</th>
              {DRIVERS.map((d) => (
                <th key={d} style={{ ...TH, minWidth: "54px" }}>
                  <div>{d}</div>
                  <div style={{ fontSize: "0.58rem", fontWeight: 400, color: "var(--text-dim)", letterSpacing: 0 }}>0×30m</div>
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
                  <td style={{ ...TD, textAlign: "left", fontFamily: "var(--font-mono), monospace", fontSize: "0.72rem", position: "sticky", left: 0, zIndex: 1, background: stickyBg, padding: "0.3rem 0.5rem", whiteSpace: "nowrap" }}>
                    {slot.isStart && (
                      <span style={{ fontSize: "0.58rem", fontWeight: 700, color: "#fff", background: "#2eb460", border: "1px solid #2eb460", padding: "1px 3px", borderRadius: "2px", marginRight: "4px" }}>▶</span>
                    )}
                    {slot.isEnd && (
                      <span style={{ fontSize: "0.58rem", fontWeight: 700, color: "#fff", background: "var(--danger)", border: "1px solid var(--danger)", padding: "1px 3px", borderRadius: "2px", marginRight: "4px" }}>■</span>
                    )}
                    {slot.irl}
                  </td>
                  {/* IG time */}
                  <td style={{ ...TD, fontFamily: "var(--font-mono), monospace", fontSize: "0.72rem" }}>{slot.ig}</td>
                  {/* Phase */}
                  <td style={TD}>{slot.phase}</td>
                  {/* Driver availability cells */}
                  {DRIVERS.map((_, di) => (
                    <td key={di} style={{ ...TD, padding: "3px 4px" }}>
                      <div style={{ width: "32px", height: "22px", borderRadius: "3px", margin: "0 auto", ...cellBg(DATA[si][di]) }} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
