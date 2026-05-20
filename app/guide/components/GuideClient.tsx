"use client";
import { useState, useEffect, useRef } from "react";
import Sidebar from "./Sidebar";
import GuideRenderer from "./GuideRenderer";
import type { GuideSection } from "../guide.data";

export default function GuideClient({ guide }: { guide: GuideSection[] }) {
  const [open, setOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Chrome on Android saves/restores scroll of named containers independently
    // of history.scrollRestoration. Reset explicitly so refresh always starts at top.
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", position: "relative" }}>

      {/* Mobile nav bar — outside scroll area, always visible */}
      <div
        className="md:hidden"
        style={{
          flexShrink: 0,
          padding: "0.5rem 4%",
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <button
          onClick={() => setOpen(true)}
          style={{
            padding: "0.35rem 0.85rem",
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

      {/* Main row: sidebar + content */}
      <div style={{ display: "flex", flex: 1, minHeight: 0, position: "relative" }}>

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
              style={{ position: "absolute", top: 0, left: 0, height: "100%", zIndex: 21 }}
              onClick={() => setOpen(false)}
            >
              <Sidebar sections={guide} scrollContainerId="guide-main" />
            </div>
          </>
        )}

        {/* Scrollable content */}
        <main
          ref={mainRef}
          id="guide-main"
          style={{ flex: 1, minWidth: 0, overflowY: "auto", overflowX: "hidden", backgroundColor: "var(--bg)" }}
        >
          <div style={{ padding: "4rem 4%" }}>
            <h1 className="text-4xl font-bold mb-4 uppercase tracking-wider" style={{ color: "var(--text)", letterSpacing: "0.05em" }}>
              Guide d&apos;utilisation — Pilotes
            </h1>
            <p className="text-lg font-medium mb-16 pb-8" style={{ color: "var(--text-dim)", borderBottom: "1px solid var(--border)" }}>
              Maîtrise chaque section du Kronos Endurance Planner.
            </p>
            <GuideRenderer data={guide} />
          </div>
        </main>
      </div>
    </div>
  );
}
