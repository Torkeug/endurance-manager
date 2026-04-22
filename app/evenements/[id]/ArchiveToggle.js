"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser as supabase } from "../../../lib/supabase-browser";

export default function ArchiveToggle({ eventId, archived }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();

  const handleToggle = async () => {
    const msg = archived
      ? "Désarchiver cet événement ? Il sera à nouveau visible par tous les pilotes."
      : "Archiver cet événement ? Il passera en lecture seule pour les pilotes.";
    if (!confirm(msg)) return;

    setLoading(true);
    setError(null);

    if (!archived) {
      // ── Archiving ────────────────────────────────────────────────────────
      // Delegates all snapshot writes + archived flag to a single Postgres
      // function that runs as one atomic transaction. If anything fails,
      // nothing is committed and the event stays unarchived.
      const { error: rpcErr } = await supabase.rpc("archive_event", {
        event_id: eventId,
      });
      if (rpcErr) {
        setError(`Erreur lors de l'archivage : ${rpcErr.message}`);
        setLoading(false);
        return;
      }
    } else {
      // ── Unarchiving ──────────────────────────────────────────────────────
      // Simple flag flip — no snapshot changes needed.
      // Snapshots are kept so they're ready if the event is re-archived.
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
