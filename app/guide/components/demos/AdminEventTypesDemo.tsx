"use client";
import { useState } from "react";
import AdminDemoShell from "./AdminDemoShell";

const TYPES = [
  { id: 1, name: "Endurance GT",  cars: [
    { id: 1, name: "Audi R8 LMS GT3 EVO II", cls: "GT3", allowed: true },
    { id: 2, name: "Ferrari 296 GT3",          cls: "GT3", allowed: true },
    { id: 3, name: "Porsche 992 GT3 R",         cls: "GT3", allowed: true },
    { id: 4, name: "Ferrari 499P",              cls: "GTP", allowed: false },
  ]},
  { id: 2, name: "GTP Cup", cars: [
    { id: 4, name: "Ferrari 499P",   cls: "GTP", allowed: true },
    { id: 5, name: "Porsche 963 GTP", cls: "GTP", allowed: true },
  ]},
  { id: 3, name: "Multi-classe", cars: [] },
];

export default function AdminEventTypesDemo() {
  const [expanded, setExpanded] = useState<number | null>(1);

  return (
    <AdminDemoShell activeTab="types">
    <div>
      <button className="btn btn-primary" style={{ marginBottom: "0.75rem" }}>+ Ajouter un type d'événement</button>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "0.75rem" }}>
        {TYPES.map((et) => {
          const allowedCount = et.cars.filter((c) => c.allowed).length;
          const isExpanded = expanded === et.id;
          const byClass: Record<string, typeof et.cars> = {};
          for (const c of et.cars) {
            if (!byClass[c.cls]) byClass[c.cls] = [];
            byClass[c.cls].push(c);
          }

          return (
            <div key={et.id} className="card" style={{ padding: 0, overflow: "hidden" }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.85rem 1rem", flexWrap: "wrap" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "1rem" }}>{et.name}</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-dim)", marginTop: "0.2rem" }}>
                    {et.cars.length === 0
                      ? "Toutes les voitures autorisées"
                      : `${allowedCount} voiture${allowedCount > 1 ? "s" : ""} autorisée${allowedCount > 1 ? "s" : ""}`}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button onClick={() => setExpanded(isExpanded ? null : et.id)} className="btn btn-secondary btn-sm">
                    {isExpanded ? "▲ Voitures" : "▼ Voitures"}
                  </button>
                  <button className="btn btn-secondary btn-sm">Modifier</button>
                  <button className="btn btn-danger btn-sm">Supprimer</button>
                </div>
              </div>

              {/* Car selector */}
              {isExpanded && (
                <div style={{ padding: "1rem", borderTop: "1px solid var(--border)", background: "var(--surface-2)" }}>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginBottom: "1rem" }}>
                    Cochez les voitures autorisées pour ce type. Si aucune voiture n'est cochée, toutes sont autorisées.
                  </p>
                  {et.cars.length === 0 ? (
                    <p style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>Aucune restriction configurée — toutes les voitures sont accessibles.</p>
                  ) : (
                    Object.entries(byClass).map(([cls, cars]) => {
                      const allChecked = cars.every((c) => c.allowed);
                      const someChecked = cars.some((c) => c.allowed);
                      return (
                        <div key={cls} style={{ marginBottom: "1rem" }}>
                          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "var(--text-dim)", marginBottom: "0.5rem", cursor: "pointer" }}>
                            <input type="checkbox" readOnly checked={allChecked} style={{ accentColor: "var(--accent)" }} />
                            {cls}
                            {someChecked && !allChecked && <span style={{ color: "var(--accent)", fontSize: "0.7rem", fontWeight: 600 }}>({cars.filter(c => c.allowed).length}/{cars.length})</span>}
                          </label>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", paddingLeft: "1.5rem" }}>
                            {cars.map((car) => (
                              <label key={car.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.4rem 0.7rem", background: car.allowed ? "var(--accent-dim)" : "var(--surface)", border: "1px solid", borderColor: car.allowed ? "var(--accent)" : "var(--border)", borderRadius: "3px", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600 }}>
                                <input type="checkbox" readOnly checked={car.allowed} style={{ accentColor: "var(--accent)" }} />
                                {car.name}
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
    </AdminDemoShell>
  );
}
