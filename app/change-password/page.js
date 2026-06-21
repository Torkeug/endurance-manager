"use client";
import { useState, useEffect } from "react";
import { supabaseBrowser as supabase } from "../../lib/supabase-browser";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function ChangePasswordPage() {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [theme] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("theme") || "dark" : "dark"
  );
  const router = useRouter();
  const t = useTranslations("changePassword");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!current) { setError(t("errorCurrentRequired")); return; }
    if (!password) { setError(t("errorNewRequired")); return; }
    if (password.length < 8) { setError(t("errorLength")); return; }
    if (password !== confirm) { setError(t("errorMatch")); return; }
    if (password === current) { setError(t("errorSame")); return; }

    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    // Re-authenticate with current password before allowing the change —
    // ensures the logged-in user knows their current password (guards against session hijacking).
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: current,
    });
    if (signInErr) { setError(t("errorCurrentWrong")); setLoading(false); return; }

    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) { setError(err.message); setLoading(false); return; }

    setSuccess(true);
    setLoading(false);
  };

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => router.back(), 2000);
    return () => clearTimeout(timer);
  }, [success, router]);

  const logoSrc = theme === "dark" ? "/kronos-logo-text.png" : "/kronos-logo-light.png";

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: "1.5rem" }}>
      <div style={{ width: "100%", maxWidth: "400px" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <img src={logoSrc} alt="Kronos SimSports" style={{ height: "56px", objectFit: "contain", display: "block", margin: "0 auto" }} />
        </div>

        <div className="card">
          {success ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>✅</div>
              <h2 style={{ marginBottom: "0.75rem" }}>{t("successTitle")}</h2>
              <p style={{ color: "var(--text-dim)", fontSize: "0.9rem" }}>{t("successBody")}</p>
            </div>
          ) : (
            <>
              <h2 style={{ marginBottom: "0.5rem" }}>{t("title")}</h2>
              <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", marginBottom: "1.5rem" }}>{t("subtitle")}</p>

              {error && <div className="alert alert-error" style={{ marginBottom: "1rem" }}>{error}</div>}

              <form onSubmit={handleSubmit}>
                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label>{t("currentLabel")}</label>
                  <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder={t("passwordPlaceholder")} autoComplete="current-password" required />
                </div>
                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label>{t("passwordLabel")}</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("passwordPlaceholder")} autoComplete="new-password" required />
                </div>
                <div className="form-group" style={{ marginBottom: "1.5rem" }}>
                  <label>{t("confirmLabel")}</label>
                  <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={t("passwordPlaceholder")} autoComplete="new-password" required />
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: "100%", marginBottom: "1rem" }}>
                  {loading ? t("submitting") : t("submit")}
                </button>
              </form>
              <div style={{ textAlign: "center" }}>
                <Link href="/login" style={{ fontSize: "0.82rem", color: "var(--text-dim)" }} onClick={(e) => { e.preventDefault(); router.back(); }}>
                  {t("back")}
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
