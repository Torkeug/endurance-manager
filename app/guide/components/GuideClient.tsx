"use client";
import { useState } from "react";
import Sidebar from "./Sidebar";
import GuideRenderer from "./GuideRenderer";
import type { GuideSection } from "../guide.data";

export default function GuideClient({ guide }: { guide: GuideSection[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ display: "flex", height: "100%", width: "100%", position: "relative" }}>

      {/* Desktop sidebar — always in flow */}
      <div className="hidden md:block" style={{ flexShrink: 0 }}>
        <Sidebar sections={guide} scrollContainerId="guide-main" />
      </div>

      {/* Mobile sidebar — overlay when open */}
      {open && (
        <>
          <div
            className="md:hidden"
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 20 }}
          />
          <div
            className="md:hidden"
            style={{ position: "fixed", top: 0, left: 0, height: "100%", zIndex: 21 }}
            onClick={() => setOpen(false)}
          >
            <Sidebar sections={guide} scrollContainerId="guide-main" />
          </div>
        </>
      )}

      {/* Main content */}
      <main
        id="guide-main"
        style={{ flex: 1, overflowY: "auto", backgroundColor: "var(--bg)" }}
      >
        {/* Mobile toggle button */}
        <div className="md:hidden" style={{ padding: "1rem 4% 0" }}>
          <button
            onClick={() => setOpen(true)}
            style={{
              padding: "0.4rem 0.85rem",
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "3px",
              color: "var(--text)",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "var(--font-rajdhani), sans-serif",
            }}
          >
            ☰ Navigation
          </button>
        </div>

        <div style={{ padding: "4rem 4%" }}>
          <h1 className="text-4xl font-bold mb-4 uppercase tracking-wider" style={{ color: "var(--text)", letterSpacing: "0.05em" }}>
            Guide d'utilisation — Pilotes
          </h1>
          <p className="text-lg font-medium mb-16 pb-8" style={{ color: "var(--text-dim)", borderBottom: "1px solid var(--border)" }}>
            Maîtrise chaque section du Kronos Endurance Planner.
          </p>
          <GuideRenderer data={guide} />
        </div>
      </main>
    </div>
  );
}
