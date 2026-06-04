"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser as supabase } from "../../../lib/supabase-browser";
import { useTranslations } from "next-intl";

const emptyForm = {
  name: "",
  iracing_id: "",
  irating: "",
  discord: "",
  twitch: "",
  instagram: "",
};

export default function NouveauPilote() {
  const router = useRouter();
  const t = useTranslations("driverForm");
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [authChecked, setAuthChecked] = useState(false);

  // Auth check — only admins can add drivers manually.
  // Drivers added this way won't have a Supabase Auth account until they register.
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
      setError(t("errorNameRequired"));
      return;
    }

    setLoading(true);

    // Check for duplicate name and iRacing ID before inserting.
    // Client-side checks for friendlier error messages than DB constraint errors.
    const { data: sameName } = await supabase
      .from("drivers")
      .select("id")
      .ilike("name", form.name.trim())
      .single();
    if (sameName) {
      setError(t("errorNameDuplicate", { name: form.name.trim() }));
      setLoading(false);
      return;
    }

    // Check duplicate iRacing ID
    if (form.iracing_id.trim()) {
      const { data: sameId } = await supabase
        .from("drivers")
        .select("id, name")
        .eq("iracing_id", form.iracing_id.trim())
        .single();
      if (sameId) {
        setError(t("errorIRacingIdDuplicate", { name: sameId.name }));
        setLoading(false);
        return;
      }
    }

    setError(null);

    const payload = {
      name: form.name.trim(),
      iracing_id: form.iracing_id.trim() || null,
      irating: form.irating ? parseInt(form.irating) : null,
      discord: form.discord.trim() || null,
      twitch: form.twitch.trim() || null,
      instagram: form.instagram.trim() || null,
    };

    const { error: err } = await supabase.from("drivers").insert([payload]);

    if (err) {
      setError(err.message);
      setLoading(false);
    } else {
      router.push("/pilotes");
      router.refresh();
    }
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
        <Link href="/pilotes" className="btn btn-secondary">
          {t("back")}
        </Link>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ marginBottom: "1.5rem" }}>
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
              <label htmlFor="iracing_id">{t("labelIRacingId")}</label>
              <input
                id="iracing_id"
                type="text"
                value={form.iracing_id}
                onChange={set("iracing_id")}
                placeholder={t("placeholderIRacingId")}
              />
            </div>

            <div className="form-group">
              <label htmlFor="irating">{t("labelIRating")}</label>
              <input
                id="irating"
                type="number"
                value={form.irating}
                onChange={set("irating")}
                placeholder={t("placeholderIRating")}
                min="0"
                max="9999"
              />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ marginBottom: "1.25rem", color: "var(--text-dim)" }}>
            {t("sectionSocial")}
          </h3>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="discord">{t("labelDiscord")}</label>
              <input
                id="discord"
                type="text"
                value={form.discord}
                onChange={set("discord")}
                placeholder={t("placeholderDiscord")}
              />
            </div>

            <div className="form-group">
              <label htmlFor="twitch">{t("labelTwitch")}</label>
              <input
                id="twitch"
                type="text"
                value={form.twitch}
                onChange={set("twitch")}
                placeholder={t("placeholderTwitch")}
              />
            </div>

            <div className="form-group">
              <label htmlFor="instagram">{t("labelInstagram")}</label>
              <input
                id="instagram"
                type="text"
                value={form.instagram}
                onChange={set("instagram")}
                placeholder={t("placeholderInstagram")}
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
            {loading ? t("saving") : t("submitNew")}
          </button>
          <Link href="/pilotes" className="btn btn-secondary">
            {t("cancel")}
          </Link>
        </div>
      </form>
    </div>
  );
}
