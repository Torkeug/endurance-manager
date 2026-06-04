"use client";
import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser as supabase } from "../../../../lib/supabase-browser";
import { useTranslations } from "next-intl";

function ConfirmModal({ modal, onConfirm, onCancel }) {
  const t = useTranslations("driverForm");
  if (!modal) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1.5rem",
      }}
    >
      <div className="card" style={{ maxWidth: "400px", width: "100%" }}>
        <h3 style={{ marginBottom: "0.75rem" }}>{modal.title}</h3>
        <p
          style={{
            fontSize: "0.9rem",
            color: "var(--text-dim)",
            marginBottom: "1.5rem",
          }}
        >
          {modal.message}
        </p>
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
        >
          <button onClick={onConfirm} className="btn btn-danger">
            {modal.confirmLabel || t("confirm")}
          </button>
          <button onClick={onCancel} className="btn btn-secondary">
            {t("modalCancel")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ModifierPilote({ params }) {
  const router = useRouter();
  const { id } = use(params);
  const t = useTranslations("driverForm");

  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);

  const [currentIsAdmin, setCurrentIsAdmin] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.push("/login");
        return;
      }
      const { data: driver } = await supabase
        .from("drivers")
        .select("id, role")
        .eq("auth_user_id", user.id)
        .single();
      if (!driver) {
        router.push("/");
        return;
      }
      const adminCheck =
        driver.role === "admin" || driver.role === "super_admin";
      setCurrentIsAdmin(adminCheck);
      // Admins can edit any driver. Non-admins can only edit their own profile.
      // Redirect if neither condition is met.
      if (!adminCheck && driver.id !== id) {
        router.push("/");
        return;
      }
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    supabase
      .from("drivers")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setError(t("notFound"));
          setFetching(false);
          return;
        }
        setForm({
          name: data.name || "",
          iracing_id: data.iracing_id || "",
          irating: data.irating ?? "",
          discord: data.discord || "",
          twitch: data.twitch || "",
          instagram: data.instagram || "",
          email: data.email || "",
          discord_alerts_enabled: data.discord_alert_enabled ?? false,
          discord_alert_minutes: data.discord_alert_minutes ?? "5",
        });
        setFetching(false);
      });
  }, [id]);

  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError(t("errorNameRequired"));
      return;
    }

    setLoading(true);

    // Check for duplicate name before saving — excludes the current driver
    // so saving without changing the name doesn't trigger a false positive.
    const { data: sameName } = await supabase
      .from("drivers")
      .select("id")
      .ilike("name", form.name.trim())
      .neq("id", id)
      .single();
    if (sameName) {
      setError(t("errorNameDuplicate", { name: form.name.trim() }));
      setLoading(false);
      return;
    }

    // Check duplicate iRacing ID (exclude current driver)
    if (form.iracing_id.trim()) {
      const { data: sameId } = await supabase
        .from("drivers")
        .select("id, name")
        .eq("iracing_id", form.iracing_id.trim())
        .neq("id", id)
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
      discord_alert_enabled: form.discord_alerts_enabled,
      discord_alert_minutes:
        form.discord_alerts_enabled && form.discord_alert_minutes
          ? Math.max(1, parseInt(form.discord_alert_minutes))
          : null,
    };

    const { error: err } = await supabase
      .from("drivers")
      .update(payload)
      .eq("id", id);

    if (err) {
      setError(err.message);
      setLoading(false);
    } else {
      router.push(`/pilotes/${id}`);
      router.refresh();
    }
  };

  const handleDelete = () => {
    setConfirmModal({
      title: t("deleteTitle"),
      message: t("deleteMessage"),
      confirmLabel: t("deleteConfirm"),
      onConfirm: async () => {
        setConfirmModal(null);
        const { error: err } = await supabase
          .from("drivers")
          .delete()
          .eq("id", id);
        if (err) {
          setError(err.message);
          return;
        }
        router.push("/pilotes");
        router.refresh();
      },
    });
  };

  if (fetching)
    return (
      <div className="page">
        <p style={{ color: "var(--text-dim)" }}>{t("loading")}</p>
      </div>
    );

  if (!form)
    return (
      <div className="page">
        <div className="alert alert-error">
          {error || t("notFound")}
        </div>
        <Link href={`/pilotes/${id}`} className="btn btn-secondary">
          {t("back")}
        </Link>
      </div>
    );

  if (!authChecked)
    return (
      <div className="page">
        <p style={{ color: "var(--text-dim)" }}>{t("checkingAuth")}</p>
      </div>
    );

  return (
    <div className="page">
      <ConfirmModal
        modal={confirmModal}
        onConfirm={() => confirmModal?.onConfirm?.()}
        onCancel={() => setConfirmModal(null)}
      />
      <div className="page-header">
        <div>
          <h1>{t("titleEdit")}</h1>
          <div className="accent-line" />
        </div>
        <Link href={`/pilotes/${id}`} className="btn btn-secondary">
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
                required
              />
            </div>
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label>{t("labelEmail")}</label>
              {/* Email is managed by Supabase Auth and cannot be changed here.
              Displayed as read-only for reference only. */}
              <div
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "3px",
                  padding: "0.55rem 0.75rem",
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: "0.9rem",
                  color: "var(--text-dim)",
                }}
              >
                {form.email || "—"}
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="iracing_id">{t("labelIRacingId")}</label>
              <input
                id="iracing_id"
                type="text"
                value={form.iracing_id}
                onChange={set("iracing_id")}
              />
            </div>
            <div className="form-group">
              <label htmlFor="irating">{t("labelIRating")}</label>
              <input
                id="irating"
                type="number"
                value={form.irating}
                onChange={set("irating")}
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
              />
            </div>
            <div className="form-group">
              <label htmlFor="twitch">{t("labelTwitch")}</label>
              <input
                id="twitch"
                type="text"
                value={form.twitch}
                onChange={set("twitch")}
              />
            </div>
            <div className="form-group">
              <label htmlFor="instagram">{t("labelInstagram")}</label>
              <input
                id="instagram"
                type="text"
                value={form.instagram}
                onChange={set("instagram")}
              />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: "1.5rem" }}>
          {/* Discord-branded header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "1.25rem",
            }}
          >
            <svg viewBox="0 0 24 24" fill="#5865F2" style={{ width: 18, height: 18, flexShrink: 0 }}>
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.001.033.022.063.044.083a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
            <h3 style={{ margin: 0, color: "var(--text-dim)" }}>
              {t("sectionDiscord")}
            </h3>
          </div>

          {/* Toggle row */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
              cursor: "pointer",
              fontSize: "0.9rem",
            }}
          >
            <input
              type="checkbox"
              checked={form.discord_alerts_enabled}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  discord_alerts_enabled: e.target.checked,
                }))
              }
            />
            {t("discordAlertsLabel")}
          </label>

          {/* Minutes row — shown when enabled */}
          {form.discord_alerts_enabled && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                marginTop: "0.75rem",
              }}
            >
              <span style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>
                {t("discordAlertPrefix")}
              </span>
              <input
                id="discord_alert_minutes"
                type="number"
                value={form.discord_alert_minutes}
                onChange={set("discord_alert_minutes")}
                min="1"
                max="60"
                style={{ width: "64px" }}
              />
              <span style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>
                {t("discordAlertSuffix")}
              </span>
            </div>
          )}

          <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: "0.75rem" }}>
            {t("discordAlertHint")}
          </div>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
            {error}
          </div>
        )}
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? t("saving") : t("submitEdit")}
            </button>
            <Link href={`/pilotes/${id}`} className="btn btn-secondary">
              {t("cancel")}
            </Link>
          </div>
          {/* Only admins can delete a driver — drivers cannot delete themselves */}
          {currentIsAdmin && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleDelete}
            >
              {t("delete")}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
