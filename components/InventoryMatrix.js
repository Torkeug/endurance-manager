"use client";
import { useState, useEffect, useMemo, Fragment } from "react";
import { isLegacyContent } from "../lib/car-types";
import { KBadge, FreeBadge, BadgeLegend } from "./InventoryBadges";
import { supabaseBrowser as supabase } from "../lib/supabase-browser";
import { fetchAllRows } from "../lib/db-utils";

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

// Format driver name as "Prénom N." — first name(s) + surname initial.
function formatDriverName(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const firstName = parts.slice(0, -1).join(" ");
  const lastInitial = parts[parts.length - 1][0].toUpperCase();
  return `${firstName} ${lastInitial}.`;
}

// Adaptive header height for vertical driver names.
// With writing-mode: vertical-rl the cell height must fit the full text width.
// At 0.68rem (~11px), each character is ~7px wide — add 16px padding on top.
function calcHeaderHeight(maxNameLen) {
  return Math.max(100, maxNameLen * 7 + 16);
}

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

// Name column — sticky left, overflow hidden on the td itself.
// Text truncation + badge visibility handled by inner flex div (see nameCell helper).
const nameColStyle = {
  position: "sticky",
  left: 0,
  background: "var(--surface)",
  zIndex: 1,
  padding: "0.35rem 0.75rem",
  // inset shadow instead of borderRight — borderRight gets clipped by scroll container on sticky cells
  boxShadow: "inset -1px 0 0 var(--border)",
  borderBottom: "1px solid var(--border)",
  fontSize: "0.8rem",
  width: `${NAME_COL_WIDTH}px`,
  maxWidth: `${NAME_COL_WIDTH}px`,
  overflow: "hidden",
  boxSizing: "border-box",
};

// Count column — sticky at NAME_COL_WIDTH so it freezes alongside the name column
const countCellStyle = {
  position: "sticky",
  left: `${NAME_COL_WIDTH}px`,
  background: "var(--surface)",
  zIndex: 1,
  padding: "0.25rem 0.4rem",
  textAlign: "center",
  borderBottom: "1px solid var(--border)",
  // inset shadow instead of borderRight — same sticky clipping fix
  boxShadow: "inset -1px 0 0 var(--border)",
  width: `${COUNT_COL_WIDTH}px`,
  boxSizing: "border-box",
  fontSize: "0.72rem",
  fontWeight: 700,
  fontFamily: "var(--font-mono), monospace",
  color: "var(--accent)",
};

// Driver data cell — faint accent tint applied dynamically for current driver column
const cellStyle = {
  padding: "0.25rem 0",
  textAlign: "center",
  borderBottom: "1px solid var(--border)",
  width: `${DRIVER_COL_WIDTH}px`,
  boxSizing: "border-box",
};

// Current driver column highlight — applied on top of cellStyle
const currentDriverCellStyle = {
  ...cellStyle,
  background: "var(--accent-dim)",
};

export default function InventoryMatrix({
  matrixDrivers,
  // Large data (allCars, allTracks, carOwnership, trackOwnership, iracingLabelById,
  // freeCarIds, freeTrackNames) is fetched client-side to avoid Next.js serialization limits
  kronosCarsMap,
  kronosCircuitsByTrackId,
  kronosCircuitNames,
  currentDriverId = null,
  currentDriverHasIracingId = false,
}) {
  const [subTab, setSubTab] = useState("cars");
  const [loaded, setLoaded] = useState(false);

  // Large data fetched client-side — avoids Next.js serialization boundary limits
  const [allCars, setAllCars] = useState([]);
  const [allTracks, setAllTracks] = useState([]);
  const [carOwnership, setCarOwnership] = useState({});
  const [trackOwnership, setTrackOwnership] = useState({});
  const [iracingLabelById, setIracingLabelById] = useState({});
  const [freeCarIdsArr, setFreeCarIdsArr] = useState([]);
  const [freeTrackNamesArr, setFreeTrackNamesArr] = useState([]);
  const [fetchError, setFetchError] = useState(null);

  // Filter state — starts empty, populated from localStorage in useEffect
  const [selectedCarCats, setSelectedCarCats] = useState([]);
  const [selectedCarClasses, setSelectedCarClasses] = useState([]);
  const [selectedTrackCats, setSelectedTrackCats] = useState([]);

  // Sort state per matrix: { col: "name"|"count", dir: "asc"|"desc" }
  const [carSort, setCarSort] = useState({ col: "name", dir: "asc" });
  const [trackSort, setTrackSort] = useState({ col: "name", dir: "asc" });

  // ── Client-side data fetch ─────────────────────────────────────────────────
  // Large ownership/catalog data fetched here to avoid Next.js serialization limits.
  // Runs once on mount — matrixDrivers is small and safe to pass as a prop.
  useEffect(() => {
    const driverIds = matrixDrivers.map((d) => d.id);

    const load = async () => {
      try {
        // Paginated ownership queries — single fetch for catalog (small enough)
        const [
          carOwnershipRows,
          trackOwnershipRows,
          iracingCarsRes,
          iracingTracksFreeRes,
        ] = await Promise.all([
          // Car ownership — paginated to handle large teams
          fetchAllRows((from, to) =>
            supabase
              .from("driver_car_ownership")
              .select(
                "driver_id, iracing_car_id, car_name, car_category, car_types",
              )
              .in("driver_id", driverIds.length > 0 ? driverIds : ["none"])
              .range(from, to),
          ),
          // Track ownership — paginated, most likely to exceed 1000 rows
          fetchAllRows((from, to) =>
            supabase
              .from("driver_track_ownership")
              .select("driver_id, track_name, track_category")
              .in("driver_id", driverIds.length > 0 ? driverIds : ["none"])
              .range(from, to),
          ),
          // iRacing catalog — for class labels + free_with_subscription badge
          supabase
            .from("iracing_cars")
            .select(
              "iracing_car_id, car_name, car_types, car_type_label, free_with_subscription",
            )
            .order("car_name"),
          // Free tracks — minimal payload
          supabase
            .from("iracing_tracks")
            .select("track_name, free_with_subscription")
            .eq("free_with_subscription", true),
        ]);

        if (iracingCarsRes.error) throw iracingCarsRes.error;

        // ── Build allCars — unique cars from ownership data ──────────────────
        const carMap = new Map();
        for (const row of carOwnershipRows || []) {
          if (!carMap.has(row.iracing_car_id)) {
            carMap.set(row.iracing_car_id, {
              iracing_car_id: row.iracing_car_id,
              car_name: row.car_name,
              car_category: row.car_category,
              car_types: row.car_types,
              isLegacy: isLegacyContent(row.car_name),
            });
          }
        }
        setAllCars(
          [...carMap.values()].sort((a, b) =>
            a.car_name.localeCompare(b.car_name),
          ),
        );

        // ── Build allTracks — unique tracks from ownership data ──────────────
        const trackMap = new Map();
        for (const row of trackOwnershipRows || []) {
          if (!trackMap.has(row.track_name)) {
            trackMap.set(row.track_name, {
              track_name: row.track_name,
              track_category: row.track_category,
              isLegacy: isLegacyContent(row.track_name),
            });
          }
        }
        setAllTracks(
          [...trackMap.values()].sort((a, b) =>
            a.track_name.localeCompare(b.track_name),
          ),
        );

        // ── Car ownership map: driver_id → iracing_car_id[] ─────────────────
        const carOwnershipMap = {};
        for (const row of carOwnershipRows || []) {
          if (!carOwnershipMap[row.driver_id])
            carOwnershipMap[row.driver_id] = [];
          carOwnershipMap[row.driver_id].push(row.iracing_car_id);
        }
        setCarOwnership(carOwnershipMap);

        // ── Track ownership map: driver_id → track_name[] ───────────────────
        const trackOwnershipMap = {};
        for (const row of trackOwnershipRows || []) {
          if (!trackOwnershipMap[row.driver_id])
            trackOwnershipMap[row.driver_id] = [];
          if (!trackOwnershipMap[row.driver_id].includes(row.track_name)) {
            trackOwnershipMap[row.driver_id].push(row.track_name);
          }
        }
        setTrackOwnership(trackOwnershipMap);

        // ── iRacing catalog label map ────────────────────────────────────────
        const labelMap = {};
        for (const car of iracingCarsRes.data || []) {
          if (car.car_type_label)
            labelMap[car.iracing_car_id] = car.car_type_label;
        }
        setIracingLabelById(labelMap);

        // ── Free content arrays ──────────────────────────────────────────────
        setFreeCarIdsArr(
          (iracingCarsRes.data || [])
            .filter((c) => c.free_with_subscription)
            .map((c) => c.iracing_car_id),
        );
        setFreeTrackNamesArr(
          (iracingTracksFreeRes.data || []).map((t) => t.track_name),
        );
      } catch (err) {
        console.error("InventoryMatrix fetch error:", err);
        setFetchError("Erreur lors du chargement des données d'inventaire.");
      }
    };

    if (driverIds.length > 0) {
      load();
    }
    // matrixDrivers identity is stable — JSON.stringify used to avoid re-fetch on re-render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(matrixDrivers.map((d) => d.id))]);

  // Adaptive header height — based on the longest formatted driver name
  const hHeight = useMemo(() => {
    const maxLen = matrixDrivers.reduce(
      (max, d) => Math.max(max, formatDriverName(d.name).length),
      0,
    );
    return calcHeaderHeight(maxLen);
  }, [matrixDrivers]);

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

  // O(1) lookup sets built from serialized prop arrays
  const freeCarIdSet = useMemo(() => new Set(freeCarIdsArr), [freeCarIdsArr]);
  const freeTrackNameSet = useMemo(
    () => new Set(freeTrackNamesArr),
    [freeTrackNamesArr],
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

      const savedCarSort = localStorage.getItem("kronos_inv_car_sort");
      if (savedCarSort) setCarSort(JSON.parse(savedCarSort));

      const savedTrackSort = localStorage.getItem("kronos_inv_track_sort");
      if (savedTrackSort) setTrackSort(JSON.parse(savedTrackSort));
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

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem("kronos_inv_car_sort", JSON.stringify(carSort));
    } catch {}
  }, [carSort, loaded]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem("kronos_inv_track_sort", JSON.stringify(trackSort));
    } catch {}
  }, [trackSort, loaded]);

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

  // Sort a list of items by name or owner count
  const sortItems = (items, sort, ownershipSets, getId, getName) => {
    return items.slice().sort((a, b) => {
      if (sort.col === "count") {
        const aCount = matrixDrivers.filter((d) =>
          ownershipSets[d.id]?.has(getId(a)),
        ).length;
        const bCount = matrixDrivers.filter((d) =>
          ownershipSets[d.id]?.has(getId(b)),
        ).length;
        const diff = sort.dir === "asc" ? aCount - bCount : bCount - aCount;
        return diff !== 0 ? diff : getName(a).localeCompare(getName(b));
      }
      const diff = getName(a).localeCompare(getName(b));
      return sort.dir === "asc" ? diff : -diff;
    });
  };

  // Toggle sort — same col flips direction, new col defaults to desc for count, asc for name
  const toggleSort = (current, col, setter) => {
    if (current.col === col) {
      setter({ col, dir: current.dir === "asc" ? "desc" : "asc" });
    } else {
      setter({ col, dir: col === "count" ? "desc" : "asc" });
    }
  };

  // Sort indicator arrow
  const sortArrow = (sort, col) =>
    sort.col === col ? (sort.dir === "asc" ? " ↑" : " ↓") : "";

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
      if (!catMap[cat]) catMap[cat] = { normal: {}, legacy: {} };
      if (legacy) {
        // Group legacy cars by class — same grouping as normal cars
        if (!catMap[cat].legacy[cls]) catMap[cat].legacy[cls] = [];
        catMap[cat].legacy[cls].push(car);
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
            cars: sortItems(
              cars,
              carSort,
              carOwnershipSets,
              (c) => c.iracing_car_id,
              (c) => c.car_name,
            ),
          })),
        // Legacy cars grouped by class, each class sorted independently
        legacy: Object.entries(legacy)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([cls, cars]) => ({
            cls,
            cars: sortItems(
              cars,
              carSort,
              carOwnershipSets,
              (c) => c.iracing_car_id,
              (c) => c.car_name,
            ),
          })),
      }));
  }, [
    allCars,
    selectedCarCats,
    selectedCarClasses,
    kronosCarsMap,
    iracingLabelById,
    carSort,
    matrixDrivers,
    carOwnershipSets,
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
        tracks: sortItems(
          normal,
          trackSort,
          trackOwnershipSets,
          (t) => t.track_name,
          (t) => t.track_name,
        ),
        legacy: sortItems(
          legacy,
          trackSort,
          trackOwnershipSets,
          (t) => t.track_name,
          (t) => t.track_name,
        ),
      }));
  }, [
    allTracks,
    selectedTrackCats,
    trackSort,
    matrixDrivers,
    trackOwnershipSets,
    loaded,
  ]);

  // Show loading until both localStorage filters are initialized AND data is fetched
  if (
    !loaded ||
    (allCars.length === 0 && allTracks.length === 0 && !fetchError)
  ) {
    return <div className="empty">Chargement...</div>;
  }

  if (fetchError) {
    return <div className="alert alert-error">{fetchError}</div>;
  }

  // Group header td — sticky left so category/class labels stay visible on horizontal scroll.
  // count td beside it must also be sticky at NAME_COL_WIDTH (rendered inline in JSX).
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

  // Sticky count cell for group rows — same left offset as data count cells
  const groupCountTdStyle = (indent = 0, muted = false) => ({
    position: "sticky",
    left: `${NAME_COL_WIDTH}px`,
    padding: "0.4rem 0.4rem",
    background: indent === 0 ? "var(--surface-2)" : "var(--surface)",
    borderBottom: "1px solid var(--border)",
    boxShadow: "inset -1px 0 0 var(--border)",
    opacity: muted ? 0.7 : 1,
  });

  // Shared vertical driver name <th> — used in both cars and tracks matrices.
  // Adaptive height based on the longest name so no text gets clipped.
  // Driver name header — sticky top only; accent tint for current driver
  const driverTh = (d) => (
    <th
      key={d.id}
      style={{
        position: "sticky",
        top: 0,
        background:
          d.id === currentDriverId ? "var(--accent-dim)" : "var(--surface-2)",
        borderBottom: "2px solid var(--border)",
        verticalAlign: "bottom",
        width: `${DRIVER_COL_WIDTH}px`,
        boxSizing: "border-box",
        overflow: "hidden",
        padding: 0,
        zIndex: 2,
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
  );

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
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "0.4rem",
              }}
            >
              <span
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  color: "var(--text-dim)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Classe
              </span>
              {/* Quick-select buttons — Tout selects all visible classes, Aucune clears */}
              <button
                onClick={() => setSelectedCarClasses(allCarClasses)}
                className="btn btn-secondary"
                style={{ fontSize: "0.65rem", padding: "0.1rem 0.4rem" }}
              >
                Tout
              </button>
              <button
                onClick={() => setSelectedCarClasses([])}
                className="btn btn-secondary"
                style={{ fontSize: "0.65rem", padding: "0.1rem 0.4rem" }}
              >
                Aucune
              </button>
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

          {/* Legend sits between filters and table */}
          <BadgeLegend />

          {carMatrixRows.length === 0 && (
            <div className="card">
              <div className="empty">
                Aucune voiture correspondant aux filtres sélectionnés.
              </div>
            </div>
          )}

          {carMatrixRows.length > 0 && (
            <div
              style={{
                overflowX: "auto",
                overflowY: "auto",
                maxHeight: "70vh",
              }}
            >
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
                {/* thead sticky top — keeps headers visible during vertical scroll */}
                <thead>
                  <tr>
                    {/* Name header — sticky top+left corner, zIndex 3 to sit above both axes */}
                    <th
                      onClick={() => toggleSort(carSort, "name", setCarSort)}
                      style={{
                        ...nameColStyle,
                        position: "sticky",
                        top: 0,
                        left: 0,
                        background: "var(--surface-2)",
                        fontWeight: 700,
                        fontSize: "0.7rem",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color:
                          carSort.col === "name"
                            ? "var(--accent)"
                            : "var(--text-dim)",
                        zIndex: 3,
                        borderBottom: "2px solid var(--border)",
                        cursor: "pointer",
                        userSelect: "none",
                        verticalAlign: "bottom",
                      }}
                    >
                      Voiture{sortArrow(carSort, "name")}
                    </th>
                    {/* Count header — sticky top+left, inset shadow for right border */}
                    <th
                      onClick={() => toggleSort(carSort, "count", setCarSort)}
                      style={{
                        position: "sticky",
                        top: 0,
                        left: `${NAME_COL_WIDTH}px`,
                        background: "var(--surface-2)",
                        borderBottom: "2px solid var(--border)",
                        boxShadow: "inset -1px 0 0 var(--border)",
                        width: `${COUNT_COL_WIDTH}px`,
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        color:
                          carSort.col === "count"
                            ? "var(--accent)"
                            : "var(--text-dim)",
                        textAlign: "center",
                        verticalAlign: "bottom",
                        padding: "0.25rem",
                        cursor: "pointer",
                        userSelect: "none",
                        zIndex: 3,
                      }}
                    >
                      #{sortArrow(carSort, "count")}
                    </th>
                    {matrixDrivers.map(driverTh)}
                  </tr>
                </thead>
                <tbody>
                  {carMatrixRows.map(({ category, classes, legacy }) => (
                    <Fragment key={category}>
                      <tr>
                        {/* Name cell sticky left, count cell sticky at NAME_COL_WIDTH */}
                        <td style={groupTdStyle(0)}>
                          {CAR_CATEGORY_LABELS[category] || category}
                        </td>
                        <td style={groupCountTdStyle(0)} />
                        {matrixDrivers.map((d) => (
                          <td
                            key={d.id}
                            style={{
                              borderBottom: "1px solid var(--border)",
                              background: "var(--surface-2)",
                            }}
                          />
                        ))}
                      </tr>
                      {classes.map(({ cls, cars }) => (
                        <Fragment key={`${category}|${cls}`}>
                          <tr>
                            <td style={groupTdStyle(1)}>{cls}</td>
                            <td style={groupCountTdStyle(1)} />
                            {matrixDrivers.map((d) => (
                              <td
                                key={d.id}
                                style={{
                                  borderBottom: "1px solid var(--border)",
                                  background: "var(--surface)",
                                }}
                              />
                            ))}
                          </tr>
                          {cars.map((car) => {
                            const ownerCount = matrixDrivers.filter((d) =>
                              carOwnershipSets[d.id]?.has(car.iracing_car_id),
                            ).length;
                            return (
                              <tr key={car.iracing_car_id}>
                                <td style={nameColStyle}>
                                  {/* Flex wrapper: name truncates, badges always visible */}
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      minWidth: 0,
                                    }}
                                  >
                                    <span
                                      title={car.car_name}
                                      style={{
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        minWidth: 0,
                                      }}
                                    >
                                      {car.car_name}
                                    </span>
                                    {!!(kronosCarsMap || {})[
                                      car.iracing_car_id
                                    ] && <KBadge />}
                                    {freeCarIdSet.has(car.iracing_car_id) && (
                                      <FreeBadge />
                                    )}
                                  </div>
                                </td>
                                <td style={countCellStyle}>
                                  {ownerCount}/{matrixDrivers.length}
                                </td>
                                {matrixDrivers.map((d) => (
                                  <td
                                    key={d.id}
                                    style={
                                      d.id === currentDriverId
                                        ? currentDriverCellStyle
                                        : cellStyle
                                    }
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
                      ))}
                      {/* Legacy & Retired cars grouped by class */}
                      {legacy.map(({ cls: legacyCls, cars: legacyCars }) => (
                        <Fragment key={`${category}|legacy|${legacyCls}`}>
                          <tr>
                            <td style={groupTdStyle(1, true)}>
                              {legacyCls} — Legacy & Retraités (
                              {legacyCars.length})
                            </td>
                            <td style={groupCountTdStyle(1, true)} />
                            {matrixDrivers.map((d) => (
                              <td
                                key={d.id}
                                style={{
                                  borderBottom: "1px solid var(--border)",
                                  background: "var(--surface)",
                                  opacity: 0.7,
                                }}
                              />
                            ))}
                          </tr>
                          {legacyCars.map((car) => {
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
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      minWidth: 0,
                                    }}
                                  >
                                    <span
                                      title={car.car_name}
                                      style={{
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        minWidth: 0,
                                      }}
                                    >
                                      {car.car_name}
                                    </span>
                                    {!!(kronosCarsMap || {})[
                                      car.iracing_car_id
                                    ] && <KBadge />}
                                    {freeCarIdSet.has(car.iracing_car_id) && (
                                      <FreeBadge />
                                    )}
                                  </div>
                                </td>
                                <td
                                  style={{ ...countCellStyle, opacity: 0.55 }}
                                >
                                  {ownerCount}/{matrixDrivers.length}
                                </td>
                                {matrixDrivers.map((d) => (
                                  <td
                                    key={d.id}
                                    style={{
                                      ...(d.id === currentDriverId
                                        ? currentDriverCellStyle
                                        : cellStyle),
                                      opacity: 0.55,
                                    }}
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
                      ))}
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

          {/* Legend sits between filters and table */}
          <BadgeLegend />

          {trackMatrixRows.length === 0 && (
            <div className="card">
              <div className="empty">
                Aucun circuit correspondant aux filtres sélectionnés.
              </div>
            </div>
          )}

          {trackMatrixRows.length > 0 && (
            <div
              style={{
                overflowX: "auto",
                overflowY: "auto",
                maxHeight: "70vh",
              }}
            >
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
                    {/* Circuit header — sticky top+left corner */}
                    <th
                      onClick={() =>
                        toggleSort(trackSort, "name", setTrackSort)
                      }
                      style={{
                        ...nameColStyle,
                        position: "sticky",
                        top: 0,
                        left: 0,
                        background: "var(--surface-2)",
                        fontWeight: 700,
                        fontSize: "0.7rem",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color:
                          trackSort.col === "name"
                            ? "var(--accent)"
                            : "var(--text-dim)",
                        zIndex: 3,
                        borderBottom: "2px solid var(--border)",
                        cursor: "pointer",
                        userSelect: "none",
                        verticalAlign: "bottom",
                      }}
                    >
                      Circuit{sortArrow(trackSort, "name")}
                    </th>
                    {/* Count header — sticky top+left, inset shadow for right border */}
                    <th
                      onClick={() =>
                        toggleSort(trackSort, "count", setTrackSort)
                      }
                      style={{
                        position: "sticky",
                        top: 0,
                        left: `${NAME_COL_WIDTH}px`,
                        background: "var(--surface-2)",
                        borderBottom: "2px solid var(--border)",
                        boxShadow: "inset -1px 0 0 var(--border)",
                        width: `${COUNT_COL_WIDTH}px`,
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        color:
                          trackSort.col === "count"
                            ? "var(--accent)"
                            : "var(--text-dim)",
                        textAlign: "center",
                        verticalAlign: "bottom",
                        padding: "0.25rem",
                        cursor: "pointer",
                        userSelect: "none",
                        zIndex: 3,
                      }}
                    >
                      #{sortArrow(trackSort, "count")}
                    </th>
                    {matrixDrivers.map(driverTh)}
                  </tr>
                </thead>
                <tbody>
                  {trackMatrixRows.map(({ category, tracks, legacy }) => (
                    <Fragment key={category}>
                      <tr>
                        <td style={groupTdStyle(0)}>
                          {TRACK_CATEGORY_LABELS[category] || category}
                        </td>
                        <td style={groupCountTdStyle(0)} />
                        {matrixDrivers.map((d) => (
                          <td
                            key={d.id}
                            style={{
                              borderBottom: "1px solid var(--border)",
                              background: "var(--surface-2)",
                            }}
                          />
                        ))}
                      </tr>
                      {tracks.map((track) => {
                        const ownerCount = matrixDrivers.filter((d) =>
                          trackOwnershipSets[d.id]?.has(track.track_name),
                        ).length;
                        return (
                          <tr key={track.track_name}>
                            <td style={nameColStyle}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  minWidth: 0,
                                }}
                              >
                                <span
                                  title={track.track_name}
                                  style={{
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    minWidth: 0,
                                  }}
                                >
                                  {track.track_name}
                                </span>
                                {isKronosTrack(track) && <KBadge />}
                                {freeTrackNameSet.has(track.track_name) && (
                                  <FreeBadge />
                                )}
                              </div>
                            </td>
                            <td style={countCellStyle}>
                              {ownerCount}/{matrixDrivers.length}
                            </td>
                            {matrixDrivers.map((d) => (
                              <td
                                key={d.id}
                                style={
                                  d.id === currentDriverId
                                    ? currentDriverCellStyle
                                    : cellStyle
                                }
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
                      {legacy.length > 0 && (
                        <Fragment key={`${category}|legacy`}>
                          <tr>
                            <td style={groupTdStyle(1, true)}>
                              Legacy & Retraités ({legacy.length})
                            </td>
                            <td style={groupCountTdStyle(1, true)} />
                            {matrixDrivers.map((d) => (
                              <td
                                key={d.id}
                                style={{
                                  borderBottom: "1px solid var(--border)",
                                  background: "var(--surface)",
                                  opacity: 0.7,
                                }}
                              />
                            ))}
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
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      minWidth: 0,
                                    }}
                                  >
                                    <span
                                      title={track.track_name}
                                      style={{
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        minWidth: 0,
                                      }}
                                    >
                                      {track.track_name}
                                    </span>
                                    {isKronosTrack(track) && <KBadge />}
                                    {freeTrackNameSet.has(track.track_name) && (
                                      <FreeBadge />
                                    )}
                                  </div>
                                </td>
                                <td
                                  style={{ ...countCellStyle, opacity: 0.55 }}
                                >
                                  {ownerCount}/{matrixDrivers.length}
                                </td>
                                {matrixDrivers.map((d) => (
                                  <td
                                    key={d.id}
                                    style={{
                                      ...(d.id === currentDriverId
                                        ? currentDriverCellStyle
                                        : cellStyle),
                                      opacity: 0.55,
                                    }}
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
