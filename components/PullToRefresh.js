"use client";
import { useRef, useState, useEffect } from "react";

const THRESHOLD = 68; // px (after damping) to trigger reload

export default function PullToRefresh({ children }) {
  const containerRef = useRef(null);
  const startYRef = useRef(null);
  const pullRef = useRef(0); // kept in sync with state for use inside event handlers
  const [pull, setPull] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e) => {
      if (el.scrollTop > 0) return;
      startYRef.current = e.touches[0].clientY;
    };

    const onTouchMove = (e) => {
      if (startYRef.current === null) return;
      const delta = e.touches[0].clientY - startYRef.current;
      if (delta <= 0 || el.scrollTop > 0) {
        startYRef.current = null;
        pullRef.current = 0;
        setPull(0);
        return;
      }
      e.preventDefault(); // block native scroll during pull
      const d = Math.min(delta * 0.45, THRESHOLD * 1.4); // resistance
      pullRef.current = d;
      setPull(d);
    };

    const onTouchEnd = () => {
      if (pullRef.current >= THRESHOLD) {
        location.reload();
        return;
      }
      startYRef.current = null;
      pullRef.current = 0;
      setPull(0);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  const progress = Math.min(pull / THRESHOLD, 1);
  const ready = progress >= 1;

  return (
    <main ref={containerRef} className="flex-1 overflow-auto" style={{ position: "relative" }}>
      {/* Pull indicator — pushes content down as user drags */}
      <div
        style={{
          height: `${pull}px`,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: pull === 0 ? "height 0.2s ease" : "none",
          pointerEvents: "none",
        }}
      >
        {pull > 6 && (
          <div
            style={{
              width: "22px",
              height: "22px",
              borderRadius: "50%",
              border: "2px solid var(--border)",
              borderTopColor: ready ? "var(--accent)" : "var(--text-dim)",
              transform: `rotate(${progress * 300}deg)`,
              opacity: progress,
              transition: "border-top-color 0.15s",
            }}
          />
        )}
      </div>
      {children}
    </main>
  );
}
