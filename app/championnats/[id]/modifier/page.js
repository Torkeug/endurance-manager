"use client";
import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser as supabase } from "../../../../lib/supabase-browser";

// Reusable confirm modal — replaces native confirm() for archive and delete actions
function ConfirmModal({ modal, onConfirm, onCancel }) {
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
            {modal.confirmLabel || "Confirmer"}
          </button>
          <button onClick={onCancel} className="btn btn-secondary">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ModifierChampionnat({ params }) {
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
          setError("Championnat introuvable.");
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
      setError("Le nom est obligatoire.");
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
      title: isArchived
        ? "Désarchiver le championnat"
        : "Archiver le championnat",
      message: isArchived
        ? "Ce championnat sera à nouveau visible dans la liste active."
        : "Ce championnat sera masqué de la liste active. Les manches restent accessibles.",
      confirmLabel: isArchived ? "Désarchiver" : "Archiver",
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
      title: "Supprimer le championnat",
      message:
        "Ce championnat et toutes ses manches seront supprimés définitivement. Cette action est irréversible.",
      confirmLabel: "Supprimer définitivement",
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
        <p style={{ color: "var(--text-dim)" }}>Chargement…</p>
      </div>
    );
  if (!authChecked)
    return (
      <div className="page">
        <p style={{ color: "var(--text-dim)" }}>Vérification des droits…</p>
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
          <h1>Modifier le championnat</h1>
          <div className="accent-line" />
        </div>
        <Link href="/evenements" className="btn btn-secondary">
          ← Retour
        </Link>
      </div>

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
              {loading ? "Enregistrement…" : "✓ Enregistrer"}
            </button>
            <Link href="/evenements" className="btn btn-secondary">
              Annuler
            </Link>
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleArchiveToggle}
            >
              {form.archived ? "↩ Désarchiver" : "📦 Archiver"}
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleDelete}
            >
              Supprimer
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
