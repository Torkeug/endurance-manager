"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser as supabase } from "../../../lib/supabase-browser";
import { useTranslations } from "next-intl";

function ConfirmModal({ modal, onConfirm, onCancel }) {
  const t = useTranslations("deleteEvent");
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

export default function DeleteEventButton({ eventId }) {
  const t = useTranslations("deleteEvent");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const router = useRouter();

  const handleDelete = () => {
    setError(null);
    setConfirmModal({
      title: t("deleteTitle"),
      message: t("deleteMsg"),
      confirmLabel: t("deleteConfirm"),
      onConfirm: async () => {
        setConfirmModal(null);
        setLoading(true);
        const { error: err } = await supabase
          .from("events")
          .delete()
          .eq("id", eventId);
        if (err) {
          setError(err.message);
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
      {error && (
        <div className="alert alert-error" style={{ marginBottom: "0.5rem", fontSize: "0.85rem" }}>
          {error}
        </div>
      )}
      <button
        onClick={handleDelete}
        disabled={loading}
        className="btn btn-danger"
      >
        {loading ? t("deleting") : t("deleteBtn")}
      </button>
    </>
  );
}
