"use client";
import { useState, useEffect } from "react";
import { supabaseBrowser as supabase } from "../../lib/supabase-browser";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ChangePasswordPage() {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [theme, setTheme] = useState("dark");
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem("theme") || "dark";
    setTheme(saved);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!current) {
      setError("Le mot de passe actuel est obligatoire.");
      return;
    }
    if (!password) {
      setError("Le nouveau mot de passe est obligatoire.");
      return;
    }
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    if (password === current) {
      setError("Le nouveau mot de passe doit être différent de l'actuel.");
      return;
    }

    setLoading(true);
    setError(null);

    // Re-authenticate with current password
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    // Re-authenticate with current password before allowing the change —
    // ensures the logged-in user knows their current password (guards against session hijacking).
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: current,
    });

    if (signInErr) {
      setError("Mot de passe actuel incorrect.");
      setLoading(false);
      return;
    }

    // Update to new password
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
    // Redirect back to previous page after 2 seconds on success.
    setTimeout(() => router.back(), 2000);
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
          {success ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>✅</div>
              <h2 style={{ marginBottom: "0.75rem" }}>Mot de passe modifié</h2>
              <p style={{ color: "var(--text-dim)", fontSize: "0.9rem" }}>
                Redirection en cours…
              </p>
            </div>
          ) : (
            <>
              <h2 style={{ marginBottom: "0.5rem" }}>
                Changer mon mot de passe
              </h2>
              <p
                style={{
                  color: "var(--text-dim)",
                  fontSize: "0.85rem",
                  marginBottom: "1.5rem",
                }}
              >
                Saisissez votre mot de passe actuel puis le nouveau.
              </p>

              {error && (
                <div
                  className="alert alert-error"
                  style={{ marginBottom: "1rem" }}
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label>Mot de passe actuel</label>
                  <input
                    type="password"
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label>Nouveau mot de passe (min. 8 caractères)</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: "1.5rem" }}>
                  <label>Confirmer le nouveau mot de passe</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                  style={{ width: "100%", marginBottom: "1rem" }}
                >
                  {loading ? "Modification…" : "Changer le mot de passe"}
                </button>
              </form>
              <div style={{ textAlign: "center" }}>
                <Link
                  href="/login"
                  style={{ fontSize: "0.82rem", color: "var(--text-dim)" }}
                  onClick={(e) => {
                    e.preventDefault();
                    router.back();
                  }}
                >
                  ← Retour
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
