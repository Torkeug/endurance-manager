"use client";
import { useState } from "react";

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

// Reusable collapse row — arrow + label + count
function CollapseHeader({
  label,
  count,
  expanded,
  onToggle,
  indent = 0,
  muted = false,
}) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: "0.6rem",
        padding: `0.55rem 1rem 0.55rem ${1 + indent * 1.25}rem`,
        background:
          indent === 0
            ? "var(--surface-2)"
            : indent === 1
              ? "var(--surface)"
              : "transparent",
        border: "none",
        borderBottom: "1px solid var(--border)",
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
          transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
          flexShrink: 0,
        }}
      >
        ▶
      </span>
      <span
        style={{
          fontWeight: indent === 0 ? 700 : 600,
          fontSize: indent === 0 ? "0.82rem" : "0.78rem",
          color: muted
            ? "var(--text-dim)"
            : indent === 0
              ? "var(--text)"
              : "var(--text-dim)",
          textTransform: indent === 0 ? "uppercase" : "none",
          letterSpacing: indent === 0 ? "0.08em" : "normal",
          fontFamily:
            indent === 0 ? "var(--font-rajdhani), sans-serif" : "inherit",
          fontStyle: muted ? "italic" : "normal",
          flex: 1,
        }}
      >
        {label}
      </span>
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

// Renders a single base track row — collapsible with its config list
function BaseTrackRow({ baseTrack, isKronos, expanded, onToggle, isLast }) {
  return (
    <div>
      {/* Base track header — always collapsible */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          borderBottom:
            expanded || !isLast ? "1px solid var(--border)" : "none",
        }}
      >
        <button
          onClick={onToggle}
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
              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
              flexShrink: 0,
            }}
          >
            ▶
          </span>
          <span style={{ fontSize: "0.85rem", flex: 1 }}>
            {baseTrack.track_name}
          </span>
          <span
            className="mono"
            style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}
          >
            {baseTrack.count}
          </span>
        </button>
        {isKronos && (
          <div style={{ paddingRight: "1rem" }}>
            <KronosBadge />
          </div>
        )}
      </div>

      {/* Config list — shown when expanded */}
      {expanded &&
        (baseTrack.configs.length > 0 ? (
          baseTrack.configs.map((config, i) => (
            <div
              key={config}
              style={{
                padding: "0.4rem 1rem 0.4rem 3.75rem",
                borderBottom:
                  i < baseTrack.configs.length - 1
                    ? "1px solid var(--border)"
                    : isLast
                      ? "none"
                      : "1px solid var(--border)",
              }}
            >
              <span style={{ fontSize: "0.82rem", color: "var(--text-dim)" }}>
                {config}
              </span>
            </div>
          ))
        ) : (
          // Track has no named config (e.g. single-layout tracks without a config_name)
          <div
            style={{
              padding: "0.4rem 1rem 0.4rem 3.75rem",
              borderBottom: isLast ? "none" : "1px solid var(--border)",
            }}
          >
            <span style={{ fontSize: "0.82rem", color: "var(--text-dim)" }}>
              Circuit complet
            </span>
          </div>
        ))}
    </div>
  );
}

export default function InventaireDisplay({
  carData,
  trackData,
  kronosCarIdsArr,
  kronosCircuitNamesArr,
}) {
  // iracing_car_id integers — exact match, no string comparison fragility
  const kronosCarIds = new Set(kronosCarIdsArr);
  const kronosCircuitNames = new Set(kronosCircuitNamesArr);

  // All collapsed by default
  const [expandedCarCats, setExpandedCarCats] = useState(new Set());
  const [expandedCarClasses, setExpandedCarClasses] = useState(new Set());
  const [expandedTrackCats, setExpandedTrackCats] = useState(new Set());
  const [expandedBaseTracks, setExpandedBaseTracks] = useState(new Set());
  // One key per category for the legacy sub-group
  const [expandedLegacyGroups, setExpandedLegacyGroups] = useState(new Set());
  // Separate state for legacy car groups (vs legacy track groups)
  const [expandedLegacyCarGroups, setExpandedLegacyCarGroups] = useState(
    new Set(),
  );

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
                  <CollapseHeader
                    label={CAR_CATEGORY_LABELS[cat.category] || cat.category}
                    count={cat.count}
                    expanded={catExpanded}
                    onToggle={() => toggle(setExpandedCarCats, cat.category)}
                    indent={0}
                  />

                  {catExpanded &&
                    cat.classes.map((cls) => {
                      const classKey = `${cat.category}|${cls.class}`;
                      const classExpanded = expandedCarClasses.has(classKey);
                      return (
                        <div key={cls.class}>
                          <CollapseHeader
                            label={cls.class}
                            count={cls.count}
                            expanded={classExpanded}
                            onToggle={() =>
                              toggle(setExpandedCarClasses, classKey)
                            }
                            indent={1}
                          />

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
                                {kronosCarIds.has(car.iracing_car_id) && (
                                  <KronosBadge />
                                )}
                              </div>
                            ))}
                        </div>
                      );
                    })}
                  {/* Legacy & Retired cars — muted sub-group at bottom of category */}
                  {catExpanded && cat.legacyCars && (
                    <div>
                      <CollapseHeader
                        label="Legacy & Retraités"
                        count={cat.legacyCarCount}
                        expanded={expandedLegacyCarGroups.has(cat.category)}
                        onToggle={() =>
                          toggle(setExpandedLegacyCarGroups, cat.category)
                        }
                        indent={1}
                        muted={true}
                      />
                      {expandedLegacyCarGroups.has(cat.category) &&
                        cat.legacyCars.map((car, i) => (
                          <div
                            key={car.iracing_car_id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "1rem",
                              padding: "0.45rem 1rem 0.45rem 3.5rem",
                              opacity: 0.6,
                              borderBottom:
                                i < cat.legacyCars.length - 1
                                  ? "1px solid var(--border)"
                                  : "none",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "0.85rem",
                                fontStyle: "italic",
                              }}
                            >
                              {car.car_name}
                            </span>
                            {kronosCarIds.has(car.iracing_car_id) && (
                              <KronosBadge />
                            )}
                          </div>
                        ))}
                    </div>
                  )}
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
              const legacyKey = `legacy|${cat.category}`;
              const legacyExpanded = expandedLegacyGroups.has(legacyKey);

              // All tracks to render: normal tracks + legacy sub-group at the end
              const allNormalTracks = cat.tracks || [];

              return (
                <div key={cat.category}>
                  {/* Category header */}
                  <CollapseHeader
                    label={TRACK_CATEGORY_LABELS[cat.category] || cat.category}
                    count={cat.count}
                    expanded={catExpanded}
                    onToggle={() => toggle(setExpandedTrackCats, cat.category)}
                    indent={0}
                  />

                  {catExpanded && (
                    <>
                      {/* Normal tracks */}
                      {allNormalTracks.map((baseTrack, idx) => {
                        const trackKey = `${cat.category}|${baseTrack.track_name}`;
                        const isKronos = kronosCircuitNames.has(
                          baseTrack.track_name,
                        );
                        // isLast only if no legacy group follows
                        const isLast =
                          idx === allNormalTracks.length - 1 &&
                          !cat.legacyTracks;
                        return (
                          <BaseTrackRow
                            key={baseTrack.track_name}
                            baseTrack={baseTrack}
                            isKronos={isKronos}
                            expanded={expandedBaseTracks.has(trackKey)}
                            onToggle={() =>
                              toggle(setExpandedBaseTracks, trackKey)
                            }
                            isLast={isLast}
                          />
                        );
                      })}

                      {/* Legacy & Retired sub-group — collapsible, muted style */}
                      {cat.legacyTracks && (
                        <div>
                          <CollapseHeader
                            label="Legacy & Retraités"
                            count={cat.legacyCount}
                            expanded={legacyExpanded}
                            onToggle={() =>
                              toggle(setExpandedLegacyGroups, legacyKey)
                            }
                            indent={1}
                            muted={true}
                          />

                          {legacyExpanded &&
                            cat.legacyTracks.map((baseTrack, idx) => {
                              const trackKey = `legacy_track|${cat.category}|${baseTrack.track_name}`;
                              const isKronos = kronosCircuitNames.has(
                                baseTrack.track_name,
                              );
                              const isLast =
                                idx === cat.legacyTracks.length - 1;
                              return (
                                <BaseTrackRow
                                  key={baseTrack.track_name}
                                  baseTrack={baseTrack}
                                  isKronos={isKronos}
                                  expanded={expandedBaseTracks.has(trackKey)}
                                  onToggle={() =>
                                    toggle(setExpandedBaseTracks, trackKey)
                                  }
                                  isLast={isLast}
                                />
                              );
                            })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
