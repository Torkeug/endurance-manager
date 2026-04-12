"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser as supabase } from '../../../lib/supabase-browser'

export default function DeleteEventButton({ eventId }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // This button is only rendered for archived events (see [id]/page.js).
  // Archiving first ensures snapshots are populated before permanent deletion.
  const handleDelete = async () => {
    if (
      !confirm(
        "Supprimer définitivement cet événement ? Cette action est irréversible et supprimera toutes les données associées.",
      )
    )
      return;

    setLoading(true);
    const { error } = await supabase.from("events").delete().eq("id", eventId);
    if (error) {
      alert(`Erreur : ${error.message}`);
      setLoading(false);
      return;
    }
    router.push("/evenements");
    router.refresh();
  };

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="btn btn-danger"
    >
      {loading ? "…" : "🗑 Supprimer"}
    </button>
  );
}
