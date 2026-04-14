"use client";
import { useState } from "react";

// Human-readable labels for iRacing category keys
const CAR_CATEGORY_LABELS = {
  sports_car: "Sports Car",
  formula_car: "Formula Car",
  oval: "Oval",
  dirt_oval: "Dirt Oval",
  dirt_road: "Dirt Road",
  other: "Autre",
};

const TRACK_CATEGORY_LABELS = {
  road: "Route",
  oval: "Oval",
  dirt_oval: "Dirt Oval",
  dirt_road: "Dirt Road",
  other: "Autre",
};

// Reusable collapsible row header with count badge
function CollapseHeader({ label, count, expanded, onToggle, indent = 0 }) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: "0.6rem",
        padding: `0.6rem 1rem 0.6rem ${1 + indent * 1.25}rem`,
        background: indent === 0 ? "var(--surface-2)" : "var(--surface)",
        border: "none",
        borderBottom: "1px solid var(--border)",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      {/* Arrow indicator — rotates when expanded */}
      <span
        style={{
          fontSize: "0.6rem",
          color: "var(--text-dim)",
          display: "inline-block",
          transition: "transform 0.15s",
          transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
          flexShrink: 0,
        }}
      >
        ▶
      </span>

      {/* Label */}
      <span
        style={{
          fontWeight: 700,
          fontSize: indent === 0 ? "0.82rem" : "0.78rem",
          color: indent === 0 ? "var(--text)" : "var(--text-dim)",
          textTransform: indent === 0 ? "uppercase" : "none",
          letterSpacing: indent === 0 ? "0.08em" : "normal",
          fontFamily:
            indent === 0 ? "var(--font-rajdhani), sans-serif" : "inherit",
          flex: 1,
        }}
      >
        {label}
      </span>

      {/* Count badge */}
      <span
        className="mono"
        style={{
          fontSize: "0.75rem",
          color: "var(--accent)",
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {count}
      </span>
    </button>
  );
}

// Kronos badge — shown on cars/tracks that exist in the Kronos DB
function KronosBadge() {
  return (
    <span
      style={{
        fontSize: "0.62rem",
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--accent)",
        border: "1px solid var(--accent)",
        borderRadius: "3px",
        padding: "0.1rem 0.35rem",
        flexShrink: 0,
      }}
    >
      Kronos
    </span>
  );
}

export default function InventaireDisplay({
  carData,
  trackData,
  kronosCarNamesArr,
  kronosCircuitNamesArr,
}) {
  // Reconstruct Sets from serialized arrays
  const kronosCarNames = new Set(kronosCarNamesArr);
  const kronosCircuitNames = new Set(kronosCircuitNamesArr);

  // Collapse state — all collapsed by default
  const [expandedCarCats, setExpandedCarCats] = useState(new Set());
  const [expandedCarClasses, setExpandedCarClasses] = useState(new Set());
  const [expandedTrackCats, setExpandedTrackCats] = useState(new Set());
  const [expandedBaseTracks, setExpandedBaseTracks] = useState(new Set());

  // Generic toggle helper for any of the above Sets
  const toggle = (setter, key) =>
    setter((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const totalCars = carData.reduce((sum, cat) => sum + cat.count, 0);
  const totalTracks = trackData.reduce((sum, cat) => sum + cat.count, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
      {/* ── Cars ─────────────────────────────────────────────────────── */}
      {carData.length > 0 && (
        <section>
          <h2 style={{ marginBottom: "0.75rem" }}>
            Voitures
            <span
              style={{
                fontSize: "0.85rem",
                fontWeight: 500,
                color: "var(--text-dim)",
                marginLeft: "0.75rem",
              }}
            >
              {totalCars}
            </span>
          </h2>

          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {carData.map((cat) => {
              const catExpanded = expandedCarCats.has(cat.category);
              return (
                <div key={cat.category}>
                  {/* Category row */}
                  <CollapseHeader
                    label={CAR_CATEGORY_LABELS[cat.category] || cat.category}
                    count={cat.count}
                    expanded={catExpanded}
                    onToggle={() => toggle(setExpandedCarCats, cat.category)}
                    indent={0}
                  />

                  {/* Classes within this category */}
                  {catExpanded &&
                    cat.classes.map((cls) => {
                      const classKey = `${cat.category}|${cls.class}`;
                      const classExpanded = expandedCarClasses.has(classKey);
                      return (
                        <div key={cls.class}>
                          {/* Class row */}
                          <CollapseHeader
                            label={cls.class}
                            count={cls.count}
                            expanded={classExpanded}
                            onToggle={() =>
                              toggle(setExpandedCarClasses, classKey)
                            }
                            indent={1}
                          />

                          {/* Cars within this class */}
                          {classExpanded &&
                            cls.cars.map((car, i) => (
                              <div
                                key={car.iracing_car_id}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: "1rem",
                                  padding: "0.45rem 1rem 0.45rem 3.5rem",
                                  borderBottom:
                                    i < cls.cars.length - 1
                                      ? "1px solid var(--border)"
                                      : "none",
                                }}
                              >
                                <span style={{ fontSize: "0.85rem" }}>
                                  {car.car_name}
                                </span>
                                {kronosCarNames.has(car.car_name) && (
                                  <KronosBadge />
                                )}
                              </div>
                            ))}
                        </div>
                      );
                    })}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Tracks ───────────────────────────────────────────────────── */}
      {trackData.length > 0 && (
        <section>
          <h2 style={{ marginBottom: "0.75rem" }}>
            Circuits
            <span
              style={{
                fontSize: "0.85rem",
                fontWeight: 500,
                color: "var(--text-dim)",
                marginLeft: "0.75rem",
              }}
            >
              {totalTracks}
            </span>
          </h2>

          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {trackData.map((cat) => {
              const catExpanded = expandedTrackCats.has(cat.category);
              return (
                <div key={cat.category}>
                  {/* Category row */}
                  <CollapseHeader
                    label={TRACK_CATEGORY_LABELS[cat.category] || cat.category}
                    count={cat.count}
                    expanded={catExpanded}
                    onToggle={() => toggle(setExpandedTrackCats, cat.category)}
                    indent={0}
                  />

                  {/* Base tracks within this category */}
                  {catExpanded &&
                    cat.tracks.map((baseTrack) => {
                      const trackKey = `${cat.category}|${baseTrack.track_name}`;
                      const trackExpanded = expandedBaseTracks.has(trackKey);
                      const isKronos = kronosCircuitNames.has(
                        baseTrack.track_name,
                      );
                      const hasMultipleConfigs = baseTrack.configs.length > 1;

                      return (
                        <div key={baseTrack.track_name}>
                          {hasMultipleConfigs ? (
                            // Multiple configs — collapsible base track
                            <>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  borderBottom: "1px solid var(--border)",
                                }}
                              >
                                {/* Collapse button takes most of the row */}
                                <button
                                  onClick={() =>
                                    toggle(setExpandedBaseTracks, trackKey)
                                  }
                                  style={{
                                    flex: 1,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.6rem",
                                    padding: "0.5rem 0.5rem 0.5rem 2.25rem",
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    textAlign: "left",
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: "0.6rem",
                                      color: "var(--text-dim)",
                                      display: "inline-block",
                                      transition: "transform 0.15s",
                                      transform: trackExpanded
                                        ? "rotate(90deg)"
                                        : "rotate(0deg)",
                                      flexShrink: 0,
                                    }}
                                  >
                                    ▶
                                  </span>
                                  <span
                                    style={{ fontSize: "0.85rem", flex: 1 }}
                                  >
                                    {baseTrack.track_name}
                                  </span>
                                  <span
                                    className="mono"
                                    style={{
                                      fontSize: "0.72rem",
                                      color: "var(--text-dim)",
                                    }}
                                  >
                                    {baseTrack.count}
                                  </span>
                                </button>
                                {/* Kronos badge outside the button */}
                                {isKronos && (
                                  <div style={{ paddingRight: "1rem" }}>
                                    <KronosBadge />
                                  </div>
                                )}
                              </div>

                              {/* Config list */}
                              {trackExpanded &&
                                baseTrack.configs.map((config, i) => (
                                  <div
                                    key={config || "default"}
                                    style={{
                                      padding: "0.4rem 1rem 0.4rem 3.5rem",
                                      borderBottom:
                                        i < baseTrack.configs.length - 1
                                          ? "1px solid var(--border)"
                                          : "none",
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: "0.82rem",
                                        color: "var(--text-dim)",
                                      }}
                                    >
                                      {config || "Circuit complet"}
                                    </span>
                                  </div>
                                ))}
                            </>
                          ) : (
                            // Single config — flat row, no collapse needed
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: "1rem",
                                padding: "0.5rem 1rem 0.5rem 2.25rem",
                                borderBottom: "1px solid var(--border)",
                              }}
                            >
                              <span style={{ fontSize: "0.85rem" }}>
                                {baseTrack.track_name}
                                {baseTrack.configs[0] && (
                                  <span
                                    style={{
                                      color: "var(--text-dim)",
                                      fontSize: "0.8rem",
                                      marginLeft: "0.4rem",
                                    }}
                                  >
                                    — {baseTrack.configs[0]}
                                  </span>
                                )}
                              </span>
                              {isKronos && <KronosBadge />}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
