"use client";
import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser as supabase } from "../../../../lib/supabase-browser";
import { useTranslations } from "next-intl";

// Reusable confirm modal — replaces native confirm() for archive and delete actions
function ConfirmModal({ modal, onConfirm, onCancel }) {
  const t = useTranslations("championshipEdit");
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
            {t("cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ModifierChampionnat({ params }) {
  const t = useTranslations("championshipEdit");
  const router = useRouter();
  const { id } = use(params);

  const [form, setForm] = useState({ name: "", season: "" });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Controls confirmation modals for archive toggle and championship deletion
  const [confirmModal, setConfirmModal] = useState(null);
  // null | { title, message, confirmLabel, onConfirm }

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

  useEffect(() => {
    supabase
      .from("championships")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) {
          setError(t("notFound"));
          setFetching(false);
          return;
        }
        setForm({
          name: data.name || "",
          season: data.season || "",
          archived: data.archived || false,
        });
        setFetching(false);
      });
  }, [id]);

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

    const { error: err } = await supabase
      .from("championships")
      .update({ name: form.name.trim(), season: form.season.trim() || null })
      .eq("id", id);

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    router.push("/evenements");
    router.refresh();
  };

  // Archiving a championship hides it and its rounds from the active view.
  // Rounds are not archived individually — they're filtered via archivedChampionshipIds
  // in the events page and dashboard.
  const handleArchiveToggle = () => {
    const isArchived = form.archived;
    setConfirmModal({
      title: isArchived ? t("unarchiveTitle") : t("archiveTitle"),
      message: isArchived ? t("unarchiveMsg") : t("archiveMsg"),
      confirmLabel: isArchived ? t("unarchiveConfirm") : t("archiveConfirm"),
      onConfirm: async () => {
        setConfirmModal(null);
        const { error: err } = await supabase
          .from("championships")
          .update({ archived: !isArchived })
          .eq("id", id);
        if (err) {
          setError(err.message);
          return;
        }
        router.push("/evenements");
        router.refresh();
      },
    });
  };

  const handleDelete = () => {
    setConfirmModal({
      title: t("deleteTitle"),
      message: t("deleteMsg"),
      confirmLabel: t("deleteConfirm"),
      onConfirm: async () => {
        setConfirmModal(null);
        // Delete all rounds first — FK constraint prevents deleting a championship
        // that still has event rows referencing it.
        const { error: roundsErr } = await supabase
          .from("events")
          .delete()
          .eq("championship_id", id);
        if (roundsErr) {
          setError(roundsErr.message);
          return;
        }
        const { error: err } = await supabase
          .from("championships")
          .delete()
          .eq("id", id);
        if (err) {
          setError(err.message);
          return;
        }
        router.push("/evenements");
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
              {loading ? t("saving") : t("submitSave")}
            </button>
            <Link href="/evenements" className="btn btn-secondary">
              {t("cancel")}
            </Link>
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleArchiveToggle}
            >
              {form.archived ? t("unarchiveBtn") : t("archiveBtn")}
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleDelete}
            >
              {t("deleteBtn")}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
