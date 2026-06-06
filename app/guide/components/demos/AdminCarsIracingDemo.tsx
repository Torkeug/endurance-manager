import AdminDemoShell from "./AdminDemoShell";
import { useTranslations } from "next-intl";

const TH = {
  background: "var(--surface-2)", color: "var(--text-dim)", fontSize: "0.72rem", fontWeight: 700,
  letterSpacing: "0.08em", textTransform: "uppercase" as const, padding: "0.6rem 1rem",
  textAlign: "left" as const, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" as const,
};
const TD = { padding: "0.6rem 1rem", borderBottom: "1px solid var(--border)", verticalAlign: "middle" as const };

const IRACING_CARS = [
  { name: "Audi R8 LMS GT3 EVO II",  tags: ["gt3", "road"],       label: "gt3" },
  { name: "Ferrari 296 GT3",           tags: ["gt3", "road"],       label: "gt3" },
  { name: "Ferrari 499P",              tags: ["lmp1", "road"],      label: "gtp" },
  { name: "Dallara P217 LMP2",         tags: ["lmp2", "road"],      label: null  },
  { name: "Porsche 911 GT3 R (992)",   tags: ["gt3", "road"],       label: "gt3" },
];

export default function AdminCarsIracingDemo() {
  const t = useTranslations("admin");
  return (
    <AdminDemoShell activeTab="voitures">
    <div>
      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: "0.25rem", borderBottom: "1px solid var(--border)", marginBottom: "1.5rem" }}>
        {([t("carsTabKronos"), t("carsTabCatalogue")] as const).map((tab, i) => (
          <button key={tab} style={{
            padding: "0.5rem 1.25rem", background: "transparent", border: "none",
            borderBottom: i === 1 ? "2px solid var(--accent)" : "2px solid transparent",
            color: i === 1 ? "var(--accent)" : "var(--text-dim)",
            fontFamily: "var(--font-rajdhani),sans-serif", fontSize: "0.85rem",
            fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const,
            cursor: "default", marginBottom: "-1px",
          }}>{tab}</button>
        ))}
      </div>

      <p style={{ fontSize: "0.82rem", color: "var(--text-dim)", marginBottom: "1rem" }}>
        {t("carsCatalogueHint")}
      </p>

      <div style={{ marginBottom: "1rem", maxWidth: "400px" }}>
        <input readOnly placeholder={t("carsCatalogueSearch")} style={{ width: "100%", padding: "0.4rem 0.6rem", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "3px", color: "var(--text-dim)", fontSize: "0.88rem" }} />
      </div>

      <div className="table-wrap">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={TH}>{t("carsColIracingCar")}</th>
              <th style={TH}>{t("carsColIracingTags")}</th>
              <th style={TH}>{t("carsColInventoryLabel")}</th>
              <th style={TH} />
            </tr>
          </thead>
          <tbody>
            {IRACING_CARS.map((car) => (
              <tr key={car.name}>
                <td style={{ ...TD, fontWeight: 600, fontSize: "0.85rem" }}>{car.name}</td>
                <td style={TD}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                    {car.tags.map((tag) => (
                      <span key={tag} className="mono" style={{ fontSize: "0.68rem", color: "var(--text-dim)", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "3px", padding: "0.1rem 0.35rem" }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </td>
                <td style={TD}>
                  {car.label
                    ? <span className="mono" style={{ fontSize: "0.82rem", color: "var(--accent)", fontWeight: 700 }}>{car.label.toUpperCase()}</span>
                    : <span style={{ color: "var(--text-dim)", fontSize: "0.78rem" }}>—</span>}
                </td>
                <td style={{ ...TD, textAlign: "right" }}>
                  <button className="btn btn-secondary btn-sm">{t("carsEditBtn")}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </AdminDemoShell>
  );
}
