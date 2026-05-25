"use client";
import React, { useEffect, useState } from "react";

const SESSION_LABELS = { 1: "P", 2: "Q", 3: "R" };

const CATEGORY_LABELS = {
  road:      "Road",
  oval:      "Oval",
  dirt_oval: "Dirt Oval",
  dirt_road: "Dirt Road",
};
const CATEGORY_ORDER = ["road", "oval", "dirt_road", "dirt_oval"];

const SORT_OPTIONS = [
  { key: "laps",    label: "Tours",       fn: (a, b) => b.totalLaps - a.totalLaps },
  { key: "clean",   label: "% Propres",   fn: (a, b) => b.cleanPct - a.cleanPct },
  { key: "time",    label: "Temps piste", fn: (a, b) => b.timeOnTrack - a.timeOnTrack },
  { key: "name",    label: "Circuit",     fn: (a, b) => a.name.localeCompare(b.name) },
];

function formatTime(seconds) {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}`;
  return `${m}min`;
}

function formatLapTime(seconds) {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(3);
  return `${m}:${String(s).padStart(6, "0")}`;
}

export default function Garage61StatsTab({ slug }) {
  const [state, setState] = useState("idle");
  const [circuits, setCircuits] = useState([]);
  const [error, setError] = useState(null);
  const [sortKey, setSortKey] = useState("laps");
  const [sessionFilter, setSessionFilter] = useState(null); // null = all
  const [selectedCats, setSelectedCats] = useState([]); // populated when data loads
  const [expandedTrack, setExpandedTrack] = useState(null);
  const [lapCache, setLapCache] = useState({}); // trackId → { status, lap }

  // Restore sort from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("kronos_g61_sort");
      if (saved && SORT_OPTIONS.some((o) => o.key === saved)) setSortKey(saved);
    } catch {}
  }, []);

  // Persist sort
  useEffect(() => {
    try { localStorage.setItem("kronos_g61_sort", sortKey); } catch {}
  }, [sortKey]);

  // Persist category filter (only after data is loaded)
  useEffect(() => {
    if (state !== "done") return;
    try { localStorage.setItem("kronos_g61_cats", JSON.stringify(selectedCats)); } catch {}
  }, [selectedCats, state]);

  useEffect(() => {
    if (!slug) return;
    setState("loading");
    fetch(`/api/garage61-practice?driver_slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error === "not_linked") {
          setState("not_linked");
        } else if (data.error) {
          setError(data.error);
          setState("error");
        } else {
          const loaded = data.circuits || [];
          setCircuits(loaded);
          const presentCats = CATEGORY_ORDER.filter((cat) => loaded.some((c) => c.category === cat));
          try {
            const saved = JSON.parse(localStorage.getItem("kronos_g61_cats") || "null");
            const restored = Array.isArray(saved) ? presentCats.filter((c) => saved.includes(c)) : null;
            setSelectedCats(restored?.length > 0 ? restored : presentCats);
          } catch {
            setSelectedCats(presentCats);
          }
          setState("done");
        }
      })
      .catch(() => { setError("network_error"); setState("error"); });
  }, [slug]);

  if (state === "idle" || state === "loading") {
    return (
      <div style={{ color: "var(--text-dim)", fontSize: "0.85rem", padding: "1rem 0" }}>
        Chargement des données Garage61…
      </div>
    );
  }

  if (state === "not_linked") {
    return (
      <div className="card" style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>
        Aucun compte Garage61 lié à votre profil. Liez votre compte pour voir les statistiques de préparation.
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="card" style={{ color: "var(--danger)", fontSize: "0.85rem" }}>
        Impossible de charger les données Garage61 ({error}).
      </div>
    );
  }

  if (circuits.length === 0) {
    return (
      <div className="card">
        <div className="empty">Aucune donnée de préparation disponible pour ce pilote sur Garage61.</div>
      </div>
    );
  }

  // Collect all session types present across all circuits for the filter pills
  const allSessionTypes = [...new Set(circuits.flatMap((c) => c.sessionTypes))].sort();
  const hasCategories = circuits.some((c) => c.category);

  const sortFn = SORT_OPTIONS.find((o) => o.key === sortKey)?.fn ?? SORT_OPTIONS[0].fn;
  const filtered = circuits
    .filter((c) => sessionFilter === null || c.sessionTypes.includes(sessionFilter))
    .filter((c) => !hasCategories || selectedCats.length === 0 || selectedCats.includes(c.category))
    .sort(sortFn);

  // Always group by category when categories are present
  const groups = hasCategories
    ? CATEGORY_ORDER
        .filter((cat) => selectedCats.includes(cat))
        .map((cat) => ({
          label: CATEGORY_LABELS[cat] ?? cat,
          rows: filtered.filter((c) => c.category === cat),
        }))
        .filter((g) => g.rows.length > 0)
    : [{ label: null, rows: filtered }];

  // Rounded pill — used for sort and session type
  const pillStyle = (active) => ({
    padding: "0.2rem 0.6rem",
    borderRadius: "999px",
    border: "1px solid",
    borderColor: active ? "var(--accent)" : "var(--border)",
    background: active ? "var(--accent-dim)" : "transparent",
    color: active ? "var(--accent)" : "var(--text-dim)",
    fontSize: "0.75rem",
    fontWeight: 600,
    cursor: "pointer",
  });

  // Matrix-style pill — used for category filter (matches InventoryMatrix)
  const catPillStyle = (active) => ({
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
  });

  const TH = {
    background: "var(--surface-2)",
    color: "var(--text-dim)",
    fontSize: "0.65rem",
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    padding: "0.5rem 0.75rem",
    borderBottom: "2px solid var(--border)",
    whiteSpace: "nowrap",
    textAlign: "left",
    cursor: "pointer",
    userSelect: "none",
  };
  const TD = {
    padding: "0.4rem 0.75rem",
    borderBottom: "1px solid var(--border)",
    fontSize: "0.82rem",
    verticalAlign: "middle",
  };

  function handleRowClick(trackId) {
    setExpandedTrack((prev) => (prev === trackId ? null : trackId));
    if (!lapCache[trackId]) {
      setLapCache((prev) => ({ ...prev, [trackId]: { status: "loading", lap: null } }));
      fetch(`/api/garage61-laps?driver_slug=${encodeURIComponent(slug)}&track_id=${trackId}`)
        .then((r) => r.json())
        .then((data) => setLapCache((prev) => ({ ...prev, [trackId]: { status: "done", lap: data.lap ?? null } })))
        .catch(() => setLapCache((prev) => ({ ...prev, [trackId]: { status: "error", lap: null } })));
    }
  }

  const thSort = (key, align = "left") => ({
    ...TH,
    textAlign: align,
    color: sortKey === key ? "var(--accent)" : "var(--text-dim)",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* Controls row */}
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        {/* Sort */}
        <div style={{ display: "flex", gap: "0.35rem", alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.7rem", color: "var(--text-dim)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Tri</span>
          {SORT_OPTIONS.map((o) => (
            <button key={o.key} style={pillStyle(sortKey === o.key)} onClick={() => setSortKey(o.key)}>
              {o.label}
            </button>
          ))}
        </div>

        {/* Session type filter — only if multiple types present */}
        {allSessionTypes.length > 1 && (
          <div style={{ display: "flex", gap: "0.35rem", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.7rem", color: "var(--text-dim)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Session</span>
            <button style={pillStyle(sessionFilter === null)} onClick={() => setSessionFilter(null)}>Tous</button>
            {allSessionTypes.map((s) => (
              <button key={s} style={pillStyle(sessionFilter === s)} onClick={() => setSessionFilter(sessionFilter === s ? null : s)}>
                {SESSION_LABELS[s] ?? s}
              </button>
            ))}
          </div>
        )}

        {/* Category filter — multi-select, all active by default */}
        {hasCategories && (
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: "0.7rem", color: "var(--text-dim)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Catégorie</span>
            {CATEGORY_ORDER
              .filter((cat) => circuits.some((c) => c.category === cat))
              .map((cat) => (
                <button
                  key={cat}
                  style={catPillStyle(selectedCats.includes(cat))}
                  onClick={() => setSelectedCats(
                    selectedCats.includes(cat)
                      ? selectedCats.filter((c) => c !== cat)
                      : [...selectedCats, cat]
                  )}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
          </div>
        )}
      </div>

      {/* Table */}
      <div style={{ border: "1px solid var(--border)", borderRadius: "4px", overflow: "hidden", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "420px" }}>
          <thead>
            <tr>
              <th style={thSort("name")} onClick={() => setSortKey("name")}>Circuit</th>
              <th style={{ ...thSort("laps", "right") }} onClick={() => setSortKey("laps")}>Tours</th>
              <th style={{ ...thSort("clean", "right") }} onClick={() => setSortKey("clean")}>Propres</th>
              <th style={{ ...thSort("time", "right") }} onClick={() => setSortKey("time")}>Temps piste</th>
              <th style={TH}>Sessions</th>
              <th style={TH}></th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <React.Fragment key={group.label ?? "all"}>
                {group.label && (
                  <tr>
                    <td colSpan={6} style={{ padding: "0.4rem 0.75rem", background: "var(--surface-2)", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-dim)", borderBottom: "1px solid var(--border)" }}>
                      {group.label}
                    </td>
                  </tr>
                )}
                {group.rows.map((c, i) => (
                  <React.Fragment key={c.trackId}>
                    <tr
                      onClick={() => handleRowClick(c.trackId)}
                      style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)", cursor: "pointer" }}
                    >
                      <td style={{ ...TD, fontWeight: 600 }}>
                        <span style={{ display: "inline-block", fontSize: "0.6rem", color: "var(--text-dim)", marginRight: "0.4rem", transition: "transform 0.15s", transform: expandedTrack === c.trackId ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
                        {c.name}
                        {c.variant && (
                          <span style={{ fontWeight: 400, color: "var(--text-dim)", marginLeft: "0.4rem", fontSize: "0.78rem" }}>
                            {c.variant}
                          </span>
                        )}
                      </td>
                      <td style={{ ...TD, textAlign: "right", fontFamily: "var(--font-mono), monospace" }}>
                        {c.totalLaps}
                      </td>
                      <td style={{ ...TD, textAlign: "right", fontFamily: "var(--font-mono), monospace", color: c.cleanPct >= 70 ? "#2eb460" : c.cleanPct >= 40 ? "var(--text)" : "var(--danger)" }}>
                        {c.cleanPct}%
                        <span style={{ color: "var(--text-dim)", fontSize: "0.72rem", marginLeft: "0.3rem" }}>({c.cleanLaps})</span>
                      </td>
                      <td style={{ ...TD, textAlign: "right", fontFamily: "var(--font-mono), monospace", color: "var(--text-dim)" }}>
                        {formatTime(c.timeOnTrack)}
                      </td>
                      <td style={TD}>
                        <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                          {c.sessionTypes.map((s) => (
                            <span key={s} style={{ padding: "0.1rem 0.35rem", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "3px", fontSize: "0.68rem", fontWeight: 700, color: s === 3 ? "var(--accent)" : "var(--text-dim)" }}>
                              {SESSION_LABELS[s] ?? s}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ ...TD, textAlign: "right" }}>
                        <a href={`https://garage61.net/app/laps/${c.trackId}/0;g=2;d=1`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" style={{ fontSize: "0.72rem", whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                          ↗ Garage61
                        </a>
                      </td>
                    </tr>
                    {expandedTrack === c.trackId && (
                      <tr>
                        <td colSpan={6} style={{ padding: "0.5rem 1.5rem 0.6rem", background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                          {lapCache[c.trackId]?.status === "loading" && (
                            <span style={{ color: "var(--text-dim)", fontSize: "0.78rem" }}>Chargement…</span>
                          )}
                          {lapCache[c.trackId]?.status === "error" && (
                            <span style={{ color: "var(--danger)", fontSize: "0.78rem" }}>Erreur de chargement</span>
                          )}
                          {lapCache[c.trackId]?.status === "done" && !lapCache[c.trackId].lap && (
                            <span style={{ color: "var(--text-dim)", fontSize: "0.78rem" }}>Aucun tour enregistré sur Garage61</span>
                          )}
                          {lapCache[c.trackId]?.status === "done" && lapCache[c.trackId].lap && (() => {
                            const { lapTime, car, sessionType, clean, wet, date } = lapCache[c.trackId].lap;
                            return (
                              <div style={{ display: "flex", gap: "1.25rem", alignItems: "center", flexWrap: "wrap" }}>
                                <div>
                                  <span style={{ fontSize: "0.65rem", color: "var(--text-dim)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginRight: "0.5rem" }}>Meilleur tour</span>
                                  <span style={{ fontFamily: "var(--font-mono), monospace", fontWeight: 700, fontSize: "0.95rem", color: "var(--accent)" }}>{formatLapTime(lapTime)}</span>
                                </div>
                                {car && <span style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>{car}</span>}
                                <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
                                  {sessionType && (
                                    <span style={{ padding: "0.1rem 0.35rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "3px", fontSize: "0.68rem", fontWeight: 700, color: sessionType === 3 ? "var(--accent)" : "var(--text-dim)" }}>
                                      {SESSION_LABELS[sessionType] ?? sessionType}
                                    </span>
                                  )}
                                  {wet && <span style={{ fontSize: "0.72rem", color: "#4a9fd4" }}>💧</span>}
                                  {clean && <span style={{ fontSize: "0.72rem", color: "#2eb460" }}>✓ propre</span>}
                                </div>
                                {date && <span style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>{new Date(date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" })}</span>}
                                <a href={`https://garage61.net/app/laps/${c.trackId}/0;g=2;d=1`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" style={{ fontSize: "0.72rem", whiteSpace: "nowrap", marginLeft: "auto" }}>
                                  ↗ Voir sur Garage61
                                </a>
                              </div>
                            );
                          })()}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
        Données agrégées depuis Garage61 · {filtered.reduce((s, c) => s + c.totalLaps, 0)}{sessionFilter !== null ? ` / ${circuits.reduce((s, c) => s + c.totalLaps, 0)}` : ""} tours au total
      </div>
    </div>
  );
}
