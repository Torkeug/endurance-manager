import { Fragment } from "react";

// Static demo of the InventoryMatrix (cars × drivers).
// Each driver column header is vertical text (writing-mode: vertical-rl).
// Each cell shows a dot when the driver has purchased that iRacing content.

const DRIVERS = ["Marc D.", "Léa F.", "Théo B.", "Jules M."];

const CARS: Array<{ name: string; class: string; kronos: boolean; owned: boolean[] }> = [
  { name: "Audi R8 LMS GT3 Evo 2",          class: "GT3",  kronos: true,  owned: [true,  false, false, true ] },
  { name: "Ferrari 488 GT3 Evo 2022",        class: "GT3",  kronos: false, owned: [false, true,  false, false] },
  { name: "Porsche 911 GT3 R (992)",          class: "GT3",  kronos: true,  owned: [true,  true,  false, false] },
  { name: "Ferrari 488 GTE",                  class: "GTE",  kronos: false, owned: [false, false, true,  false] },
  { name: "Oreca 07 Gibson",                  class: "LMP2", kronos: false, owned: [false, false, true,  false] },
];

const NAME_W = 210;
const COUNT_W = 44;
const CELL_W = 36;

const HEADER_H = 110;

function KBadge() {
  return (
    <span style={{ fontSize: "0.55rem", fontWeight: 700, color: "#fff", background: "var(--accent)", border: "1px solid var(--accent)", padding: "0px 3px", borderRadius: "2px", marginLeft: "4px", verticalAlign: "middle" }}>K</span>
  );
}

export default function InventoryDemo() {
  // Group cars by class
  const classes = [...new Set(CARS.map((c) => c.class))];

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "4px", overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", minWidth: `${NAME_W + COUNT_W + DRIVERS.length * CELL_W}px` }}>
        <thead>
          <tr style={{ height: `${HEADER_H}px` }}>
            {/* Name col header */}
            <th style={{ position: "sticky", left: 0, zIndex: 4, background: "var(--surface-2)", boxShadow: "inset -1px 0 0 var(--border)", borderBottom: "2px solid var(--border)", width: NAME_W, maxWidth: NAME_W, padding: "0.5rem 0.75rem", textAlign: "left", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-dim)", verticalAlign: "bottom" }}>
              Voiture
            </th>
            {/* Count col header */}
            <th style={{ position: "sticky", left: NAME_W, zIndex: 4, background: "var(--surface-2)", boxShadow: "inset -1px 0 0 var(--border)", borderBottom: "2px solid var(--border)", width: COUNT_W, textAlign: "center", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-dim)", verticalAlign: "bottom", padding: "0.5rem 0.25rem" }}>
              #
            </th>
            {/* Driver col headers — vertical text */}
            {DRIVERS.map((d) => (
              <th key={d} style={{ background: "var(--surface-2)", borderBottom: "2px solid var(--border)", width: CELL_W, verticalAlign: "bottom", padding: "0 0 6px 0", textAlign: "center" }}>
                <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: "0.68rem", fontWeight: 700, color: "var(--text-dim)", whiteSpace: "nowrap", lineHeight: CELL_W + "px" }}>
                  {d}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {classes.map((cls) => (
            <Fragment key={cls}>
              {/* Class group row */}
              <tr>
                <td colSpan={2 + DRIVERS.length} style={{ position: "sticky", left: 0, padding: "0.35rem 0.75rem", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-dim)", background: "var(--surface-2)", borderBottom: "1px solid var(--border)", borderTop: "2px solid var(--border)" }}>
                  {cls}
                </td>
              </tr>

              {/* Car rows */}
              {CARS.filter((c) => c.class === cls).map((car) => {
                const count = car.owned.filter(Boolean).length;
                return (
                  <tr key={car.name}>
                    {/* Car name */}
                    <td style={{ position: "sticky", left: 0, background: "var(--surface)", zIndex: 1, boxShadow: "inset -1px 0 0 var(--border)", borderBottom: "1px solid var(--border)", width: NAME_W, maxWidth: NAME_W, padding: "0.3rem 0.75rem", fontSize: "0.8rem", overflow: "hidden" }}>
                      {car.name}
                      {car.kronos && <KBadge />}
                    </td>
                    {/* Count */}
                    <td style={{ position: "sticky", left: NAME_W, background: "var(--surface)", zIndex: 1, boxShadow: "inset -1px 0 0 var(--border)", borderBottom: "1px solid var(--border)", width: COUNT_W, textAlign: "center", fontFamily: "var(--font-mono), monospace", fontSize: "0.75rem", fontWeight: 700, color: count > 0 ? "var(--accent)" : "var(--text-dim)" }}>
                      {count}
                    </td>
                    {/* Driver cells */}
                    {car.owned.map((has, di) => (
                      <td key={di} style={{ borderBottom: "1px solid var(--border)", width: CELL_W, textAlign: "center", padding: "0.25rem 0" }}>
                        {has && (
                          <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "var(--accent)", margin: "0 auto", opacity: 0.85 }} />
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
