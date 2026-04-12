"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser as supabase } from "../../../lib/supabase-browser";

export default function NouveauChampionnat() {
  const router = useRouter();

  const [form, setForm] = useState({ name: "", season: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Auth checked client-side — redirects non-admins before rendering the form.
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.push("/login");
        return;
      }
      const { data: driver } = await supabase
        .from("drivers")
        .select("role")
        .eq("auth_user_id", user.id)
        .single();
      if (
        !driver ||
        (driver.role !== "admin" && driver.role !== "super_admin")
      ) {
        router.push("/");
        return;
      }
      setAuthChecked(true);
    });
  }, []);

  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Le nom est obligatoire.");
      return;
    }
    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase
      .from("championships")
      .insert([{ name: form.name.trim(), season: form.season.trim() || null }])
      .select()
      .single();

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    router.push("/evenements");
    router.refresh();
  };

  if (!authChecked)
    return (
      <div className="page">
        <p style={{ color: "var(--text-dim)" }}>Vérification des droits…</p>
      </div>
    );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Nouveau championnat</h1>
          <div className="accent-line" />
        </div>
        <Link href="/evenements" className="btn btn-secondary">
          ← Retour
        </Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <h3 style={{ marginBottom: "1.25rem", color: "var(--text-dim)" }}>
            Informations
          </h3>
          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="name">Nom du championnat *</label>
              <input
                id="name"
                type="text"
                value={form.name}
                onChange={set("name")}
                placeholder="ex : NEC Endurance Series"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="season">Saison</label>
              <input
                id="season"
                type="text"
                value={form.season}
                onChange={set("season")}
                placeholder="ex : 2026 Saison 1"
              />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Enregistrement…" : "✓ Créer le championnat"}
          </button>
          <Link href="/evenements" className="btn btn-secondary">
            Annuler
          </Link>
        </div>
      </form>
    </div>
  );
}
