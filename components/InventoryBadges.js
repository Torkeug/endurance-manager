// Shared badge and legend components for all inventory views.
// Import from here — do not redefine locally in InventoryMatrix, InventaireDisplay, or EventInventoryTab.

"use client";

// ── Compact badges — for matrix/table views where columns are narrow ──────────

// K badge — car/circuit is in the Kronos catalog
export function KBadge() {
  return (
    <span
      style={{
        marginLeft: "0.35rem",
        fontSize: "0.58rem",
        fontWeight: 700,
        color: "var(--accent)",
        border: "1px solid var(--accent)",
        borderRadius: "2px",
        padding: "0 0.2rem",
        verticalAlign: "middle",
        flexShrink: 0,
      }}
    >
      K
    </span>
  );
}

// iR+ badge — car/circuit is free with iRacing subscription
export function FreeBadge() {
  return (
    <span
      style={{
        marginLeft: "0.35rem",
        fontSize: "0.58rem",
        fontWeight: 700,
        color: "#50c878",
        border: "1px solid #50c878",
        borderRadius: "2px",
        padding: "0 0.2rem",
        verticalAlign: "middle",
        flexShrink: 0,
      }}
    >
      iR+
    </span>
  );
}

// ── Full-text badges — for list/detail views with more horizontal space ───────

// Full Kronos badge — used in InventaireDisplay
export function KronosBadge() {
  return (
    <span
      style={{
        fontSize: "0.62rem",
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--accent)",
        border: "1px solid var(--accent)",
        borderRadius: "3px",
        padding: "0.1rem 0.35rem",
        flexShrink: 0,
      }}
    >
      Kronos
    </span>
  );
}

// Full iR+ badge — used in InventaireDisplay alongside KronosBadge
export function FreeSubscriptionBadge() {
  return (
    <span
      style={{
        fontSize: "0.62rem",
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "#50c878",
        border: "1px solid #50c878",
        borderRadius: "3px",
        padding: "0.1rem 0.35rem",
        flexShrink: 0,
      }}
    >
      iR+
    </span>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────

// Render above any inventory table to explain badge meanings.
// Uses compact badges so the legend itself is compact.
export function BadgeLegend() {
  return (
    <div
      style={{
        display: "flex",
        gap: "1rem",
        flexWrap: "wrap",
        alignItems: "center",
        marginBottom: "1rem",
        padding: "0.4rem 0.75rem",
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderRadius: "3px",
      }}
    >
      <span
        style={{
          fontSize: "0.68rem",
          fontWeight: 700,
          color: "var(--text-dim)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        Légende
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
        <KBadge />
        <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
          Kronos
        </span>
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
        <FreeBadge />
        <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
          Inclus abonnement iRacing
        </span>
      </span>
    </div>
  );
}
