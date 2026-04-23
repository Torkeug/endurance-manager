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

export default function DeleteEventButton({ eventId }) {
  const [loading, setLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const router = useRouter();

  const handleDelete = () => {
    setConfirmModal({
      title: "Supprimer cet événement",
      message:
        "Cet événement et toutes ses données associées seront supprimés définitivement. Cette action est irréversible.",
      confirmLabel: "Supprimer définitivement",
      onConfirm: async () => {
        setConfirmModal(null);
        setLoading(true);
        const { error } = await supabase
          .from("events")
          .delete()
          .eq("id", eventId);
        if (error) {
          setLoading(false);
          return;
        }
        router.push("/evenements");
        router.refresh();
      },
    });
  };

  return (
    <>
      <ConfirmModal
        modal={confirmModal}
        onConfirm={() => confirmModal?.onConfirm?.()}
        onCancel={() => setConfirmModal(null)}
      />
      <button
        onClick={handleDelete}
        disabled={loading}
        className="btn btn-danger"
      >
        {loading ? "…" : "🗑 Supprimer"}
      </button>
    </>
  );
}
