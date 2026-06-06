import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";

const sectionTitle: CSSProperties = {
  fontSize: "0.68rem",
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--text-dim)",
  marginBottom: "1.25rem",
};

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: "3px",
  color: "var(--text)",
  fontSize: "0.88rem",
  padding: "0.55rem 0.75rem",
  fontFamily: "var(--font-rajdhani), sans-serif",
};

const readonlyMono: CSSProperties = {
  ...inputStyle,
  fontFamily: "var(--font-mono), monospace",
  fontSize: "0.9rem",
  color: "var(--accent)",
};

const label: CSSProperties = {
  display: "block",
  fontSize: "0.82rem",
  fontWeight: 600,
  color: "var(--text-dim)",
  marginBottom: "0.3rem",
};

function Field({ lbl, children }: { lbl: string; children: React.ReactNode }) {
  return (
    <div className="form-group">
      <label style={label}>{lbl}</label>
      {children}
    </div>
  );
}

export default function NewEquipageDemo() {
  const t = useTranslations("entryForm");
  const tDrTab = useTranslations("driversTab");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

      {/* ── Équipage & voiture ── */}
      <div className="card">
        <div style={sectionTitle}>{t("sectionEntryInfo")}</div>
        <div className="form-grid">
          <Field lbl={t("labelCrewName")}>
            <div style={{ ...inputStyle, color: "var(--text)" }}>Kronos Alpha</div>
          </Field>
          <Field lbl={t("labelCar")}>
            <div style={{ ...inputStyle, color: "var(--text)" }}>Audi R8 LMS GT3 Evo 2</div>
          </Field>
          <Field lbl={t("labelTank")}>
            <div style={readonlyMono}>120L</div>
          </Field>
          <Field lbl={t("labelClass")}>
            <div style={readonlyMono}>GT3</div>
          </Field>
        </div>
      </div>

      {/* ── Horaire de départ ── */}
      <div className="card">
        <div style={sectionTitle}>{t("labelStartTime")}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {[
            { label: "Vague A", time: "14:00", selected: true },
            { label: "Vague B", time: "20:00", selected: false },
          ].map((st) => (
            <label
              key={st.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.75rem 1rem",
                background: st.selected ? "var(--accent-dim)" : "var(--surface-2)",
                border: `1px solid ${st.selected ? "var(--accent)" : "var(--border)"}`,
                borderRadius: "3px",
                cursor: "default",
              }}
            >
              <input
                type="radio"
                readOnly
                checked={st.selected}
                style={{ accentColor: "var(--accent)", pointerEvents: "none" }}
              />
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{st.label}</div>
                <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.8rem", color: "var(--accent)", marginTop: "0.1rem" }}>
                  {t("startAt")} {st.time}
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* ── Pilotes ── */}
      <div className="card">
        <div style={sectionTitle}>
          {t("sectionDrivers")}{" "}
          <span style={{ fontSize: "0.72rem", fontWeight: 400, color: "var(--accent)", marginLeft: "0.5rem", textTransform: "none", letterSpacing: 0 }}>
            2 sélectionnés
          </span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {[
            { name: "Marc Dubois",   ir: "4 210",  selected: true,  hard: false, soft: false },
            { name: "Léa Fontaine",  ir: "3 880",  selected: true,  hard: false, soft: true  },
            { name: "Théo Bernard",  ir: "5 120",  selected: false, hard: true,  soft: false },
          ].map((d) => (
            <button
              key={d.name}
              type="button"
              className="btn btn-secondary"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: "0.25rem",
                borderColor: d.selected ? "var(--accent)" : d.soft ? "#a06020" : undefined,
                background: d.selected ? "var(--accent-dim)" : undefined,
                cursor: "default",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                {(d.hard || d.soft) && (
                  <span style={{ color: d.hard ? "var(--danger)" : "#d4904a" }}>⚠️</span>
                )}
                <span style={{ fontWeight: 600 }}>{d.selected ? "✓ " : ""}{d.name}</span>
              </span>
              <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.75rem", color: "var(--accent)" }}>
                {d.ir}
              </span>
              {d.hard && (
                <span style={{ fontSize: "0.7rem", padding: "0.15rem 0.4rem", borderRadius: "2px", background: "rgba(224,85,85,0.12)", border: "1px solid var(--danger)", color: "var(--danger)" }}>
                  ⚠️ {tDrTab("conflictClass")}
                </span>
              )}
              {d.soft && (
                <span style={{ fontSize: "0.7rem", padding: "0.15rem 0.4rem", borderRadius: "2px", background: "#2a1a00", border: "1px solid #a06020", color: "#d4904a" }}>
                  ⚠️ {tDrTab("conflictCar")}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Streams Twitch ── */}
      <div className="card">
        <div style={sectionTitle}>{t("sectionStreams")}</div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
          {["kronos_marc"].map((u) => (
            <div key={u} style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.25rem 0.5rem 0.25rem 0.75rem", borderRadius: "3px", background: "rgba(145,71,255,0.12)", border: "1px solid #9147ff" }}>
              <span style={{ color: "#9147ff", fontSize: "0.82rem", fontWeight: 600 }}>{u}</span>
              <span style={{ color: "#9147ff", cursor: "default", fontSize: "0.9rem" }}>×</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 0, display: "flex" }}>
            <span style={{ padding: "0.55rem 0.6rem", background: "var(--surface-2)", border: "1px solid var(--border)", borderRight: "none", borderRadius: "3px 0 0 3px", fontSize: "0.85rem", color: "var(--text-dim)", whiteSpace: "nowrap", fontFamily: "var(--font-mono), monospace", flexShrink: 0 }}>
              twitch.tv/
            </span>
            <div style={{ flex: 1, minWidth: 0, background: "var(--surface-2)", border: "1px solid var(--border)", borderLeft: "none", borderRadius: "0 3px 3px 0", padding: "0.55rem 0.75rem", fontSize: "0.9rem", color: "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {t("streamPlaceholder")}
            </div>
          </div>
          <button className="btn btn-secondary" style={{ whiteSpace: "nowrap", flexShrink: 0 }}>{t("addStream")}</button>
        </div>
      </div>

      {/* ── Paramètres stratégie ── */}
      <div className="card">
        <div style={sectionTitle}>{t("sectionStrategy")}</div>
        <div className="form-grid">
          {[
            { lbl: t("labelBopPower"),   val: "100" },
            { lbl: t("labelBopWeight"),  val: "0"   },
            { lbl: t("labelBopTank"),    val: ""    },
            { lbl: t("labelRefuelTime"), val: "30"  },
            { lbl: t("labelTyreTime"),   val: "0"   },
          ].map(({ lbl, val }) => (
            <Field key={lbl} lbl={lbl}>
              <div style={{ ...inputStyle, fontFamily: "var(--font-mono), monospace", color: val ? "var(--text)" : "var(--text-dim)" }}>
                {val || "—"}
              </div>
            </Field>
          ))}
        </div>
      </div>

      {/* ── Actions ── */}
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button className="btn btn-primary">{t("submitNew")}</button>
        <button className="btn btn-secondary">{t("cancel")}</button>
      </div>
    </div>
  );
}
