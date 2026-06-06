import AdminDemoShell from "./AdminDemoShell";
import { useTranslations } from "next-intl";

const thStyle = {
  background: "var(--surface-2)", color: "var(--text-dim)", fontSize: "0.72rem", fontWeight: 700,
  letterSpacing: "0.08em", textTransform: "uppercase" as const, padding: "0.6rem 1rem",
  textAlign: "left" as const, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" as const,
};
const tdStyle = { padding: "0.55rem 1rem", borderBottom: "1px solid var(--border)", fontSize: "0.85rem" };

const ROWS = [
  { g61: "Marc Dubois",   slug: "marc-dubois",   db: "Marc Dubois",   status: "confirmed" },
  { g61: "Léa Fontaine",  slug: "lea-fontaine",  db: "Léa Fontaine",  status: "exact" },
  { g61: "Theo Bernard",  slug: "theo-bernard",  db: "Théo Bernard",  status: "fuzzy" },
  { g61: "J. Martin",     slug: "j-martin",      db: "Jules Martin / Jean Martin", status: "ambiguous" },
  { g61: "Paul Renard",   slug: "paul-renard",   db: "—",             status: "no_match" },
];

export default function AdminGarage61Demo() {
  const t = useTranslations("admin");

  const STATUS_META: Record<string, { label: string; color: string }> = {
    confirmed: { label: t("g61ConfirmedLabel"),  color: "#2eb460" },
    exact:     { label: t("g61ExactLabel"),      color: "var(--accent)" },
    fuzzy:     { label: t("g61FuzzyLabel"),      color: "#7eb8e0" },
    conflict:  { label: t("g61ConflictLabel"),   color: "#e07b39" },
    ambiguous: { label: t("g61AmbiguousLabel"),  color: "#c9a84c" },
    no_match:  { label: t("g61NoMatchLabel"),    color: "var(--text-dim)" },
  };

  return (
    <AdminDemoShell activeTab="garage61">
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Controls */}
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-secondary">{t("g61RefreshBtn")}</button>
        <span style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>{t("g61LastDetection")} 02/06/2026 à 10:14</span>
        <button className="btn btn-primary">{t("g61ApplyExact", { count: 1 })}</button>
      </div>

      {/* Detection account */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <span style={{ fontSize: "0.78rem", color: "var(--text-dim)", whiteSpace: "nowrap" }}>{t("g61DetectionAccount")}</span>
        <select style={{ fontSize: "0.82rem", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "3px", color: "var(--text)", padding: "0.25rem 0.5rem" }}>
          <option>Raphaël Laurent</option>
        </select>
        <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>{t("g61AccountHint")}</span>
      </div>

      {/* Warning summary */}
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <div style={{ fontSize: "0.82rem", color: "#e07b39" }}>{t("g61ConflictWarning", { count: 0 })}</div>
        <div style={{ fontSize: "0.82rem", color: "#c9a84c" }}>{t("g61AmbiguousWarning", { count: 1 })}</div>
      </div>

      {/* Table */}
      <div>
        <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--text-dim)", marginBottom: "0.5rem" }}>
          {t("g61DetectedTitle", { count: ROWS.length })}
        </div>
        <div className="table-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>{t("g61ColG61Name")}</th>
                <th style={thStyle}>{t("g61ColSlug")}</th>
                <th style={thStyle}>{t("g61ColDbDriver")}</th>
                <th style={thStyle}>{t("g61ColStatus")}</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => {
                const meta = STATUS_META[r.status];
                return (
                  <tr key={r.g61}>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{r.g61}</td>
                    <td className="mono" style={{ ...tdStyle, fontSize: "0.78rem", color: "var(--text-dim)" }}>{r.slug}</td>
                    <td style={tdStyle}>{r.db}</td>
                    <td style={{ ...tdStyle, fontWeight: 600, color: meta.color }}>{meta.label}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {r.status === "exact" && <button className="btn btn-secondary btn-sm">{t("g61LinkBtn")}</button>}
                      {(r.status === "fuzzy" || r.status === "ambiguous") && <button className="btn btn-secondary btn-sm">{t("g61AssignTo")}</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    </AdminDemoShell>
  );
}
