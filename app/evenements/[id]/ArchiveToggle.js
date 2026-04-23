"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser as supabase } from "../../../lib/supabase-browser";

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
          <button onClick={onConfirm} className="btn btn-primary">
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

export default function ArchiveToggle({ eventId, archived }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const router = useRouter();

  const handleToggle = () => {
    if (!archived) {
      // Archiving — call Postgres function directly, no confirm needed
      // (the archive operation is significant enough to not need an extra step
      // since it's clearly labeled and reversible via unarchive)
      commitToggle();
    } else {
      // Unarchiving — confirm first
      setConfirmModal({
        title: "Désarchiver cet événement",
        message:
          "Cet événement sera à nouveau visible et modifiable par tous les pilotes.",
        confirmLabel: "Désarchiver",
        onConfirm: () => {
          setConfirmModal(null);
          commitToggle();
        },
      });
    }
  };

  const commitToggle = async () => {
    setLoading(true);
    setError(null);

    if (!archived) {
      const { error: rpcErr } = await supabase.rpc("archive_event", {
        event_id: eventId,
      });
      if (rpcErr) {
        setError(`Erreur lors de l'archivage : ${rpcErr.message}`);
        setLoading(false);
        return;
      }
    } else {
      const { error: updateErr } = await supabase
        .from("events")
        .update({ archived: false })
        .eq("id", eventId);
      if (updateErr) {
        setError(`Erreur lors du désarchivage : ${updateErr.message}`);
        setLoading(false);
        return;
      }
    }

    router.refresh();
    setLoading(false);
  };

  return (
    <div>
      <ConfirmModal
        modal={confirmModal}
        onConfirm={() => confirmModal?.onConfirm?.()}
        onCancel={() => setConfirmModal(null)}
      />
      {error && (
        <div
          className="alert alert-error"
          style={{ marginBottom: "0.75rem", fontSize: "0.85rem" }}
        >
          {error}
        </div>
      )}
      <button
        onClick={handleToggle}
        disabled={loading}
        className="btn btn-secondary"
        style={{ borderColor: archived ? "var(--accent)" : "var(--text-dim)" }}
      >
        {loading
          ? archived
            ? "Désarchivage…"
            : "Archivage…"
          : archived
            ? "↩ Désarchiver"
            : "📦 Archiver"}
      </button>
    </div>
  );
}
