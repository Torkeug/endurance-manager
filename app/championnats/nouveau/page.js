"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { supabaseBrowser as supabase } from "../../../lib/supabase-browser";

export default function NouveauChampionnat() {
  const router = useRouter();

  const [form, setForm] = useState({ name: "", season: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const t = useTranslations("championshipEdit");

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
      setError(t("errorName"));
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
        <p style={{ color: "var(--text-dim)" }}>{t("checkingAuth")}</p>
      </div>
    );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{t("titleNew")}</h1>
          <div className="accent-line" />
        </div>
        <Link href="/evenements" className="btn btn-secondary">
          {t("back")}
        </Link>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <h3 style={{ marginBottom: "1.25rem", color: "var(--text-dim)" }}>
            {t("sectionGeneral")}
          </h3>
          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="name">{t("labelName")}</label>
              <input
                id="name"
                type="text"
                value={form.name}
                onChange={set("name")}
                placeholder={t("placeholderName")}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="season">{t("labelSeason")}</label>
              <input
                id="season"
                type="text"
                value={form.season}
                onChange={set("season")}
                placeholder={t("placeholderSeason")}
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
            {error}
          </div>
        )}
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? t("saving") : t("submitCreate")}
          </button>
          <Link href="/evenements" className="btn btn-secondary">
            {t("cancel")}
          </Link>
        </div>
      </form>
    </div>
  );
}
