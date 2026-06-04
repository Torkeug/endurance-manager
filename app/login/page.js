"use client";
import { useState, Suspense, useEffect } from "react";
import { supabaseBrowser as supabase } from "../../lib/supabase-browser";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");
  const [theme, setTheme] = useState("dark");
  const t = useTranslations("login");

  useEffect(() => {
    const saved = localStorage.getItem("theme") || "dark";
    setTheme(saved);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError(t("errorRequired"));
      return;
    }
    setLoading(true);
    setError(null);

    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (err) {
      if (err.message.includes("Invalid login credentials")) {
        setError(t("errorInvalid"));
      } else if (err.message.includes("Email not confirmed")) {
        setError(t("errorNotConfirmed"));
      } else {
        setError(err.message);
      }
      setLoading(false);
      return;
    }

    // Use window.location.href instead of router.push to force a full page reload —
    // this ensures the auth session cookie is picked up by the middleware immediately.
    window.location.href = "/";
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        padding: "1.5rem",
      }}
    >
      <div style={{ width: "100%", maxWidth: "400px" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <img
            src={
              theme === "dark"
                ? "/kronos-logo-text.png"
                : "/kronos-logo-light.png"
            }
            alt="Kronos SimSports"
            style={{
              height: "56px",
              objectFit: "contain",
              display: "block",
              margin: "0 auto",
            }}
          />
        </div>

        <div className="card">
          <h2 style={{ marginBottom: "0.5rem" }}>{t("title")}</h2>
          <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
            {t("subtitle")}
          </p>

          {error && (
            <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
              {error}
            </div>
          )}
          {urlError === "link_expired" && (
            <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
              {t("errorLinkExpired")}
            </div>
          )}
          {urlError === "auth" && (
            <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
              {t("errorAuth")}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: "1rem" }}>
              <label htmlFor="email">{t("emailLabel")}</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("emailPlaceholder")}
                autoFocus
                required
                autoComplete="email"
              />
            </div>
            <div className="form-group" style={{ marginBottom: "1.5rem" }}>
              <label htmlFor="password">{t("passwordLabel")}</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("passwordPlaceholder")}
                required
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: "100%", marginBottom: "1rem" }}
            >
              {loading ? t("submitting") : t("submit")}
            </button>
          </form>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
            <Link href="/register" style={{ color: "var(--text-dim)" }}>
              {t("createAccount")}
            </Link>
            <Link href="/reset-password" style={{ color: "var(--text-dim)" }}>
              {t("forgotPassword")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
