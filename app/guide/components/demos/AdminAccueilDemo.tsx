import { useTranslations } from "next-intl";

const labelStyle = {
  fontSize: "0.65rem",
  fontWeight: 700,
  letterSpacing: "0.07em",
  textTransform: "uppercase" as const,
  color: "var(--text-dim)",
  marginBottom: "0.5rem",
};

const STAT_COLORS = [
  "var(--accent)",
  "var(--accent)",
  "var(--text-dim)",
  "var(--text-dim)",
  "var(--danger)",
  "var(--danger)",
  "#f59e0b",
];

export default function AdminAccueilDemo() {
  const t = useTranslations("dashboard");
  const tHomeTabs = useTranslations("homeTabs");

  const STATS = [
    { label: t("statEvents_other"),           value: 4,  color: STAT_COLORS[0] },
    { label: t("statActiveDrivers_other"),     value: 18, color: STAT_COLORS[1] },
    { label: t("statInactiveDrivers_other"),   value: 2,  color: STAT_COLORS[2] },
    { label: t("statTestDrivers_other"),       value: 1,  color: STAT_COLORS[3] },
    { label: t("statPending"),                 value: 2,  color: STAT_COLORS[4] },
    { label: t("statOverdue_other"),           value: 3,  color: STAT_COLORS[5] },
    { label: t("statSync_other"),              value: 1,  color: STAT_COLORS[6] },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* Pending approval banner */}
      <div style={{
        background: "rgba(224,85,85,0.1)", border: "1px solid var(--danger)",
        borderRadius: "4px", padding: "0.75rem 1rem",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap",
      }}>
        <span style={{ color: "var(--danger)", fontWeight: 600, fontSize: "0.9rem" }}>
          ⚠️ {t("pendingWarning_other").replace("#", "2")}
        </span>
        <button className="btn btn-danger btn-sm">{t("manageAccess")}</button>
      </div>

      {/* Page header */}
      <div>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>{t("title")}</h2>
        <div style={{ height: "2px", background: "var(--accent)", width: "2rem", margin: "0.4rem 0" }} />
        <p style={{ color: "var(--text-dim)", fontSize: "0.9rem", margin: 0 }}>{t("welcome")} <strong style={{ color: "var(--text)" }}>Raphaël Laurent</strong></p>
      </div>

      {/* Quick actions */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <button className="btn btn-primary">{t("addDriver")}</button>
        <button className="btn btn-primary">{t("createEvent")}</button>
        <button className="btn btn-primary">{t("createChampionship")}</button>
        <button className="btn btn-secondary">{t("viewEvents")}</button>
        <button className="btn btn-secondary">{t("myProfile")}</button>
      </div>

      {/* Admin stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "0.75rem" }}>
        {STATS.map(({ label, value, color }) => (
          <div key={label} className="card" style={{ padding: "1rem", textAlign: "center" }}>
            <div className="mono" style={{ fontSize: "1.8rem", fontWeight: 700, color }}>{value}</div>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--text-dim)", marginTop: "0.25rem" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Planning + Suivi tabs */}
      <div>
        <div style={{ display: "flex", gap: "0.25rem", borderBottom: "1px solid var(--border)", marginBottom: "1.25rem" }}>
          {[
            { label: tHomeTabs("planning"), badge: 0, active: true },
            { label: tHomeTabs("incomplete"), badge: 3, active: false },
          ].map(({ label, badge, active }) => (
            <button key={label} style={{
              padding: "0.5rem 1.25rem", background: "transparent", border: "none",
              borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
              color: active ? "var(--accent)" : "var(--text-dim)",
              fontFamily: "var(--font-rajdhani),sans-serif", fontSize: "0.9rem",
              fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const,
              cursor: "default", marginBottom: "-1px", display: "flex", alignItems: "center", gap: "0.4rem",
            }}>
              {label}
              {badge > 0 && (
                <span style={{ background: "var(--danger)", color: "#fff", fontSize: "0.65rem", fontWeight: 700, padding: "1px 5px", borderRadius: "10px" }}>{badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* Planning content */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div className="card">
            <div style={labelStyle}>{t("nextEvent")}</div>
            <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "0.62rem", fontWeight: 700, padding: "0.1rem 0.45rem", background: "var(--accent)", color: "#fff", borderRadius: "2px" }}>{t("specialBadge")}</span>
            </div>
            <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "0.25rem" }}>Endurance GT 24h Le Mans</div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginBottom: "0.5rem" }}>Circuit de la Sarthe · GT3 · 24h</div>
            <div style={{ fontFamily: "var(--font-mono),monospace", fontSize: "0.9rem", color: "var(--accent)" }}>Sam. 23 avr. · 14:00</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", marginTop: "0.2rem" }}>dans 5j 2h · 3 équipages</div>
          </div>
          <div className="card">
            <div style={labelStyle}>{t("myNextStint")}</div>
            <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "0.2rem" }}>Endurance GT 24h</div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginBottom: "0.5rem" }}>Kronos Alpha · Relais 3</div>
            <div style={{ fontFamily: "var(--font-mono),monospace", fontSize: "0.9rem", color: "var(--accent)" }}>17:44 IRL</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", marginTop: "0.2rem" }}>dans 3h 44min</div>
          </div>
        </div>
      </div>

    </div>
  );
}
