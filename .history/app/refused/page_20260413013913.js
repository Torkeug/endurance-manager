"use client";
import { supabaseBrowser as supabase } from "../../lib/supabase-browser";
import { useRouter } from "next/navigation";

export default function RefusedPage() {
  const router = useRouter();
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
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
      <div style={{ width: "100%", maxWidth: "400px", textAlign: "center" }}>
        <div className="card">
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🚫</div>
          <h2 style={{ marginBottom: "0.75rem" }}>Accès refusé</h2>
          <p
            style={{
              color: "var(--text-dim)",
              fontSize: "0.9rem",
              lineHeight: 1.6,
              marginBottom: "1.5rem",
            }}
          >
            Votre demande d&apos;accès a été refusée. Contactez un
            administrateur si vous pensez qu&apos;il s&apos;agit d&apos;une
            erreur.
          </p>
          <button onClick={handleLogout} className="btn btn-secondary">
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}
