"use client";
import { useState } from "react";
import AdminDemoShell from "./AdminDemoShell";
import { useTranslations } from "next-intl";

const CLASSES = [
  {
    id: 1, name: "GT3", refuel: 2.6,
    cars: ["Audi R8 LMS GT3 EVO II", "Ferrari 296 GT3", "Porsche 992 GT3 R"],
    unclassed: [],
  },
  {
    id: 2, name: "GTP", refuel: 3.2,
    cars: ["Ferrari 499P", "Porsche 963 GTP"],
    unclassed: [],
  },
  {
    id: 3, name: "LMP2", refuel: 2.9,
    cars: [],
    unclassed: [],
  },
];

const UNCLASSED = ["Dallara P217"];

export default function AdminClassesDemo() {
  const t = useTranslations("admin");
  const [expanded, setExpanded] = useState<number | null>(1);

  return (
    <AdminDemoShell activeTab="classes">
    <div>
      <button className="btn btn-primary" style={{ marginBottom: "0.75rem" }}>{t("classesAddBtn")}</button>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "0.75rem" }}>
        {CLASSES.map((cls) => {
          const isExpanded = expanded === cls.id;
          return (
            <div key={cls.id} className="card" style={{ padding: 0, overflow: "hidden" }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.85rem 1rem", flexWrap: "wrap" }}>
                <div style={{ flex: 1 }}>
                  <span className="badge badge-driver" style={{ fontSize: "0.9rem", padding: "0.25rem 0.6rem" }}>{cls.name}</span>
                  <span style={{ marginLeft: "0.75rem", fontSize: "0.8rem", color: "var(--text-dim)" }}>
                    {t("classesCarsCount", { count: cls.cars.length })}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                  {/* Refuel rate stepper */}
                  <div style={{ display: "flex", alignItems: "stretch", fontSize: "0.8rem" }}>
                    <span style={{ padding: "0.3rem 0.5rem", background: "var(--surface-2)", border: "1px solid var(--border)", borderRight: "none", borderRadius: "3px 0 0 3px", color: "var(--text-dim)", display: "flex", alignItems: "center" }}>{t("classesRefuelLabel")}</span>
                    <button style={{ padding: "0.3rem 0.5rem", background: "var(--surface-2)", border: "1px solid var(--border)", borderRight: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: "0.9rem", lineHeight: 1 }}>−</button>
                    <input readOnly value={cls.refuel} className="no-arrows" style={{ width: "56px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0, color: "var(--text)", fontFamily: "var(--font-mono),monospace", fontSize: "0.8rem", padding: "0.3rem 0.4rem", textAlign: "center" }} />
                    <button style={{ padding: "0.3rem 0.5rem", background: "var(--surface-2)", border: "1px solid var(--border)", borderLeft: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: "0.9rem", lineHeight: 1 }}>+</button>
                    <span style={{ padding: "0.3rem 0.5rem", background: "var(--surface-2)", border: "1px solid var(--border)", borderLeft: "none", borderRadius: "0 3px 3px 0", color: "var(--text-dim)", display: "flex", alignItems: "center", fontSize: "0.8rem" }}>{t("classesRefuelUnit")}</span>
                  </div>
                  <button onClick={() => setExpanded(isExpanded ? null : cls.id)} className="btn btn-secondary btn-sm">
                    {t("classesToggle", { expanded: String(isExpanded) })}
                  </button>
                  <button className="btn btn-secondary btn-sm">{t("edit")}</button>
                  <button className="btn btn-danger btn-sm">{t("delete")}</button>
                </div>
              </div>

              {/* Expanded: assigned cars + unclassed */}
              {isExpanded && (
                <div style={{ padding: "1rem", borderTop: "1px solid var(--border)", background: "var(--surface-2)" }}>
                  {cls.cars.length > 0 && (
                    <div style={{ marginBottom: UNCLASSED.length > 0 ? "1rem" : 0 }}>
                      <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "var(--text-dim)", marginBottom: "0.5rem" }}>
                        {t("classesAssigned")}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                        {cls.cars.map((car) => (
                          <div key={car} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.4rem 0.5rem 0.4rem 0.8rem", background: "var(--accent-dim)", border: "1px solid var(--accent)", borderRadius: "3px", fontSize: "0.85rem", fontWeight: 600 }}>
                            {car}
                            <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: "1rem", lineHeight: 1, padding: 0 }}>×</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {UNCLASSED.length > 0 && (
                    <div>
                      <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "var(--text-dim)", marginBottom: "0.5rem" }}>
                        {t("classesUnassigned")}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                        {UNCLASSED.map((car) => (
                          <button key={car} style={{ padding: "0.4rem 0.8rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "3px", color: "var(--text-dim)", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer" }}>
                            + {car}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {cls.cars.length === 0 && UNCLASSED.length === 0 && (
                    <p style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>{t("classesAllAssigned")}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Unclassed summary */}
      {UNCLASSED.length > 0 && (
        <div className="card" style={{ marginBottom: "0.75rem", borderColor: "var(--accent-dim)" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "var(--text-dim)", marginBottom: "0.5rem" }}>
            {t("classesUnclassedWarning", { count: UNCLASSED.length })}
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>{UNCLASSED.join(", ")}</div>
        </div>
      )}
    </div>
    </AdminDemoShell>
  );
}
