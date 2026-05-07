const RACE_START = 14;
const RACE_HOURS = 9;
const HOURS = Array.from({ length: RACE_HOURS + 1 }, (_, i) => RACE_START + i);

const DRIVERS = [
  {
    name: "Marc Dubois",
    color: "rgba(201,168,76,0.85)",
    stints: [{ n: 1, start: 14, end: 15.87 }, { n: 4, start: 19.6, end: 21.47 }],
    avail: [{ start: 14, end: 23, v: true }],
  },
  {
    name: "Léa Fontaine",
    color: "rgba(74,159,212,0.85)",
    stints: [{ n: 2, start: 15.87, end: 17.73 }],
    avail: [{ start: 14, end: 18, v: true }, { start: 18, end: 23, v: false }],
  },
  {
    name: "Théo Bernard",
    color: "rgba(100,200,140,0.85)",
    stints: [{ n: 3, start: 17.73, end: 19.6 }, { n: 5, start: 21.47, end: 23 }],
    avail: [{ start: 16, end: 23, v: true }],
  },
];

const NIGHT = { start: 20, end: 23 };

function toPercent(h: number) {
  return ((h - RACE_START) / RACE_HOURS) * 100;
}

const LABEL_W = 88;
const ROW_H = 36;

export default function PlanningDemo() {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "4px", overflow: "hidden" }}>
      {/* Hour axis */}
      <div style={{ display: "flex", marginLeft: LABEL_W, borderBottom: "1px solid var(--border)", position: "relative", height: "24px" }}>
        {HOURS.map((h) => (
          <div
            key={h}
            style={{
              position: "absolute",
              left: `${toPercent(h)}%`,
              transform: "translateX(-50%)",
              fontSize: "0.65rem",
              fontFamily: "var(--font-mono), monospace",
              color: "var(--text-dim)",
              top: "5px",
            }}
          >
            {String(h % 24).padStart(2, "0")}h
          </div>
        ))}
      </div>

      {DRIVERS.map((driver) => (
        <div key={driver.name} style={{ display: "flex", alignItems: "stretch", borderBottom: "1px solid var(--border)", height: ROW_H }}>
          {/* Driver label */}
          <div style={{ width: LABEL_W, flexShrink: 0, display: "flex", alignItems: "center", paddingLeft: "0.6rem", fontSize: "0.72rem", fontWeight: 600, color: "var(--text-dim)", borderRight: "1px solid var(--border)", whiteSpace: "nowrap", overflow: "hidden" }}>
            {driver.name}
          </div>

          {/* Timeline */}
          <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
            {/* Night band */}
            <div style={{ position: "absolute", top: 0, bottom: 0, left: `${toPercent(NIGHT.start)}%`, width: `${toPercent(NIGHT.end) - toPercent(NIGHT.start)}%`, background: "rgba(10,10,30,0.45)", pointerEvents: "none" }} />

            {/* Availability bands */}
            {driver.avail.map((a, i) => (
              <div key={i} style={{ position: "absolute", top: 0, bottom: 0, left: `${toPercent(a.start)}%`, width: `${toPercent(a.end) - toPercent(a.start)}%`, background: a.v ? "rgba(46,180,96,0.08)" : "rgba(224,85,85,0.08)", pointerEvents: "none" }} />
            ))}

            {/* Stint bars */}
            {driver.stints.map((s) => (
              <div key={s.n} style={{ position: "absolute", top: 4, bottom: 4, left: `${toPercent(s.start)}%`, width: `${toPercent(s.end) - toPercent(s.start)}%`, background: driver.color, borderRadius: "3px", display: "flex", alignItems: "center", paddingLeft: "5px", overflow: "hidden", opacity: 0.88 }}>
                <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "#fff", whiteSpace: "nowrap", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
                  R{s.n}
                </span>
              </div>
            ))}

            {/* Hour grid lines */}
            {HOURS.map((h) => (
              <div key={h} style={{ position: "absolute", top: 0, bottom: 0, left: `${toPercent(h)}%`, width: "1px", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
