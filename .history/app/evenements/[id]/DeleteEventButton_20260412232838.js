"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

export default function DeleteEventButton({ eventId }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

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
