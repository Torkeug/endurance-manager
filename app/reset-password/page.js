"use client";
import { useState } from "react";
import { supabaseBrowser as supabase } from "../../lib/supabase-browser";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [theme] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("theme") || "dark" : "dark"
  );
  const t = useTranslations("resetPassword");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) { setError(t("errorEmpty")); return; }
    setLoading(true);
    setError(null);

    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
    });

    if (err) {
      if (err.message.includes("rate limit") || err.message.includes("Email rate limit")) {
        setError(t("errorRateLimit"));
      } else {
        setError(err.message);
      }
      setLoading(false);
      return;
    }
    setSent(true);
    setLoading(false);
  };

  const logoSrc = theme === "dark" ? "/kronos-logo-text.png" : "/kronos-logo-light.png";

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: "1.5rem" }}>
      <div style={{ width: "100%", maxWidth: "400px" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <img src={logoSrc} alt="Kronos SimSports" style={{ height: "56px", objectFit: "contain", display: "block", margin: "0 auto" }} />
        </div>

        <div className="card">
          {sent ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>📧</div>
              <h2 style={{ marginBottom: "0.75rem" }}>{t("sentTitle")}</h2>
              {/* Success message is intentionally vague — doesn't confirm whether the email exists.
              This prevents email enumeration attacks. */}
              <p style={{ color: "var(--text-dim)", fontSize: "0.9rem", lineHeight: 1.6 }}>
                {t("sentBody", { email })}
              </p>
              <Link href="/login" className="btn btn-secondary" style={{ marginTop: "1.5rem", display: "inline-block" }}>
                {t("sentBack")}
              </Link>
            </div>
          ) : (
            <>
              <h2 style={{ marginBottom: "0.5rem" }}>{t("title")}</h2>
              <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
                {t("subtitle")}
              </p>
              {error && (
                <div className="alert alert-error" style={{ marginBottom: "1rem" }}>{error}</div>
              )}
              <form onSubmit={handleSubmit}>
                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label>{t("emailLabel")}</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("emailPlaceholder")}
                    autoFocus
                    required
                    autoComplete="email"
                  />
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: "100%", marginBottom: "1rem" }}>
                  {loading ? t("submitting") : t("submit")}
                </button>
              </form>
              <div style={{ textAlign: "center", fontSize: "0.82rem" }}>
                <Link href="/login" style={{ color: "var(--text-dim)" }}>{t("backToLogin")}</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
