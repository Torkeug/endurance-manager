import { useTranslations } from "next-intl";

export default function AdminTabsDemo() {
  const t = useTranslations("admin");
  const TABS = [
    { id: "pilotes",    label: t("tabDrivers"),     badge: 2 },
    { id: "equipages",  label: t("tabEntries"),      badge: 0 },
    { id: "voitures",   label: t("tabCars"),         badge: 0 },
    { id: "classes",    label: t("tabClasses"),      badge: 0 },
    { id: "circuits",   label: t("tabCircuits"),     badge: 0 },
    { id: "types",      label: t("tabEventTypes"),   badge: 0 },
    { id: "garage61",   label: t("tabGarage61"),     badge: 0 },
    { id: "parametres", label: t("tabSettings"),     badge: 0 },
  ];
  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>{t("pageTitle")}</h2>
        <div style={{ height: "2px", background: "var(--accent)", width: "2rem", margin: "0.4rem 0" }} />
        <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", margin: 0 }}>{t("pageSubtitle")}</p>
      </div>

      {/* Tab bar */}
      <div style={{
        display: "flex", gap: "0.25rem", borderBottom: "1px solid var(--border)",
        overflowX: "auto", scrollbarWidth: "none" as any,
      }}>
        {TABS.map((tab, i) => (
          <button
            key={tab.id}
            style={{
              padding: "0.6rem 1.25rem", background: "transparent", border: "none",
              borderBottom: i === 0 ? "2px solid var(--accent)" : "2px solid transparent",
              color: i === 0 ? "var(--accent)" : "var(--text-dim)",
              fontFamily: "var(--font-rajdhani),sans-serif", fontSize: "0.9rem",
              fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const,
              cursor: "default", marginBottom: "-1px", whiteSpace: "nowrap" as const, flexShrink: 0,
            }}
          >
            {tab.label}
            {tab.badge > 0 && (
              <span style={{
                marginLeft: "0.4rem", background: "var(--danger)", color: "#fff",
                fontSize: "0.65rem", fontWeight: 700, padding: "1px 5px",
                borderRadius: "10px", verticalAlign: "middle",
              }}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
