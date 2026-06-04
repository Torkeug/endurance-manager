"use client";
import { useLocale } from "next-intl";

export default function LanguageToggle() {
  const locale = useLocale();

  function switchLocale() {
    const next = locale === "fr" ? "en" : "fr";
    document.cookie = `KRONOS_LOCALE=${next};path=/;max-age=31536000;SameSite=Lax`;
    window.location.reload();
  }

  const flag = locale === "fr" ? "🇫🇷" : "🇬🇧";
  const label = locale === "fr" ? "FR" : "EN";
  const switchTitle = locale === "fr" ? "Switch to English" : "Passer en français";

  return (
    <button
      onClick={switchLocale}
      className="btn btn-secondary btn-sm"
      title={switchTitle}
      style={{ fontWeight: 700, letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: "0.3rem" }}
    >
      <span style={{ fontSize: "1rem", lineHeight: 1 }}>{flag}</span>
      <span>{label}</span>
    </button>
  );
}
