"use client";
import { useState, Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser as supabase } from "../../lib/supabase-browser";
import Link from "next/link";

function RegisterForm() {
  const router = useRouter();

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
    if (!form.name.trim()) {
      setError("Le nom est obligatoire.");
      return;
    }
    if (!form.email.trim()) {
      setError("L'email est obligatoire.");
      return;
    }
    if (!form.password) {
      setError("Le mot de passe est obligatoire.");
      return;
    }
    if (form.password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (form.password !== form.confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    setError(null);

    // Step 1 — Create Supabase auth user.
    // This sends a confirmation email. The user has no active session yet
    // (auth.uid() is null until email is confirmed), which is why we cannot
    // insert the driver record from the client side (RLS would block it).
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authErr) {
      if (
        authErr.message.includes("already registered") ||
        authErr.message.includes("User already registered")
      ) {
        setError(
          "Cette adresse email est déjà utilisée. Essayez de vous connecter.",
        );
      } else if (authErr.message.includes("invalid email")) {
        setError("Adresse email invalide.");
      } else if (authErr.message.includes("Password should be")) {
        setError("Le mot de passe doit contenir au moins 8 caractères.");
      } else if (authErr.message.includes("rate limit")) {
        setError(
          "Trop de tentatives. Attendez quelques minutes avant de réessayer.",
        );
      } else {
        setError(`Erreur lors de la création du compte : ${authErr.message}`);
      }
      setLoading(false);
      return;
    }

    // Step 2 — Create the driver record via a server-side API route.
    // The route uses the service role key to bypass RLS, since the user
    // has no active session yet at this point in the registration flow.
    const driverRes = await fetch("/api/register-driver", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        email: form.email.trim(),
        iracing_id: form.iracing_id.trim() || null,
        discord: form.discord.trim() || null,
        auth_user_id: authData.user?.id,
      }),
    });

    if (!driverRes.ok) {
      const { error: driverErr } = await driverRes.json();
      // Show the explicit message returned by the API route
      setError(driverErr || "Erreur lors de la création du profil pilote.");
      setLoading(false);
      return;
    }

    // Step 3 — Notify all admins by email — fire-and-forget.
    // We don't await this or surface errors to the user:
    // a failed notification must never block a successful registration.
    fetch("/api/notify-admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        email: form.email.trim(),
      }),
    }).catch((err) =>
      console.error("[register] Admin notification failed:", err.message),
    );

    // Show confirmation screen — user must verify email AND wait for admin approval.
    setSent(true);
    setLoading(false);
  };

  if (sent) {
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
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>📧</div>
            <h2 style={{ marginBottom: "0.75rem" }}>Vérifiez votre email</h2>
            <p
              style={{
                color: "var(--text-dim)",
                fontSize: "0.9rem",
                lineHeight: 1.6,
              }}
            >
              Un email de confirmation a été envoyé à{" "}
              <strong style={{ color: "var(--text)" }}>{form.email}</strong>.
              Cliquez sur le lien pour confirmer votre adresse, puis attendez
              l&apos;activation de votre compte par un administrateur.
            </p>
          </div>
        </div>
      </div>
    );
  }

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
      <div style={{ width: "100%", maxWidth: "480px" }}>
        {/* Logo */}
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
          <h2 style={{ marginBottom: "0.5rem" }}>Inscription</h2>
          <p
            style={{
              color: "var(--text-dim)",
              fontSize: "0.85rem",
              marginBottom: "1.5rem",
            }}
          >
            Votre compte sera activé par un administrateur après vérification.
          </p>

          {error && (
            <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-grid" style={{ marginBottom: "1rem" }}>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label>Nom complet *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={set("name")}
                  placeholder="Prénom Nom"
                  autoFocus
                  required
                  autoComplete="name"
                />
              </div>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label>Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                  placeholder="votre@email.com"
                  required
                  autoComplete="email"
                />
              </div>
              <div className="form-group">
                <label>Mot de passe * (min. 8 caractères)</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={set("password")}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </div>
              <div className="form-group">
                <label>Confirmer le mot de passe *</label>
                <input
                  type="password"
                  value={form.confirm}
                  onChange={set("confirm")}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                />
              </div>
              <div className="form-group">
                <label>iRacing ID</label>
                <input
                  type="text"
                  value={form.iracing_id}
                  onChange={set("iracing_id")}
                  placeholder="ex : 123456"
                />
              </div>
              <div className="form-group">
                <label>Discord</label>
                <input
                  type="text"
                  value={form.discord}
                  onChange={set("discord")}
                  placeholder="ex : username"
                />
              </div>
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: "100%", marginBottom: "1rem" }}
            >
              {loading ? "Création…" : "Créer mon compte"}
            </button>
          </form>

          <div style={{ textAlign: "center", fontSize: "0.82rem" }}>
            <Link href="/login" style={{ color: "var(--text-dim)" }}>
              Déjà un compte ? Se connecter
            </Link>
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
