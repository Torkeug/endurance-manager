"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";

const CREWS: Record<string, { bg: string; border: string }> = {
  "Kronos Alpha": { bg: "rgba(99,102,241,0.12)",  border: "#6366f1" },
  "Kronos Beta":  { bg: "rgba(16,185,129,0.12)",  border: "#10b981" },
  "Kronos Gamma": { bg: "rgba(245,158,11,0.12)",  border: "#f59e0b" },
};

function CrewPill({ name }: { name: string }) {
  const c = CREWS[name] ?? { bg: "var(--surface-2)", border: "var(--border)" };
  return (
    <span style={{ padding: "0.15rem 0.5rem", borderRadius: "3px", background: c.bg, border: `1px solid ${c.border}`, fontSize: "0.82rem", fontWeight: 600, whiteSpace: "nowrap", color: "var(--text)" }}>
      {name}
    </span>
  );
}

// Léa has 2 teams → duplicate stripe color (deterministic per driver)
const LEA_STRIPE = "hsl(196.2, 75%, 58%)";

type SortField = "name" | "irating" | "team" | "starttime";

const ALL_ROWS = [
  { name: "Marc Dubois",   irating: 4210, crew: "Kronos Alpha", prefs: "GT3, Audi R8 LMS GT3",  slot: "Départ A", time: "14:00", tags: ["chill", "gros rouleur"], stripe: null,       badge: null },
  { name: "Léa Fontaine",  irating: 3870, crew: "Kronos Alpha", prefs: "GT3",                   slot: "Départ A", time: "14:00", tags: ["compet"],               stripe: LEA_STRIPE, badge: "2 équipages" },
  { name: "Léa Fontaine",  irating: 3870, crew: "Kronos Beta",  prefs: "GT3",                   slot: "Départ B", time: "20:00", tags: ["compet"],               stripe: LEA_STRIPE, badge: "2 équipages" },
  { name: "Théo Bernard",  irating: 5120, crew: "Kronos Beta",  prefs: "GTP, Ferrari 499P",     slot: "Départ A", time: "14:00", tags: [],                       stripe: null,       badge: null },
  { name: "Jules Martin",  irating: 3200, crew: "Kronos Gamma", prefs: "GT3",                   slot: "Départ B", time: "20:00", tags: ["solo", "chill"],         stripe: null,       badge: null },
  { name: "Paul Renard",   irating: 2750, crew: "Kronos Gamma", prefs: "GT3",                   slot: "Départ B", time: "20:00", tags: ["chill"],                 stripe: null,       badge: null },
];

const TH_BASE: React.CSSProperties = {
  padding: "0.5rem 0.65rem", textAlign: "left", fontSize: "0.72rem", fontWeight: 700,
  letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-dim)",
  borderBottom: "1px solid var(--border)", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none",
};
const TD: React.CSSProperties = { padding: "0.5rem 0.65rem", borderBottom: "1px solid var(--border)", fontSize: "0.88rem" };

export default function InscriptionsDemo() {
  const t = useTranslations("events");
  const [sortField, setSortField] = useState<SortField>("team");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const toggleSort = (f: SortField) => {
    if (sortField === f) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(f); setSortDir(f === "irating" ? "desc" : "asc"); }
  };

  // Build rows depending on sort mode
  let rows: typeof ALL_ROWS;
  let groupHeaders: Map<number, string> | null = null;

  if (sortField === "team") {
    rows = [...ALL_ROWS].sort((a, b) => {
      const cmp = a.crew.localeCompare(b.crew);
      return sortDir === "asc" ? cmp : -cmp;
    });
    groupHeaders = new Map();
    let last = "";
    rows.forEach((r, i) => { if (r.crew !== last) { groupHeaders!.set(i, r.crew); last = r.crew; } });
  } else if (sortField === "starttime") {
    rows = [...ALL_ROWS].sort((a, b) => {
      const cmp = a.time.localeCompare(b.time);
      return sortDir === "asc" ? cmp : -cmp;
    });
    groupHeaders = new Map();
    let last = "";
    rows.forEach((r, i) => { if (r.time !== last) { groupHeaders!.set(i, `${r.slot} · ${t("startAt", { time: r.time })}`); last = r.time; } });
  } else if (sortField === "irating") {
    rows = [...ALL_ROWS].sort((a, b) => sortDir === "asc" ? a.irating - b.irating : b.irating - a.irating);
    // Merguez header
    groupHeaders = new Map();
    rows.forEach((r, i) => {
      const prev = rows[i - 1];
      if (sortDir === "desc" && r.irating < 3000 && (i === 0 || (prev && prev.irating >= 3000))) groupHeaders!.set(i, "🌭 MERGUEZ");
      if (sortDir === "asc" && r.irating >= 3000 && (i === 0 || (prev && prev.irating < 3000))) groupHeaders!.set(i, "🌭 MERGUEZ");
    });
  } else {
    // name sort — grouped by driver
    const seen = new Set<string>();
    rows = [...ALL_ROWS].sort((a, b) => {
      const cmp = a.name.localeCompare(b.name);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }

  const SortArrow = ({ field }: { field: SortField }) => (
    <span style={{ opacity: sortField === field ? 1 : 0.3, fontSize: "0.75em" }}>
      {sortField === field && sortDir === "desc" ? "▼" : "▲"}
    </span>
  );

  const isGrouped = sortField === "name";
  const seen = new Set<string>();

  return (
    <div>
      {/* Filter bar */}
      <div style={{
        display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.6rem",
        marginBottom: "1rem", padding: "0.6rem 0.9rem",
        background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "4px", fontSize: "0.82rem",
      }}>
        <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", cursor: "pointer", color: "var(--text-dim)", whiteSpace: "nowrap" }}>
          <input type="checkbox" readOnly style={{ accentColor: "var(--accent)" }} />
          {t("filterNoTeam")}
        </label>
        <span style={{ color: "var(--border)" }}>|</span>
        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "var(--text-dim)" }}>
          <span>iRating</span>
          <input readOnly placeholder="min" style={{ width: "64px", padding: "0.15rem 0.35rem", background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "3px", color: "var(--text)", fontSize: "0.82rem" }} />
          <span>—</span>
          <input readOnly placeholder="max" style={{ width: "64px", padding: "0.15rem 0.35rem", background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "3px", color: "var(--text)", fontSize: "0.82rem" }} />
        </div>
        <span style={{ color: "var(--border)" }}>|</span>
        {[
          { label: "GT3", hue: 200, cars: ["Audi R8 LMS GT3", "Ferrari 296 GT3", "McLaren 720S GT3 EVO"] },
          { label: "GTP", hue: 340, cars: ["Ferrari 499P", "Porsche 963 GTP"] },
        ].map(({ label, hue, cars: catCars }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.25rem", padding: "0.25rem 0.5rem", borderRadius: "4px", background: `hsla(${hue}, 60%, 50%, 0.18)` }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.25rem", cursor: "pointer", paddingRight: "0.3rem", whiteSpace: "nowrap" }}>
              <input type="checkbox" readOnly style={{ accentColor: `hsl(${hue}, 75%, 45%)`, width: "10px", height: "10px", cursor: "pointer" }} />
              <span style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: `hsl(${hue}, 75%, 45%)` }}>{label}</span>
            </label>
            {catCars.map(car => (
              <span key={car} style={{ padding: "0.15rem 0.5rem", borderRadius: "3px", fontSize: "0.75rem", fontWeight: 600, background: "var(--surface-1)", color: "var(--text-dim)", border: "1px solid var(--border)", cursor: "pointer" }}>{car}</span>
            ))}
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="table-wrap inscriptions-table" style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "640px" }}>
          <thead>
            <tr>
              {([["name", t("colDriver")],["irating","iRating"],["team", t("colTeam")]] as [SortField,string][]).map(([f, label]) => (
                <th key={f} style={TH_BASE} onClick={() => toggleSort(f)}>
                  {label} <SortArrow field={f} />
                </th>
              ))}
              <th style={TH_BASE}>{t("colPreferences")}</th>
              <th style={{ ...TH_BASE, cursor: "pointer" }} onClick={() => toggleSort("starttime")}>
                {t("colSlots")} <SortArrow field="starttime" />
              </th>
              <th style={TH_BASE}>{t("colTags")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const header = groupHeaders?.get(i);
              const isFirstForDriver = !seen.has(r.name);
              if (isGrouped) seen.add(r.name);
              const showDriverInfo = !isGrouped || isFirstForDriver;
              const groupBorder = isGrouped && !isFirstForDriver ? "none" : (i > 0 && !header ? "1px solid var(--border)" : undefined);

              return [
                header && (
                  <tr key={`h-${i}`}>
                    <td colSpan={6} style={{
                      padding: "0.6rem 0.75rem", background: "var(--surface-2)",
                      borderTop: "2px solid var(--accent)", borderBottom: "2px solid var(--accent)",
                      textAlign: "center", fontWeight: 700, fontSize: "0.85rem",
                      letterSpacing: "0.04em", textTransform: "uppercase",
                    }}>
                      {sortField === "starttime" ? (
                        <>
                          <span>{header.split(" · ")[0]}</span>
                          <span style={{ margin: "0 0.5rem", color: "var(--text-dim)" }}>·</span>
                          <span style={{ fontFamily: "var(--font-mono),monospace", color: "var(--accent)", fontWeight: 600 }}>{header.split(" · ")[1]}</span>
                        </>
                      ) : header}
                    </td>
                  </tr>
                ),
                <tr key={`${r.name}-${r.crew}`} style={{
                  boxShadow: r.stripe ? `inset 3px 0 0 ${r.stripe}` : undefined,
                  borderTop: groupBorder,
                }}>
                  <td style={{ ...TD, fontWeight: 600, borderTop: isGrouped && !isFirstForDriver ? "none" : undefined }}>
                    {showDriverInfo ? (
                      <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        {r.name}
                        {r.badge && (
                          <span style={{
                            fontSize: "0.65rem", fontWeight: 700, padding: "0.1rem 0.4rem",
                            borderRadius: "3px", whiteSpace: "nowrap",
                            background: r.stripe ? `${r.stripe}22` : "var(--surface-2)",
                            border: `1px solid ${r.stripe ?? "var(--border)"}`,
                            color: r.stripe ?? "var(--text-dim)",
                          }}>{r.badge}</span>
                        )}
                      </span>
                    ) : ""}
                  </td>
                  <td style={{ ...TD, fontFamily: "var(--font-mono),monospace", color: "var(--accent)", fontSize: "0.85rem", borderTop: isGrouped && !isFirstForDriver ? "none" : undefined }}>
                    {showDriverInfo ? r.irating : ""}
                  </td>
                  <td style={TD}><CrewPill name={r.crew} /></td>
                  <td style={{ ...TD, color: "var(--text-dim)" }}>{r.prefs}</td>
                  <td style={{ ...TD, fontFamily: "var(--font-mono),monospace", color: "var(--accent)", fontSize: "0.82rem" }}>
                    <div style={{ fontWeight: 600, fontSize: "0.82rem" }}>{r.slot}</div>
                    <div style={{ fontSize: "0.75rem" }}>{t("startAt", { time: r.time })}</div>
                  </td>
                  <td style={TD}>
                    {r.tags.length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                        {[...r.tags].sort().map(tag => (
                          <span key={tag} style={{ fontSize: "0.72rem", fontWeight: 600, padding: "0.1rem 0.45rem", borderRadius: "3px", background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-dim)", whiteSpace: "nowrap" }}>{tag}</span>
                        ))}
                      </div>
                    ) : <span style={{ color: "var(--text-dim)" }}>—</span>}
                  </td>
                </tr>
              ].filter(Boolean);
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
