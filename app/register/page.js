"use client";
import { useState, Suspense, useEffect } from "react";
import { supabaseBrowser as supabase } from "../../lib/supabase-browser";
import Link from "next/link";
import { useTranslations } from "next-intl";

function RegisterForm() {
  const t = useTranslations("register");

  const [theme, setTheme] = useState("dark");
  useEffect(() => {
    const saved = localStorage.getItem("theme") || "dark";
    setTheme(saved);
  }, []);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
    iracing_id: "",
    discord: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError(t("errorNameRequired")); return; }
    if (!form.email.trim()) { setError(t("errorEmailRequired")); return; }
    if (!form.password) { setError(t("errorPasswordRequired")); return; }
    if (form.password.length < 8) { setError(t("errorPasswordLength")); return; }
    if (form.password !== form.confirm) { setError(t("errorPasswordMatch")); return; }

    setLoading(true);
    setError(null);

    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    if (authErr) {
      if (authErr.message.includes("already registered") || authErr.message.includes("User already registered")) {
        setError(t("errorEmailTaken"));
      } else if (authErr.message.includes("invalid email")) {
        setError(t("errorEmailInvalid"));
      } else if (authErr.message.includes("Password should be")) {
        setError(t("errorPasswordLength"));
      } else if (authErr.message.includes("rate limit")) {
        setError(t("errorRateLimit"));
      } else {
        setError(t("errorCreateAccount", { message: authErr.message }));
      }
      setLoading(false);
      return;
    }

    const authUserId = authData?.user?.id;
    if (!authUserId) {
      setError(t("errorMissingId"));
      setLoading(false);
      return;
    }

    const driverRes = await fetch("/api/register-driver", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        email: form.email.trim(),
        iracing_id: form.iracing_id.trim() || null,
        discord: form.discord.trim() || null,
        auth_user_id: authUserId,
      }),
    });

    const driverBody = await driverRes.json();
    if (!driverRes.ok) {
      setError(driverBody.error || t("errorCreateDriver"));
      setLoading(false);
      return;
    }

    fetch("/api/notify-admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name.trim(), email: form.email.trim() }),
    }).catch((err) =>
      console.error("[register] Admin notification failed:", err.message),
    );

    setSent(true);
    setLoading(false);
  };

  const logoSrc = theme === "dark" ? "/kronos-logo-text.png" : "/kronos-logo-light.png";

  if (sent) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: "1.5rem" }}>
        <div style={{ width: "100%", maxWidth: "400px" }}>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>📧</div>
            <h2 style={{ marginBottom: "0.75rem" }}>{t("successTitle")}</h2>
            <p style={{ color: "var(--text-dim)", fontSize: "0.9rem", lineHeight: 1.6 }}>
              {t("successBody", { email: form.email })}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: "1.5rem" }}>
      <div style={{ width: "100%", maxWidth: "480px" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <img src={logoSrc} alt="Kronos SimSports" style={{ height: "56px", objectFit: "contain", display: "block", margin: "0 auto" }} />
        </div>

        <div className="card">
          <h2 style={{ marginBottom: "0.5rem" }}>{t("title")}</h2>
          <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
            {t("subtitle")}
          </p>

          {error && (
            <div className="alert alert-error" style={{ marginBottom: "1rem" }}>{error}</div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-grid" style={{ marginBottom: "1rem" }}>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label>{t("nameLabel")}</label>
                <input type="text" value={form.name} onChange={set("name")} placeholder={t("namePlaceholder")} autoFocus required autoComplete="name" />
              </div>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label>{t("emailLabel")}</label>
                <input type="email" value={form.email} onChange={set("email")} placeholder={t("emailPlaceholder")} required autoComplete="email" />
              </div>
              <div className="form-group">
                <label>{t("passwordLabel")}</label>
                <input type="password" value={form.password} onChange={set("password")} placeholder={t("passwordPlaceholder")} autoComplete="new-password" />
              </div>
              <div className="form-group">
                <label>{t("confirmLabel")}</label>
                <input type="password" value={form.confirm} onChange={set("confirm")} placeholder={t("passwordPlaceholder")} required autoComplete="new-password" />
              </div>
              <div className="form-group">
                <label>{t("iracingLabel")}</label>
                <input type="text" value={form.iracing_id} onChange={set("iracing_id")} placeholder={t("iracingPlaceholder")} />
              </div>
              <div className="form-group">
                <label>{t("discordLabel")}</label>
                <input type="text" value={form.discord} onChange={set("discord")} placeholder={t("discordPlaceholder")} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: "100%", marginBottom: "1rem" }}>
              {loading ? t("submitting") : t("submit")}
            </button>
          </form>

          <div style={{ textAlign: "center", fontSize: "0.82rem" }}>
            <Link href="/login" style={{ color: "var(--text-dim)" }}>{t("alreadyAccount")}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
