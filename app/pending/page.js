"use client";
import { supabaseBrowser as supabase } from "../../lib/supabase-browser";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function PendingPage() {
  const router = useRouter();

  const [theme, setTheme] = useState("dark");
  useEffect(() => {
    const saved = localStorage.getItem("theme") || "dark";
    setTheme(saved);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  useEffect(() => {
    const check = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: driver } = await supabase
        .from("drivers")
        .select("approved")
        .eq("auth_user_id", user.id)
        .single();
      if (driver?.approved) {
        router.push("/");
        router.refresh();
      }
    };

    // Poll every 10 seconds to detect when an admin approves the account.
    // Redirects to home automatically so the user doesn't need to refresh manually.
    check();
    const interval = setInterval(check, 10000);
    // Clear interval on unmount to avoid memory leaks and unnecessary requests.
    return () => clearInterval(interval);
  }, []);

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

        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⏳</div>
          <h2 style={{ marginBottom: "0.75rem" }}>
            En attente d&apos;approbation
          </h2>
          <p
            style={{
              color: "var(--text-dim)",
              fontSize: "0.9rem",
              lineHeight: 1.6,
              marginBottom: "0.75rem",
            }}
          >
            Votre profil a été créé et est en attente de validation par un
            administrateur Kronos SimSports.
          </p>
          <p
            style={{
              color: "var(--text-dim)",
              fontSize: "0.85rem",
              lineHeight: 1.6,
              marginBottom: "0.75rem",
            }}
          >
            Vous recevrez un email dès que votre compte sera approuvé. Cette
            page se met à jour automatiquement — pas besoin de rafraîchir.
          </p>
          <p
            style={{
              color: "var(--text-dim)",
              fontSize: "0.85rem",
              lineHeight: 1.6,
              marginBottom: "1.5rem",
            }}
          >
            En attendant, vous pouvez contacter un administrateur sur Discord
            pour accélérer la validation.
          </p>
          <button onClick={handleLogout} className="btn btn-secondary">
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}
