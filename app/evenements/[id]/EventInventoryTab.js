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

// Format driver name as "Prénom N." — first name(s) + initial of surname.
// Matches the format used in InventoryMatrix.
function formatDriverName(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const firstName = parts.slice(0, -1).join(" ");
  const lastInitial = parts[parts.length - 1][0].toUpperCase();
  return `${firstName} ${lastInitial}.`;
}

// Inventory matrix filtered to cars available for this event's type,
// with columns for all drivers assigned to any team entry in this event.
// Data is fetched lazily on mount to avoid bloating the event page query.
export default function EventInventoryTab({
  teamEntries,
  archived,
  eventFormat,
}) {
  // Cars come from the event type catalog (not from team entries)
  const [eventCars, setEventCars] = useState([]);
  const [carOwnershipSets, setCarOwnershipSets] = useState({});
  const [kronosCarsMap, setKronosCarsMap] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

  // Derive unique drivers from the event's team entries — who is actually racing
  const matrixDrivers = useMemo(() => {
    const driverMap = new Map();
    for (const entry of teamEntries) {
      for (const signup of entry.signups || []) {
        if (signup.drivers) {
          driverMap.set(signup.drivers.id, signup.drivers);
        }
      }
    }
    return [...driverMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [teamEntries]);

  // Fetch event type cars then ownership data.
  // Sequential: event_types → event_type_cars → driver_car_ownership.
  useEffect(() => {
    const load = async () => {
      // Step 1: resolve event type ID from the event format name
      if (!eventFormat) {
        setLoaded(true);
        return;
      }

      const { data: eventType, error: typeErr } = await supabase
        .from("event_types")
        .select("id")
        .eq("name", eventFormat)
        .single();

      if (typeErr || !eventType?.id) {
        // No matching event type — show empty state
        setLoaded(true);
        return;
      }

      // Step 2: fetch all cars linked to this event type
      const { data: typeCars, error: carsErr } = await supabase
        .from("event_type_cars")
        .select("cars (id, name, iracing_car_id, class)")
        .eq("event_type_id", eventType.id);

      if (carsErr) {
        setError(carsErr.message);
        setLoaded(true);
        return;
      }

      // Flatten and deduplicate by iracing_car_id
      const carMap = new Map();
      for (const row of typeCars || []) {
        const car = row.cars;
        if (car && !carMap.has(car.iracing_car_id ?? car.id)) {
          carMap.set(car.iracing_car_id ?? car.id, car);
        }
      }
      const cars = [...carMap.values()].sort((a, b) =>
        (a.name || "").localeCompare(b.name || ""),
      );
      setEventCars(cars);

      // Step 3: fetch ownership + Kronos catalog for these cars + event drivers
      const driverIds = matrixDrivers.map((d) => d.id);
      const carIds = cars.map((c) => c.iracing_car_id).filter(Boolean);

      if (driverIds.length === 0 || carIds.length === 0) {
        setLoaded(true);
        return;
      }

      const [ownershipRes, kronosRes] = await Promise.all([
        // Car ownership: which drivers own which cars (from iRacing sync)
        supabase
          .from("driver_car_ownership")
          .select("driver_id, iracing_car_id")
          .in("driver_id", driverIds)
          .in("iracing_car_id", carIds),
        // Kronos catalog: used to show the K badge
        supabase
          .from("cars")
          .select("iracing_car_id, class, car_type_label")
          .in("iracing_car_id", carIds),
      ]);

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
    };

    load();
  }, [eventFormat, matrixDrivers]);

  // Group event type cars by their Kronos class, sorted alphabetically
  const groupedCars = useMemo(() => {
    const classMap = {};
    for (const car of eventCars) {
      const cls = car.class || "Autre";
      if (!classMap[cls]) classMap[cls] = [];
      classMap[cls].push(car);
    }
    return Object.entries(classMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([cls, cars]) => ({ cls, cars }));
  }, [eventCars]);

  if (!loaded) return <div className="empty">Chargement...</div>;

  if (error) {
    return <div className="alert alert-error">{error}</div>;
  }

  if (!eventFormat) {
    return (
      <div className="table-wrap">
        <div className="empty">
          Aucun type d&apos;événement défini pour cet événement.
        </div>
      </div>
    );
  }

  if (eventCars.length === 0) {
    return (
      <div className="table-wrap">
        <div className="empty">
          Aucune voiture configurée pour le type « {eventFormat} ».
        </div>
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

  const colCount = matrixDrivers.length + 2;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", tableLayout: "fixed" }}>
        {/* colgroup enforces exact column widths */}
        <colgroup>
          <col style={{ width: `${NAME_COL_WIDTH}px` }} />
          <col style={{ width: `${COUNT_COL_WIDTH}px` }} />
          {matrixDrivers.map((d) => (
            <col key={d.id} style={{ width: `${DRIVER_COL_WIDTH}px` }} />
          ))}
        </colgroup>

        <thead>
          <tr>
            {/* Car name header — verticalAlign bottom matches driver name headers */}
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
                verticalAlign: "bottom",
              }}
            >
              Voiture
            </th>
            {/* # header — same verticalAlign as Voiture for alignment consistency */}
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
            {/* Driver name headers — rotated vertically, aligned to bottom */}
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
                    {formatDriverName(d.name)}
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
                  <tr key={car.iracing_car_id ?? car.id}>
                    <td style={nameColStyle}>
                      {car.name}
                      {/* K badge for cars registered in the Kronos catalog */}
                      {isKronos && <KBadge />}
                    </td>
                    <td style={countCellStyle}>
                      {car.iracing_car_id
                        ? `${ownerCount}/${matrixDrivers.length}`
                        : "—"}
                    </td>
                    {matrixDrivers.map((d) => (
                      <td key={d.id} style={cellStyle}>
                        {car.iracing_car_id &&
                        carOwnershipSets[d.id]?.has(car.iracing_car_id) ? (
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
