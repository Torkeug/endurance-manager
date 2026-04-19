"use client";
import { useState, useEffect, useMemo, Fragment } from "react";
import { supabaseBrowser as supabase } from "../../../lib/supabase-browser";

// ── Column widths ─────────────────────────────────────────────────────────────
const NAME_COL_WIDTH = 220;
const COUNT_COL_WIDTH = 48;
const DRIVER_COL_WIDTH = 36;

// Adaptive header height for vertical driver names.
// With writing-mode: vertical-rl the cell height must fit the full text width.
// At 0.68rem (~11px), each character is ~7px wide — add 16px padding on top.
function headerHeight(maxNameLen) {
  return Math.max(100, maxNameLen * 7 + 16);
}

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
  verticalAlign: "bottom",
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

// Compact K badge for Kronos catalog cars
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

// Format as "Prénom N." — matches InventoryMatrix format
function formatDriverName(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const firstName = parts.slice(0, -1).join(" ");
  const lastInitial = parts[parts.length - 1][0].toUpperCase();
  return `${firstName} ${lastInitial}.`;
}

export default function EventInventoryTab({
  // eventSignups: the event.signups array (drivers (id, name, irating))
  eventSignups,
  archived,
  eventFormat,
}) {
  const [eventCars, setEventCars] = useState([]);
  const [carOwnershipSets, setCarOwnershipSets] = useState({});
  const [kronosCarsMap, setKronosCarsMap] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

  // Sort state: col = "name" | "count", dir = "asc" | "desc"
  const [sort, setSort] = useState({ col: "name", dir: "asc" });

  // Derive unique drivers from event inscriptions (signups with a driver record).
  // Using signups means we include all registered pilots, not just those in a team entry.
  const matrixDrivers = useMemo(() => {
    const driverMap = new Map();
    for (const signup of eventSignups || []) {
      if (signup.drivers) {
        driverMap.set(signup.drivers.id, signup.drivers);
      }
    }
    return [...driverMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [eventSignups]);

  // Adaptive header height based on the longest formatted driver name
  const maxNameLen = useMemo(
    () =>
      matrixDrivers.reduce(
        (max, d) => Math.max(max, formatDriverName(d.name).length),
        0,
      ),
    [matrixDrivers],
  );
  const hHeight = headerHeight(maxNameLen);

  // Fetch event type cars then ownership data
  useEffect(() => {
    const load = async () => {
      if (!eventFormat) {
        setLoaded(true);
        return;
      }

      // Step 1: resolve event type ID from the format name
      const { data: eventType, error: typeErr } = await supabase
        .from("event_types")
        .select("id")
        .eq("name", eventFormat)
        .single();

      if (typeErr || !eventType?.id) {
        setLoaded(true);
        return;
      }

      // Step 2: fetch all cars linked to this event type via event_type_cars
      const { data: typeCars, error: carsErr } = await supabase
        .from("event_type_cars")
        .select("cars (id, name, iracing_car_id, class)")
        .eq("event_type_id", eventType.id);

      if (carsErr) {
        setError(carsErr.message);
        setLoaded(true);
        return;
      }

      // Deduplicate by iracing_car_id (fallback to id)
      const carMap = new Map();
      for (const row of typeCars || []) {
        const car = row.cars;
        if (!car) continue;
        const key = car.iracing_car_id ?? car.id;
        if (!carMap.has(key)) carMap.set(key, car);
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
        // Which drivers own which cars (iRacing sync data)
        supabase
          .from("driver_car_ownership")
          .select("driver_id, iracing_car_id")
          .in("driver_id", driverIds)
          .in("iracing_car_id", carIds),
        // Kronos catalog for K badge
        supabase
          .from("cars")
          .select("iracing_car_id, class, car_type_label")
          .in("iracing_car_id", carIds),
      ]);

      // Build driver_id → Set(iracing_car_id)
      const ownershipMap = {};
      for (const row of ownershipRes.data || []) {
        if (!ownershipMap[row.driver_id])
          ownershipMap[row.driver_id] = new Set();
        ownershipMap[row.driver_id].add(row.iracing_car_id);
      }
      setCarOwnershipSets(ownershipMap);

      // Build iracing_car_id → Kronos entry
      const kronosMap = {};
      for (const car of kronosRes.data || []) {
        if (car.iracing_car_id) kronosMap[car.iracing_car_id] = car;
      }
      setKronosCarsMap(kronosMap);
      setLoaded(true);
    };

    load();
  }, [eventFormat, matrixDrivers]);

  // Toggle sort — same col flips direction, new col defaults to desc for count, asc for name
  const toggleSort = (col) => {
    setSort((prev) => {
      if (prev.col === col)
        return { col, dir: prev.dir === "asc" ? "desc" : "asc" };
      return { col, dir: col === "count" ? "desc" : "asc" };
    });
  };

  const sortArrow = (col) =>
    sort.col === col ? (sort.dir === "asc" ? " ↑" : " ↓") : "";

  // Group cars by Kronos class, sorted; within each group apply the active sort
  const groupedCars = useMemo(() => {
    const classMap = {};
    for (const car of eventCars) {
      const cls = car.class || "Autre";
      if (!classMap[cls]) classMap[cls] = [];
      classMap[cls].push(car);
    }

    return Object.entries(classMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([cls, cars]) => {
        const sorted = cars.slice().sort((a, b) => {
          if (sort.col === "count") {
            const aCount = matrixDrivers.filter((d) =>
              carOwnershipSets[d.id]?.has(a.iracing_car_id),
            ).length;
            const bCount = matrixDrivers.filter((d) =>
              carOwnershipSets[d.id]?.has(b.iracing_car_id),
            ).length;
            const diff = sort.dir === "asc" ? aCount - bCount : bCount - aCount;
            return diff !== 0
              ? diff
              : (a.name || "").localeCompare(b.name || "");
          }
          // Sort by name
          const diff = (a.name || "").localeCompare(b.name || "");
          return sort.dir === "asc" ? diff : -diff;
        });
        return { cls, cars: sorted };
      });
    // Recalculate when ownership data or sort changes
  }, [eventCars, sort, carOwnershipSets, matrixDrivers]);

  if (!loaded) return <div className="empty">Chargement...</div>;
  if (error) return <div className="alert alert-error">{error}</div>;

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
        <div className="empty">Aucun pilote inscrit pour le moment.</div>
      </div>
    );
  }

  const colCount = matrixDrivers.length + 2;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: `${NAME_COL_WIDTH}px` }} />
          <col style={{ width: `${COUNT_COL_WIDTH}px` }} />
          {matrixDrivers.map((d) => (
            <col key={d.id} style={{ width: `${DRIVER_COL_WIDTH}px` }} />
          ))}
        </colgroup>

        <thead>
          <tr>
            {/* Voiture — sortable by name */}
            <th
              onClick={() => toggleSort("name")}
              style={{
                ...nameColStyle,
                background: "var(--surface-2)",
                fontWeight: 700,
                fontSize: "0.7rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color:
                  sort.col === "name" ? "var(--accent)" : "var(--text-dim)",
                zIndex: 2,
                borderBottom: "2px solid var(--border)",
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              Voiture{sortArrow("name")}
            </th>

            {/* # — sortable by owner count, vertically aligned to match Voiture */}
            <th
              onClick={() => toggleSort("count")}
              style={{
                background: "var(--surface-2)",
                borderBottom: "2px solid var(--border)",
                borderRight: "1px solid var(--border)",
                width: `${COUNT_COL_WIDTH}px`,
                fontSize: "0.65rem",
                fontWeight: 700,
                color:
                  sort.col === "count" ? "var(--accent)" : "var(--text-dim)",
                textAlign: "center",
                verticalAlign: "bottom",
                padding: "0.25rem",
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              #{sortArrow("count")}
            </th>

            {/* Driver name headers — vertical, aligned to bottom, adaptive height */}
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
                    height: `${hHeight}px`,
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
              <tr>
                <td colSpan={colCount} style={groupTdStyle}>
                  {cls}
                </td>
              </tr>
              {cars.map((car) => {
                const isKronos = !!kronosCarsMap[car.iracing_car_id];
                const ownerCount = matrixDrivers.filter((d) =>
                  carOwnershipSets[d.id]?.has(car.iracing_car_id),
                ).length;
                return (
                  <tr key={car.iracing_car_id ?? car.id}>
                    <td style={nameColStyle}>
                      {car.name}
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
