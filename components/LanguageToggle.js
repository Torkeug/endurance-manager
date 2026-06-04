"use client";
import { useLocale } from "next-intl";

export default function LanguageToggle() {
  const locale = useLocale();

  function switchLocale() {
    const next = locale === "fr" ? "en" : "fr";
    document.cookie = `KRONOS_LOCALE=${next};path=/;max-age=31536000;SameSite=Lax`;
    window.location.reload();
  }

  return (
    <button
      onClick={switchLocale}
      className="btn btn-secondary btn-sm"
      title={locale === "fr" ? "Switch to English" : "Passer en français"}
      style={{ fontWeight: 700, letterSpacing: "0.04em", minWidth: "2.5rem" }}
    >
      {locale === "fr" ? "EN" : "FR"}
    </button>
  );
}
