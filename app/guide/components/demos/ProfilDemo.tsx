"use client";
import { useState } from "react";

const TABS = [
  { id: "engagements",  label: "Engagements" },
  { id: "statistiques", label: "Statistiques" },
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

export default function ProfilDemo() {
  const [activeTab, setActiveTab] = useState("engagements");

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

      {/* Tab bar */}
      <div style={{ display: "flex", gap: "0.25rem", borderBottom: "1px solid var(--border)" }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: "0.6rem 1.25rem",
              background: "transparent",
              border: "none",
              borderBottom: activeTab === t.id ? "2px solid var(--accent)" : "2px solid transparent",
              color: activeTab === t.id ? "var(--accent)" : "var(--text-dim)",
              fontFamily: "var(--font-rajdhani), sans-serif",
              fontSize: "0.9rem",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: "pointer",
              marginBottom: "-1px",
            }}
          >
            {t.label}
          </button>
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
            <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "4px", padding: "0.75rem", position: "relative" }}>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: "80px", display: "block" }}>
                <polyline
                  points={IRATING_PTS.join(" ")}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
                {/* fill area */}
                <polygon
                  points={`0,100 ${IRATING_PTS.join(" ")} 100,100`}
                  fill="var(--accent)"
                  opacity="0.08"
                />
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
            <div className="table-wrap" style={{ overflowX: "auto" }}>
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
        </div>
      )}
    </div>
  );
}
