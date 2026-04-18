"use client";
import { useState, useEffect, useMemo, Fragment } from "react";
import { supabaseBrowser as supabase } from "../../../lib/supabase-browser";

// ── Column width constants (match InventoryMatrix for visual consistency) ──────
const NAME_COL_WIDTH = 220;
const COUNT_COL_WIDTH = 48;
const DRIVER_COL_WIDTH = 36;

const nameColStyle = {
  position: "sticky",
  left: 0,
  background: "var(--surface)",
  zIndex: 1,
  padding: "0.35rem 0.75rem",
  borderRight: "1px solid var(--border)",
  borderBottom: "1px solid var(--border)",
  fontSize: "0.8rem",
  width: `${NAME_COL_WIDTH}px`,
  maxWidth: `${NAME_COL_WIDTH}px`,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  boxSizing: "border-box",
};

const countCellStyle = {
  padding: "0.25rem 0.4rem",
  textAlign: "center",
  borderBottom: "1px solid var(--border)",
  borderRight: "1px solid var(--border)",
  width: `${COUNT_COL_WIDTH}px`,
  boxSizing: "border-box",
  fontSize: "0.72rem",
  fontWeight: 700,
  fontFamily: "var(--font-mono), monospace",
  color: "var(--accent)",
};

const cellStyle = {
  padding: "0.25rem 0",
  textAlign: "center",
  borderBottom: "1px solid var(--border)",
  width: `${DRIVER_COL_WIDTH}px`,
  boxSizing: "border-box",
};

// Compact K badge for Kronos catalog cars — matches InventoryMatrix badge
function KBadge() {
  return (
    <span
      style={{
        marginLeft: "0.35rem",
        fontSize: "0.58rem",
        fontWeight: 700,
        color: "var(--accent)",
        border: "1px solid var(--accent)",
        borderRadius: "2px",
        padding: "0 0.2rem",
        verticalAlign: "middle",
      }}
    >
      K
    </span>
  );
}

// Group header row style
const groupTdStyle = {
  position: "sticky",
  left: 0,
  padding: "0.4rem 0.75rem",
  fontSize: "0.72rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-dim)",
  background: "var(--surface-2)",
  borderBottom: "1px solid var(--border)",
};

// Inventory matrix filtered to cars entered in this event, with columns
// for all drivers assigned to any team entry in this event.
// Data is fetched lazily on mount to avoid bloating the event page query.
export default function EventInventoryTab({ teamEntries, archived }) {
  const [carOwnershipSets, setCarOwnershipSets] = useState({});
  const [kronosCarsMap, setKronosCarsMap] = useState({});
  const [loaded, setLoaded] = useState(false);

  // Derive unique cars and drivers from the event's team entries.
  // Cars are keyed by iracing_car_id; drivers by driver id.
  const { eventCars, matrixDrivers } = useMemo(() => {
    const carMap = new Map(); // iracing_car_id → car info
    const driverMap = new Map(); // driver id → driver info

    for (const entry of teamEntries) {
      // Use car_name_snapshot on archived events; fall back to live car name
      const carName =
        (archived ? entry.car_name_snapshot : null) || entry.cars?.name;
      if (entry.cars?.iracing_car_id && carName) {
        carMap.set(entry.cars.iracing_car_id, {
          iracing_car_id: entry.cars.iracing_car_id,
          car_name: carName,
          // Group by team entry class — this is the Kronos class, not iRacing category
          class: entry.class || "Autre",
        });
      }
      // Collect all unique drivers across all team entries
      for (const signup of entry.signups || []) {
        if (signup.drivers) {
          driverMap.set(signup.drivers.id, signup.drivers);
        }
      }
    }

    return {
      eventCars: [...carMap.values()],
      matrixDrivers: [...driverMap.values()].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    };
  }, [teamEntries, archived]);

  // Fetch car ownership and Kronos car catalog data on mount.
  // Only fetches rows relevant to this event (filtered by driver IDs and car IDs).
  useEffect(() => {
    const driverIds = matrixDrivers.map((d) => d.id);
    const carIds = eventCars.map((c) => c.iracing_car_id).filter(Boolean);

    if (driverIds.length === 0 || carIds.length === 0) {
      setLoaded(true);
      return;
    }

    Promise.all([
      // Car ownership: which drivers own which cars (iRacing account data)
      supabase
        .from("driver_car_ownership")
        .select("driver_id, iracing_car_id")
        .in("driver_id", driverIds)
        .in("iracing_car_id", carIds),
      // Kronos cars catalog: used to show the K badge and confirm registration
      supabase
        .from("cars")
        .select("iracing_car_id, class, car_type_label")
        .in("iracing_car_id", carIds),
    ]).then(([ownershipRes, kronosRes]) => {
      // Build driver_id → Set(iracing_car_id) for O(1) ownership lookup
      const ownershipMap = {};
      for (const row of ownershipRes.data || []) {
        if (!ownershipMap[row.driver_id])
          ownershipMap[row.driver_id] = new Set();
        ownershipMap[row.driver_id].add(row.iracing_car_id);
      }
      setCarOwnershipSets(ownershipMap);

      // Build iracing_car_id → Kronos catalog entry
      const kronosMap = {};
      for (const car of kronosRes.data || []) {
        if (car.iracing_car_id) kronosMap[car.iracing_car_id] = car;
      }
      setKronosCarsMap(kronosMap);

      setLoaded(true);
    });
  }, [eventCars, matrixDrivers]);

  // Group event cars by their Kronos class, sorted alphabetically
  const groupedCars = useMemo(() => {
    const classMap = {};
    for (const car of eventCars) {
      const cls = car.class || "Autre";
      if (!classMap[cls]) classMap[cls] = [];
      classMap[cls].push(car);
    }
    return Object.entries(classMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([cls, cars]) => ({
        cls,
        cars: cars.slice().sort((a, b) => a.car_name.localeCompare(b.car_name)),
      }));
  }, [eventCars]);

  if (!loaded) {
    return <div className="empty">Chargement...</div>;
  }

  if (eventCars.length === 0) {
    return (
      <div className="table-wrap">
        <div className="empty">Aucune voiture engagée dans cet événement.</div>
      </div>
    );
  }

  if (matrixDrivers.length === 0) {
    return (
      <div className="table-wrap">
        <div className="empty">
          Aucun pilote assigné à un équipage pour le moment.
        </div>
      </div>
    );
  }

  const colCount = matrixDrivers.length + 2; // name col + count col + driver cols

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", tableLayout: "fixed" }}>
        {/* colgroup enforces exact column widths matching header and data rows */}
        <colgroup>
          <col style={{ width: `${NAME_COL_WIDTH}px` }} />
          <col style={{ width: `${COUNT_COL_WIDTH}px` }} />
          {matrixDrivers.map((d) => (
            <col key={d.id} style={{ width: `${DRIVER_COL_WIDTH}px` }} />
          ))}
        </colgroup>

        <thead>
          <tr>
            {/* Car name header */}
            <th
              style={{
                ...nameColStyle,
                background: "var(--surface-2)",
                fontWeight: 700,
                fontSize: "0.7rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--text-dim)",
                zIndex: 2,
                borderBottom: "2px solid var(--border)",
              }}
            >
              Voiture
            </th>
            {/* Owner count header */}
            <th
              style={{
                background: "var(--surface-2)",
                borderBottom: "2px solid var(--border)",
                borderRight: "1px solid var(--border)",
                width: `${COUNT_COL_WIDTH}px`,
                fontSize: "0.65rem",
                fontWeight: 700,
                color: "var(--text-dim)",
                textAlign: "center",
                verticalAlign: "bottom",
                padding: "0.25rem",
              }}
            >
              #
            </th>
            {/* Driver name headers — rotated vertically to save horizontal space */}
            {matrixDrivers.map((d) => (
              <th
                key={d.id}
                style={{
                  background: "var(--surface-2)",
                  borderBottom: "2px solid var(--border)",
                  verticalAlign: "bottom",
                  width: `${DRIVER_COL_WIDTH}px`,
                  boxSizing: "border-box",
                  overflow: "hidden",
                  padding: 0,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "flex-end",
                    height: "80px",
                    paddingBottom: "0.25rem",
                  }}
                >
                  <span
                    style={{
                      writingMode: "vertical-rl",
                      transform: "rotate(180deg)",
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      color: "var(--text-dim)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {d.name.split(" ")[0]}
                  </span>
                </div>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {groupedCars.map(({ cls, cars }) => (
            <Fragment key={cls}>
              {/* Class group header */}
              <tr>
                <td colSpan={colCount} style={groupTdStyle}>
                  {cls}
                </td>
              </tr>

              {/* Car rows */}
              {cars.map((car) => {
                const isKronos = !!kronosCarsMap[car.iracing_car_id];
                const ownerCount = matrixDrivers.filter((d) =>
                  carOwnershipSets[d.id]?.has(car.iracing_car_id),
                ).length;

                return (
                  <tr key={car.iracing_car_id}>
                    <td style={nameColStyle}>
                      {car.car_name}
                      {/* K badge for cars registered in the Kronos catalog */}
                      {isKronos && <KBadge />}
                    </td>
                    <td style={countCellStyle}>
                      {ownerCount}/{matrixDrivers.length}
                    </td>
                    {matrixDrivers.map((d) => (
                      <td key={d.id} style={cellStyle}>
                        {carOwnershipSets[d.id]?.has(car.iracing_car_id) ? (
                          <span
                            style={{ color: "var(--accent)", fontWeight: 700 }}
                          >
                            ✓
                          </span>
                        ) : (
                          <span
                            style={{ color: "var(--text-dim)", opacity: 0.35 }}
                          >
                            —
                          </span>
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
