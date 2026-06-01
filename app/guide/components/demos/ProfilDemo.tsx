"use client";
import React, { useState } from "react";

const TABS = [
  { id: "engagements",  label: "Engagements" },
  { id: "statistiques", label: "Statistiques" },
];

const G61_CIRCUITS = [
  { name: "Circuit des 24 Heures du Mans", variant: "24 Heures du Mans", laps: 360, cleanPct: 82, cleanLaps: 295, time: "21h04", sessionTypes: [1, 3], category: "road", bestLap: "3:54.182", bestCar: "Ferrari 296 GT3", bestSession: "P" },
  { name: "Circuit de Spa-Francorchamps",  variant: "Endurance",         laps: 214, cleanPct: 76, cleanLaps: 162, time: "8h22",  sessionTypes: [1],    category: "road", bestLap: "2:18.445", bestCar: "Audi R8 LMS",   bestSession: "P" },
  { name: "Sebring International Raceway", variant: null,                 laps: 98,  cleanPct: 61, cleanLaps: 60,  time: "5h11",  sessionTypes: [1, 3], category: "road", bestLap: "1:54.837", bestCar: "Ferrari 296 GT3", bestSession: "R" },
];

const STATS = [
  { label: "Relais",        value: "18",      color: "var(--accent)" },
  { label: "Heures pilotées", value: "34h",   color: "var(--accent)" },
  { label: "Podiums",       value: "3",        color: "#c9a84c" },
  { label: "Victoires",     value: "1",        color: "#2eb460" },
];

const MINI_BARS = [
  { label: "Nuit",  value: 38, count: 7,  color: "#6366f1" },
  { label: "Pluie", value: 22, count: 4,  color: "#4a9fd4" },
];

// Fake iRating sparkline points (x%, y%)
const IRATING_PTS = [
  [0, 80], [8, 76], [16, 72], [22, 68], [30, 62], [38, 58],
  [46, 54], [54, 50], [62, 46], [70, 42], [80, 38], [90, 34], [100, 30],
].map(([x, y]) => `${x},${y}`);

const LAP_TIMES = [
  { circuit: "Circuit de la Sarthe", car: "Audi R8 LMS",   time: "3:54.182", fuel: "3.82 L/tr" },
  { circuit: "Circuit de Spa",       car: "Audi R8 LMS",   time: "2:18.445", fuel: "2.61 L/tr" },
  { circuit: "Nürburgring",          car: "Ferrari 488 GT3", time: "1:58.734", fuel: "2.24 L/tr" },
];

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "4px", padding: "0.65rem 0.9rem", flex: 1, minWidth: "80px" }}>
      <div style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: "0.2rem" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: "1.1rem", fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function MiniBar({ label, value, count, color }: { label: string; value: number; count: number; color: string }) {
  return (
    <div style={{ marginBottom: "0.6rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", marginBottom: "0.25rem" }}>
        <span style={{ color: "var(--text-dim)" }}>{label}</span>
        <span style={{ fontFamily: "var(--font-mono), monospace", color }}>{value}% <span style={{ color: "var(--text-dim)", fontSize: "0.72rem" }}>({count} relais)</span></span>
      </div>
      <div style={{ height: "6px", background: "var(--border)", borderRadius: "3px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${value}%`, background: color, borderRadius: "3px" }} />
      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: "0.65rem" }}>
      {title}
    </div>
  );
}

export default function ProfilDemo({ activeTab = "engagements", statsSubTab = "app" }: { activeTab?: string; statsSubTab?: string }) {
  const [expandedCircuit, setExpandedCircuit] = useState<string | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Section 1: Name + back button */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <h2 style={{ fontFamily: "var(--font-rajdhani), sans-serif", fontSize: "1.75rem", fontWeight: 700, margin: 0, lineHeight: 1 }}>
            Théo Bernard
          </h2>
          <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: "1.1rem", color: "var(--accent)", marginTop: "0.25rem", fontWeight: 700 }}>
            5 120 iR
          </div>
        </div>
        <button className="btn btn-secondary" style={{ fontSize: "0.82rem", opacity: 0.85 }}>← Pilotes</button>
      </div>

      {/* Section 2: Integration buttons (left) + Inventaire (right) */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button className="btn btn-secondary btn-sm" style={{ fontSize: "0.82rem", color: "#2eb460", border: "1px solid #2eb460", opacity: 0.9 }}>✓ Garage61 lié</button>
          <button className="btn btn-secondary btn-sm" style={{ fontSize: "0.82rem", color: "#2eb460", border: "1px solid #2eb460", opacity: 0.9 }}>✓ iRacing lié</button>
          <button className="btn btn-secondary btn-sm" style={{ fontSize: "0.82rem", opacity: 0.85 }}>🔄 Mettre à jour</button>
        </div>
        <button className="btn btn-secondary btn-sm" style={{ fontSize: "0.82rem", opacity: 0.85 }}>📦 Inventaire</button>
      </div>

      {/* Timestamps */}
      <div style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginBottom: "1.5rem", display: "flex", flexDirection: "column", gap: "0.2rem" }}>
        <span>iRating synchronisé le 12/05/2026 14:30</span>
        <span>Inventaire synchronisé le 02/04/2026 09:15</span>
      </div>

      {/* Info card */}
      <div className="card" style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1.5rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
            {[
              { label: "iRacing ID", value: "458921" },
              { label: "Email",      value: "theo.bernard@kronos.team" },
              { label: "Discord",    value: "TheoB#4812" },
            ].map((f) => (
              <div key={f.label}>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: "0.2rem" }}>{f.label}</div>
                <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.85rem" }}>{f.value}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button className="btn btn-secondary btn-sm" style={{ opacity: 0.85 }}>Changer mot de passe</button>
            <button className="btn btn-secondary btn-sm" style={{ opacity: 0.85 }}>Modifier</button>
          </div>
        </div>
      </div>

      {/* Tab bar — display only, not interactive */}
      <div style={{ display: "flex", gap: "0.25rem", borderBottom: "1px solid var(--border)" }}>
        {TABS.map((t) => (
          <div
            key={t.id}
            style={{
              padding: "0.6rem 1.25rem",
              borderBottom: activeTab === t.id ? "2px solid var(--accent)" : "2px solid transparent",
              color: activeTab === t.id ? "var(--accent)" : "var(--text-dim)",
              fontFamily: "var(--font-rajdhani), sans-serif",
              fontSize: "0.9rem",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: "-1px",
            }}
          >
            {t.label}
          </div>
        ))}
      </div>

      {/* ── Engagements tab ── */}
      {activeTab === "engagements" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {[
            { event: "Endurance GT 24h Le Mans", crew: "Kronos Alpha", stint: "Relais 3 · 17:44 → 19:36" },
            { event: "Spa 6 Heures",             crew: "Kronos Beta",  stint: "Relais 2 · 16:00 → 18:00" },
            { event: "Nürburgring 24h",           crew: "Kronos Alpha", stint: "Relais 5 · 22:10 → 00:02" },
          ].map((e) => (
            <div key={e.event} className="card" style={{ padding: "0.75rem" }}>
              <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{e.event}</div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>{e.crew}</div>
              <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.78rem", color: "var(--accent)", marginTop: "0.2rem" }}>{e.stint}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Statistiques tab ── */}
      {activeTab === "statistiques" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Subtab nav */}
          <div style={{ display: "flex", gap: "0.25rem", borderBottom: "1px solid var(--border)", marginBottom: "0.25rem" }}>
            {[{ id: "app", label: "Endurance Manager" }, { id: "garage61", label: "Garage61" }].map((st) => (
              <div key={st.id} style={{ padding: "0.35rem 0.85rem", borderBottom: statsSubTab === st.id ? "2px solid var(--accent)" : "2px solid transparent", color: statsSubTab === st.id ? "var(--accent)" : "var(--text-dim)", fontFamily: "var(--font-rajdhani), sans-serif", fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "-1px" }}>
                {st.label}
              </div>
            ))}
          </div>

          {/* ── Endurance Manager subtab ── */}
          {statsSubTab === "app" && <>
            {/* Summary stat cards */}
            <div>
              <SectionHeader title="Résumé" />
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {STATS.map((s) => <StatCard key={s.label} {...s} />)}
              </div>
            </div>

            {/* Mini bars */}
            <div>
              <SectionHeader title="Conditions" />
              {MINI_BARS.map((b) => <MiniBar key={b.label} {...b} />)}
            </div>

            {/* iRating sparkline */}
            <div>
              <SectionHeader title="Historique iRating — Sports Car" />
              <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "4px", padding: "0.75rem" }}>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: "80px", display: "block" }}>
                  <polyline points={IRATING_PTS.join(" ")} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                  <polygon points={`0,100 ${IRATING_PTS.join(" ")} 100,100`} fill="var(--accent)" opacity="0.08" />
                </svg>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "var(--text-dim)", marginTop: "0.25rem" }}>
                  <span>jan. 2026</span>
                  <span style={{ fontFamily: "var(--font-mono), monospace", color: "var(--accent)", fontWeight: 700 }}>5 120 iR</span>
                  <span>avr. 2026</span>
                </div>
              </div>
            </div>

            {/* Lap time table */}
            <div>
              <SectionHeader title="Chronos par circuit" />
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <thead>
                    <tr>
                      {["Circuit", "Voiture", "Chrono", "Conso"].map((h) => (
                        <th key={h} style={{ padding: "0.4rem 0.65rem", textAlign: "left", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-dim)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {LAP_TIMES.map((r) => (
                      <tr key={r.circuit}>
                        <td style={{ padding: "0.45rem 0.65rem", borderBottom: "1px solid var(--border)", fontSize: "0.82rem" }}>{r.circuit}</td>
                        <td style={{ padding: "0.45rem 0.65rem", borderBottom: "1px solid var(--border)", fontSize: "0.8rem", color: "var(--text-dim)" }}>{r.car}</td>
                        <td style={{ padding: "0.45rem 0.65rem", borderBottom: "1px solid var(--border)", fontFamily: "var(--font-mono), monospace", fontSize: "0.82rem", color: "var(--accent)" }}>{r.time}</td>
                        <td style={{ padding: "0.45rem 0.65rem", borderBottom: "1px solid var(--border)", fontFamily: "var(--font-mono), monospace", fontSize: "0.8rem", color: "var(--text-dim)" }}>{r.fuel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>}

          {/* ── Garage61 subtab ── */}
          {statsSubTab === "garage61" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {/* Controls */}
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-dim)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Tri</span>
                  {["Tours", "% Propres", "Temps piste"].map((label, i) => (
                    <span key={label} style={{ padding: "0.2rem 0.6rem", borderRadius: "999px", border: "1px solid", borderColor: i === 0 ? "var(--accent)" : "var(--border)", background: i === 0 ? "var(--accent-dim)" : "transparent", color: i === 0 ? "var(--accent)" : "var(--text-dim)", fontSize: "0.75rem", fontWeight: 600 }}>{label}</span>
                  ))}
                </div>
                <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-dim)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Catégorie</span>
                  <span style={{ padding: "0.3rem 0.75rem", borderRadius: "3px", border: "1px solid var(--accent)", background: "var(--accent-dim)", color: "var(--accent)", fontFamily: "var(--font-rajdhani), sans-serif", fontSize: "0.78rem", fontWeight: 700 }}>Road</span>
                </div>
              </div>

              {/* Table */}
              <div style={{ border: "1px solid var(--border)", borderRadius: "4px", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Circuit", "Tours", "Propres", "Temps piste", "Sessions", ""].map((h) => (
                        <th key={h} style={{ background: "var(--surface-2)", color: "var(--text-dim)", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "0.5rem 0.75rem", borderBottom: "2px solid var(--border)", textAlign: h === "Tours" || h === "Propres" || h === "Temps piste" ? "right" : "left", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Category header */}
                    <tr>
                      <td colSpan={6} style={{ padding: "0.4rem 0.75rem", background: "var(--surface-2)", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-dim)", borderBottom: "1px solid var(--border)" }}>Road</td>
                    </tr>
                    {G61_CIRCUITS.map((c, i) => (
                      <React.Fragment key={c.name}>
                        <tr onClick={() => setExpandedCircuit(expandedCircuit === c.name ? null : c.name)} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)", cursor: "pointer" }}>
                          <td style={{ padding: "0.4rem 0.75rem", borderBottom: "1px solid var(--border)", fontSize: "0.82rem", fontWeight: 600 }}>
                            <span style={{ fontSize: "0.6rem", color: "var(--text-dim)", marginRight: "0.4rem", display: "inline-block", transform: expandedCircuit === c.name ? "rotate(90deg)" : "none" }}>▶</span>
                            {c.name}
                            {c.variant && <span style={{ fontWeight: 400, color: "var(--text-dim)", marginLeft: "0.4rem", fontSize: "0.78rem" }}>{c.variant}</span>}
                          </td>
                          <td style={{ padding: "0.4rem 0.75rem", borderBottom: "1px solid var(--border)", textAlign: "right", fontFamily: "var(--font-mono), monospace", fontSize: "0.82rem" }}>{c.laps}</td>
                          <td style={{ padding: "0.4rem 0.75rem", borderBottom: "1px solid var(--border)", textAlign: "right", fontFamily: "var(--font-mono), monospace", fontSize: "0.82rem", color: c.cleanPct >= 70 ? "#2eb460" : "var(--text)" }}>{c.cleanPct}% <span style={{ color: "var(--text-dim)", fontSize: "0.72rem" }}>({c.cleanLaps})</span></td>
                          <td style={{ padding: "0.4rem 0.75rem", borderBottom: "1px solid var(--border)", textAlign: "right", fontFamily: "var(--font-mono), monospace", fontSize: "0.82rem", color: "var(--text-dim)" }}>{c.time}</td>
                          <td style={{ padding: "0.4rem 0.75rem", borderBottom: "1px solid var(--border)" }}>
                            <div style={{ display: "flex", gap: "0.25rem" }}>
                              {c.sessionTypes.map((s) => <span key={s} style={{ padding: "0.1rem 0.35rem", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "3px", fontSize: "0.68rem", fontWeight: 700, color: s === 3 ? "var(--accent)" : "var(--text-dim)" }}>{s === 1 ? "P" : "R"}</span>)}
                            </div>
                          </td>
                          <td style={{ padding: "0.4rem 0.75rem", borderBottom: "1px solid var(--border)", textAlign: "right" }}>
                            <span className="btn btn-secondary btn-sm" style={{ fontSize: "0.72rem" }}>↗ Garage61</span>
                          </td>
                        </tr>
                        {expandedCircuit === c.name && (
                          <tr>
                            <td colSpan={6} style={{ padding: "0.5rem 1.5rem 0.6rem", background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                              <div style={{ display: "flex", gap: "1.25rem", alignItems: "center", flexWrap: "wrap" }}>
                                <div>
                                  <span style={{ fontSize: "0.65rem", color: "var(--text-dim)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginRight: "0.5rem" }}>Meilleur tour</span>
                                  <span style={{ fontFamily: "var(--font-mono), monospace", fontWeight: 700, fontSize: "0.95rem", color: "var(--accent)" }}>{c.bestLap}</span>
                                </div>
                                <span style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>{c.bestCar}</span>
                                <span style={{ padding: "0.1rem 0.35rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "3px", fontSize: "0.68rem", fontWeight: 700, color: "var(--text-dim)" }}>{c.bestSession}</span>
                                <span style={{ fontSize: "0.72rem", color: "#2eb460" }}>✓ propre</span>
                                <span className="btn btn-secondary btn-sm" style={{ fontSize: "0.72rem", marginLeft: "auto" }}>↗ Meilleur tour</span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>Données agrégées depuis Garage61 · 672 tours au total</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
