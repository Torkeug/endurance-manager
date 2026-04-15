"use client";
import { useState, useEffect, useMemo, Fragment } from "react";
import { isLegacyContent } from "../../lib/car-types";

const CAR_CATEGORY_LABELS = {
  sports_car: "Sports Car",
  formula_car: "Formula Car",
  oval: "Oval",
  dirt_oval: "Dirt Oval",
  dirt_road: "Dirt Road",
  other: "Autre",
};

const TRACK_CATEGORY_LABELS = {
  road: "Road",
  oval: "Oval",
  dirt_oval: "Dirt Oval",
  dirt_road: "Dirt Road",
  other: "Autre",
};

// Toggle filter pill
function FilterPill({ label, active, onToggle }) {
  return (
    <button
      onClick={onToggle}
      style={{
        padding: "0.3rem 0.75rem",
        borderRadius: "3px",
        border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
        background: active ? "var(--accent-dim)" : "var(--surface-2)",
        color: active ? "var(--accent)" : "var(--text-dim)",
        fontFamily: "var(--font-rajdhani), sans-serif",
        fontSize: "0.78rem",
        fontWeight: 700,
        cursor: "pointer",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {label}
    </button>
  );
}

// Shared table cell styles
// Fixed column widths — applied via colgroup for proper alignment
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

const cellStyle = {
  padding: "0.25rem 0",
  textAlign: "center",
  borderBottom: "1px solid var(--border)",
  width: `${DRIVER_COL_WIDTH}px`,
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

// Kronos badge — compact K for matrix use
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
        flexShrink: 0,
      }}
    >
      K
    </span>
  );
}

export default function InventoryMatrix({
  matrixDrivers,
  allCars,
  allTracks,
  carOwnership,
  trackOwnership,
  kronosCarsMap,
  iracingLabelById,
  kronosCircuitsByTrackId,
  kronosCircuitNames,
}) {
  const [subTab, setSubTab] = useState("cars");
  const [loaded, setLoaded] = useState(false);

  // Filter state — starts empty, populated from localStorage in useEffect
  const [selectedCarCats, setSelectedCarCats] = useState([]);
  const [selectedCarClasses, setSelectedCarClasses] = useState([]);
  const [selectedTrackCats, setSelectedTrackCats] = useState([]);

  // Build O(1) lookup sets from serialized ownership arrays
  const carOwnershipSets = useMemo(() => {
    const map = {};
    for (const [driverId, carIds] of Object.entries(carOwnership || {})) {
      map[driverId] = new Set(carIds);
    }
    return map;
  }, [carOwnership]);

  const trackOwnershipSets = useMemo(() => {
    const map = {};
    for (const [driverId, trackNames] of Object.entries(trackOwnership || {})) {
      map[driverId] = new Set(trackNames);
    }
    return map;
  }, [trackOwnership]);

  // Derive all unique filter options from the data
  const allCarCategories = useMemo(
    () =>
      [
        ...new Set((allCars || []).map((c) => c.car_category).filter(Boolean)),
      ].sort(),
    [allCars],
  );

  // Derive class label from Kronos map — car_type_label if set, then class, else "Autre"
  const getCarClass = (car) => {
    const k = (kronosCarsMap || {})[car.iracing_car_id];
    // Same 4-level priority as inventaire/page.js
    return (
      k?.car_type_label?.toUpperCase() ||
      k?.class ||
      (iracingLabelById || {})[car.iracing_car_id]?.toUpperCase() ||
      "Autre"
    );
  };

  // Only show class filters relevant to the currently selected categories
  const allCarClasses = useMemo(() => {
    const filtered =
      selectedCarCats.length === 0
        ? allCars || []
        : (allCars || []).filter((c) =>
            selectedCarCats.includes(c.car_category),
          );
    return [...new Set(filtered.map(getCarClass))].sort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCars, selectedCarCats, kronosCarsMap, iracingLabelById]);

  const allTrackCategories = useMemo(
    () =>
      [
        ...new Set(
          (allTracks || []).map((t) => t.track_category).filter(Boolean),
        ),
      ].sort(),
    [allTracks],
  );

  // Two-tier Kronos badge: exact iracing_track_id match first, name fallback for unlinked
  const kronosCircuitSet = useMemo(
    () => new Set(kronosCircuitNames || []),
    [kronosCircuitNames],
  );

  const isKronosTrack = (track) =>
    !!(kronosCircuitsByTrackId || {})[track.iracing_track_id] ||
    kronosCircuitSet.has(track.track_name);

  // Load persisted filter state from localStorage on mount
  // Never read localStorage in useState initializer — causes hydration errors
  useEffect(() => {
    try {
      const savedSubTab = localStorage.getItem("kronos_inv_sub_tab");
      if (savedSubTab) setSubTab(savedSubTab);

      const savedCarCats = localStorage.getItem("kronos_inv_car_cats");
      setSelectedCarCats(
        savedCarCats ? JSON.parse(savedCarCats) : allCarCategories,
      );

      const savedCarClasses = localStorage.getItem("kronos_inv_car_classes");
      setSelectedCarClasses(
        savedCarClasses ? JSON.parse(savedCarClasses) : allCarClasses,
      );

      const savedTrackCats = localStorage.getItem("kronos_inv_track_cats");
      setSelectedTrackCats(
        savedTrackCats ? JSON.parse(savedTrackCats) : allTrackCategories,
      );
    } catch {
      // Fallback to all-selected if localStorage fails
      setSelectedCarCats(allCarCategories);
      setSelectedCarClasses(allCarClasses);
      setSelectedTrackCats(allTrackCategories);
    } finally {
      setLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist filter changes to localStorage after initial load
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem("kronos_inv_sub_tab", subTab);
    } catch {}
  }, [subTab, loaded]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(
        "kronos_inv_car_cats",
        JSON.stringify(selectedCarCats),
      );
    } catch {}
  }, [selectedCarCats, loaded]);

  // When categories change, drop any selected classes that no longer exist in the filtered set
  useEffect(() => {
    if (!loaded) return;
    setSelectedCarClasses((prev) =>
      prev.filter((cls) => allCarClasses.includes(cls)),
    );
  }, [allCarClasses, loaded]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(
        "kronos_inv_car_classes",
        JSON.stringify(selectedCarClasses),
      );
    } catch {}
  }, [selectedCarClasses, loaded]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(
        "kronos_inv_track_cats",
        JSON.stringify(selectedTrackCats),
      );
    } catch {}
  }, [selectedTrackCats, loaded]);

  // Toggle a value in/out of a filter array
  function toggleFilter(value, selected, setSelected) {
    setSelected(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  }

  // Build grouped car matrix rows (category → class → cars, with legacy bucket)
  const carMatrixRows = useMemo(() => {
    if (!loaded) return [];
    const filtered = (allCars || []).filter((car) => {
      const catOk =
        selectedCarCats.length === 0 ||
        selectedCarCats.includes(car.car_category);
      const cls = getCarClass(car);
      const clsOk =
        selectedCarClasses.length === 0 || selectedCarClasses.includes(cls);
      return catOk && clsOk;
    });
    const catMap = {};
    for (const car of filtered) {
      const cat = car.car_category || "other";
      const cls = getCarClass(car);
      const legacy = car.isLegacy || isLegacyContent(car.car_name);
      if (!catMap[cat]) catMap[cat] = { normal: {}, legacy: [] };
      if (legacy) {
        catMap[cat].legacy.push(car);
      } else {
        if (!catMap[cat].normal[cls]) catMap[cat].normal[cls] = [];
        catMap[cat].normal[cls].push(car);
      }
    }

    return Object.entries(catMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, { normal, legacy }]) => ({
        category,
        classes: Object.entries(normal)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([cls, cars]) => ({
            cls,
            cars: cars.sort((a, b) => a.car_name.localeCompare(b.car_name)),
          })),
        legacy: legacy.sort((a, b) => a.car_name.localeCompare(b.car_name)),
      }));
  }, [
    allCars,
    selectedCarCats,
    selectedCarClasses,
    kronosCarsMap,
    iracingLabelById,
    loaded,
  ]);

  // Build grouped track matrix rows (category → tracks, with legacy bucket)
  const trackMatrixRows = useMemo(() => {
    if (!loaded) return [];
    const filtered = (allTracks || []).filter(
      (track) =>
        selectedTrackCats.length === 0 ||
        selectedTrackCats.includes(track.track_category),
    );

    const catMap = {};
    for (const track of filtered) {
      const cat = track.track_category || "other";
      const legacy = track.isLegacy || isLegacyContent(track.track_name);
      if (!catMap[cat]) catMap[cat] = { normal: [], legacy: [] };
      if (legacy) {
        catMap[cat].legacy.push(track);
      } else {
        catMap[cat].normal.push(track);
      }
    }

    return Object.entries(catMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, { normal, legacy }]) => ({
        category,
        tracks: normal.sort((a, b) => a.track_name.localeCompare(b.track_name)),
        legacy: legacy.sort((a, b) => a.track_name.localeCompare(b.track_name)),
      }));
  }, [allTracks, selectedTrackCats, loaded]);

  if (!loaded) {
    return <div className="empty">Chargement...</div>;
  }

  // +1 for name col, +1 for count col, + drivers
  const colCount = matrixDrivers.length + 2;

  // Reusable group header row style
  const groupTdStyle = (indent = 0, muted = false) => ({
    position: "sticky",
    left: 0,
    padding: `0.4rem 0.75rem 0.4rem ${0.75 + indent * 1.5}rem`,
    fontSize: indent === 0 ? "0.72rem" : "0.7rem",
    fontWeight: 700,
    letterSpacing: indent === 0 ? "0.08em" : "0.04em",
    textTransform: indent === 0 ? "uppercase" : "none",
    fontStyle: muted ? "italic" : "normal",
    color: "var(--text-dim)",
    background: indent === 0 ? "var(--surface-2)" : "var(--surface)",
    borderBottom: "1px solid var(--border)",
    opacity: muted ? 0.7 : 1,
  });

  return (
    <div>
      {/* Sub-tab switcher */}
      <div
        style={{
          display: "flex",
          gap: "0.25rem",
          borderBottom: "1px solid var(--border)",
          marginBottom: "1rem",
        }}
      >
        {[
          { id: "cars", label: "Voitures" },
          { id: "tracks", label: "Circuits" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            style={{
              padding: "0.5rem 1.25rem",
              background: "transparent",
              border: "none",
              borderBottom:
                subTab === tab.id
                  ? "2px solid var(--accent)"
                  : "2px solid transparent",
              color: subTab === tab.id ? "var(--accent)" : "var(--text-dim)",
              fontFamily: "var(--font-rajdhani), sans-serif",
              fontSize: "0.85rem",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: "pointer",
              marginBottom: "-1px",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Cars ──────────────────────────────────────────────────────────── */}
      {subTab === "cars" && (
        <>
          {/* Category filter pills */}
          <div style={{ marginBottom: "0.75rem" }}>
            <div
              style={{
                fontSize: "0.7rem",
                fontWeight: 700,
                color: "var(--text-dim)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: "0.4rem",
              }}
            >
              Catégorie
            </div>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              {allCarCategories.map((cat) => (
                <FilterPill
                  key={cat}
                  label={CAR_CATEGORY_LABELS[cat] || cat}
                  active={selectedCarCats.includes(cat)}
                  onToggle={() =>
                    toggleFilter(cat, selectedCarCats, setSelectedCarCats)
                  }
                />
              ))}
            </div>
          </div>

          {/* Class filter pills */}
          <div style={{ marginBottom: "1.25rem" }}>
            <div
              style={{
                fontSize: "0.7rem",
                fontWeight: 700,
                color: "var(--text-dim)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: "0.4rem",
              }}
            >
              Classe
            </div>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              {allCarClasses.map((cls) => (
                <FilterPill
                  key={cls}
                  label={cls}
                  active={selectedCarClasses.includes(cls)}
                  onToggle={() =>
                    toggleFilter(cls, selectedCarClasses, setSelectedCarClasses)
                  }
                />
              ))}
            </div>
          </div>

          {/* Empty state */}
          {carMatrixRows.length === 0 && (
            <div className="card">
              <div className="empty">
                Aucune voiture correspondant aux filtres sélectionnés.
              </div>
            </div>
          )}

          {/* Cars matrix table */}
          {carMatrixRows.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{ borderCollapse: "collapse", tableLayout: "fixed" }}
              >
                {/* colgroup enforces exact column widths matching header and data rows */}
                <colgroup>
                  <col style={{ width: `${NAME_COL_WIDTH}px` }} />
                  <col style={{ width: `${COUNT_COL_WIDTH}px` }} />
                  {matrixDrivers.map((d) => (
                    <col
                      key={d.id}
                      style={{ width: `${DRIVER_COL_WIDTH}px` }}
                    />
                  ))}
                </colgroup>
                <thead>
                  <tr>
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
                  {carMatrixRows.map(({ category, classes, legacy }) => (
                    <Fragment key={category}>
                      {/* Category header row */}
                      <tr>
                        <td colSpan={colCount} style={groupTdStyle(0)}>
                          {CAR_CATEGORY_LABELS[category] || category}
                        </td>
                      </tr>

                      {/* Classes and their cars */}
                      {classes.map(({ cls, cars }) => (
                        <Fragment key={`${category}|${cls}`}>
                          {/* Class header row */}
                          <tr>
                            <td colSpan={colCount} style={groupTdStyle(1)}>
                              {cls}
                            </td>
                          </tr>
                          {/* Car data rows */}
                          {cars.map((car) => {
                            const ownerCount = matrixDrivers.filter((d) =>
                              carOwnershipSets[d.id]?.has(car.iracing_car_id),
                            ).length;
                            return (
                              <tr key={car.iracing_car_id}>
                                <td style={nameColStyle}>
                                  {car.car_name}
                                  {!!(kronosCarsMap || {})[
                                    car.iracing_car_id
                                  ] && <KBadge />}
                                </td>
                                <td style={countCellStyle}>
                                  {ownerCount}/{matrixDrivers.length}
                                </td>
                                {matrixDrivers.map((d) => (
                                  <td key={d.id} style={cellStyle}>
                                    {carOwnershipSets[d.id]?.has(
                                      car.iracing_car_id,
                                    ) ? (
                                      <span
                                        style={{
                                          color: "var(--accent)",
                                          fontWeight: 700,
                                        }}
                                      >
                                        ✓
                                      </span>
                                    ) : (
                                      <span
                                        style={{
                                          color: "var(--text-dim)",
                                          opacity: 0.35,
                                        }}
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

                      {/* Legacy & Retired sub-group */}
                      {legacy.length > 0 && (
                        <Fragment key={`${category}|legacy`}>
                          <tr>
                            <td
                              colSpan={colCount}
                              style={groupTdStyle(1, true)}
                            >
                              Legacy & Retraités ({legacy.length})
                            </td>
                          </tr>
                          {legacy.map((car) => {
                            const ownerCount = matrixDrivers.filter((d) =>
                              carOwnershipSets[d.id]?.has(car.iracing_car_id),
                            ).length;
                            return (
                              <tr key={car.iracing_car_id}>
                                <td
                                  style={{
                                    ...nameColStyle,
                                    opacity: 0.55,
                                    fontStyle: "italic",
                                  }}
                                >
                                  {car.car_name}
                                  {!!(kronosCarsMap || {})[
                                    car.iracing_car_id
                                  ] && <KBadge />}
                                </td>
                                <td
                                  style={{ ...countCellStyle, opacity: 0.55 }}
                                >
                                  {ownerCount}/{matrixDrivers.length}
                                </td>
                                {matrixDrivers.map((d) => (
                                  <td
                                    key={d.id}
                                    style={{ ...cellStyle, opacity: 0.55 }}
                                  >
                                    {carOwnershipSets[d.id]?.has(
                                      car.iracing_car_id,
                                    ) ? (
                                      <span
                                        style={{
                                          color: "var(--accent)",
                                          fontWeight: 700,
                                        }}
                                      >
                                        ✓
                                      </span>
                                    ) : (
                                      <span
                                        style={{
                                          color: "var(--text-dim)",
                                          opacity: 0.35,
                                        }}
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
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Tracks ────────────────────────────────────────────────────────── */}
      {subTab === "tracks" && (
        <>
          {/* Category filter pills */}
          <div style={{ marginBottom: "1.25rem" }}>
            <div
              style={{
                fontSize: "0.7rem",
                fontWeight: 700,
                color: "var(--text-dim)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: "0.4rem",
              }}
            >
              Catégorie
            </div>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              {allTrackCategories.map((cat) => (
                <FilterPill
                  key={cat}
                  label={TRACK_CATEGORY_LABELS[cat] || cat}
                  active={selectedTrackCats.includes(cat)}
                  onToggle={() =>
                    toggleFilter(cat, selectedTrackCats, setSelectedTrackCats)
                  }
                />
              ))}
            </div>
          </div>

          {/* Empty state */}
          {trackMatrixRows.length === 0 && (
            <div className="card">
              <div className="empty">
                Aucun circuit correspondant aux filtres sélectionnés.
              </div>
            </div>
          )}

          {/* Tracks matrix table */}
          {trackMatrixRows.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{ borderCollapse: "collapse", tableLayout: "fixed" }}
              >
                {/* colgroup enforces exact column widths matching header and data rows */}
                <colgroup>
                  <col style={{ width: `${NAME_COL_WIDTH}px` }} />
                  <col style={{ width: `${COUNT_COL_WIDTH}px` }} />
                  {matrixDrivers.map((d) => (
                    <col
                      key={d.id}
                      style={{ width: `${DRIVER_COL_WIDTH}px` }}
                    />
                  ))}
                </colgroup>
                <thead>
                  <tr>
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
                      Circuit
                    </th>
                    {/* Count column header */}
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
                  {trackMatrixRows.map(({ category, tracks, legacy }) => (
                    <Fragment key={category}>
                      {/* Category header row */}
                      <tr>
                        <td colSpan={colCount} style={groupTdStyle(0)}>
                          {TRACK_CATEGORY_LABELS[category] || category}
                        </td>
                      </tr>

                      {/* Normal tracks */}
                      {tracks.map((track) => {
                        const ownerCount = matrixDrivers.filter((d) =>
                          trackOwnershipSets[d.id]?.has(track.track_name),
                        ).length;
                        return (
                          <tr key={track.track_name}>
                            <td style={nameColStyle}>
                              {track.track_name}
                              {isKronosTrack(track) && <KBadge />}
                            </td>
                            <td style={countCellStyle}>
                              {ownerCount}/{matrixDrivers.length}
                            </td>
                            {matrixDrivers.map((d) => (
                              <td key={d.id} style={cellStyle}>
                                {trackOwnershipSets[d.id]?.has(
                                  track.track_name,
                                ) ? (
                                  <span
                                    style={{
                                      color: "var(--accent)",
                                      fontWeight: 700,
                                    }}
                                  >
                                    ✓
                                  </span>
                                ) : (
                                  <span
                                    style={{
                                      color: "var(--text-dim)",
                                      opacity: 0.35,
                                    }}
                                  >
                                    —
                                  </span>
                                )}
                              </td>
                            ))}
                          </tr>
                        );
                      })}

                      {/* Legacy & Retired sub-group */}
                      {legacy.length > 0 && (
                        <Fragment key={`${category}|legacy`}>
                          <tr>
                            <td
                              colSpan={colCount}
                              style={groupTdStyle(1, true)}
                            >
                              Legacy & Retraités ({legacy.length})
                            </td>
                          </tr>
                          {legacy.map((track) => {
                            const ownerCount = matrixDrivers.filter((d) =>
                              trackOwnershipSets[d.id]?.has(track.track_name),
                            ).length;
                            return (
                              <tr key={track.track_name}>
                                <td
                                  style={{
                                    ...nameColStyle,
                                    opacity: 0.55,
                                    fontStyle: "italic",
                                  }}
                                >
                                  {track.track_name}
                                  {isKronosTrack(track) && <KBadge />}
                                </td>
                                <td
                                  style={{ ...countCellStyle, opacity: 0.55 }}
                                >
                                  {ownerCount}/{matrixDrivers.length}
                                </td>
                                {matrixDrivers.map((d) => (
                                  <td
                                    key={d.id}
                                    style={{ ...cellStyle, opacity: 0.55 }}
                                  >
                                    {trackOwnershipSets[d.id]?.has(
                                      track.track_name,
                                    ) ? (
                                      <span
                                        style={{
                                          color: "var(--accent)",
                                          fontWeight: 700,
                                        }}
                                      >
                                        ✓
                                      </span>
                                    ) : (
                                      <span
                                        style={{
                                          color: "var(--text-dim)",
                                          opacity: 0.35,
                                        }}
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
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
