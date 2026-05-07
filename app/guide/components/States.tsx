import React from "react";

const BADGE_STYLES: Record<string, React.CSSProperties> = {
  yes:     { background: "var(--success)", color: "#fff" },
  no:      { background: "var(--danger)",  color: "#fff" },
  neutral: { background: "var(--accent)",  color: "#000" },
  hard:    { background: "rgba(224,85,85,0.12)", border: "1px solid var(--danger)", color: "var(--danger)" },
  soft:    { background: "#2a1a00", border: "1px solid #a06020", color: "#d4904a" },
};

const PILL: React.CSSProperties = {
  fontSize: "0.7rem",
  padding: "0.15rem 0.4rem",
  borderRadius: "2px",
  whiteSpace: "nowrap",
  flexShrink: 0,
};

export default function States({ items }: { items: { variant: string; label: string; description?: string }[] }) {
  const hasDescriptions = items.some((s) => s.description);
  return (
    <div style={{ display: "flex", flexDirection: hasDescriptions ? "column" : "row", flexWrap: "wrap", gap: hasDescriptions ? "0.5rem" : "1rem" }}>
      {items.map((s, i) => {
        const badgeStyle = BADGE_STYLES[s.variant] ?? BADGE_STYLES.neutral;
        const isMismatch = s.variant === "hard" || s.variant === "soft";
        return (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            {isMismatch
              ? <span style={{ ...PILL, ...badgeStyle }}>⚠️ {s.label}</span>
              : <span className="badge" style={badgeStyle}>{s.label}</span>
            }
            {s.description && (
              <span style={{ fontSize: "0.88rem", color: "var(--text)" }}>{s.description}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}