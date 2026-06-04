"use client";
import { useLocale } from "next-intl";

const LOCALES = [
  { code: "fr", flag: "🇫🇷", label: "FR" },
  { code: "en", flag: "🇬🇧", label: "EN" },
];

export default function LanguageToggle() {
  const locale = useLocale();

  function handleChange(e) {
    const next = e.target.value;
    if (next === locale) return;
    document.cookie = `KRONOS_LOCALE=${next};path=/;max-age=31536000;SameSite=Lax`;
    window.location.reload();
  }

  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <span
        style={{
          position: "absolute",
          left: "0.45rem",
          fontSize: "1rem",
          lineHeight: 1,
          pointerEvents: "none",
        }}
      >
        {current.flag}
      </span>
      <select
        value={locale}
        onChange={handleChange}
        style={{
          paddingLeft: "1.75rem",
          paddingRight: "0.5rem",
          paddingTop: "0.2rem",
          paddingBottom: "0.2rem",
          fontSize: "0.78rem",
          fontWeight: 700,
          letterSpacing: "0.04em",
          background: "var(--surface-2)",
          color: "var(--text)",
          border: "1px solid var(--border)",
          borderRadius: "3px",
          cursor: "pointer",
          appearance: "none",
          WebkitAppearance: "none",
        }}
      >
        {LOCALES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </div>
  );
}
