"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

export default function ArchiveToggle({ eventId, archived }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  const handleToggle = async () => {
    const msg = archived
      ? "Désarchiver cet événement ? Il sera à nouveau visible par tous les pilotes."
      : "Archiver cet événement ? Il passera en lecture seule pour les pilotes.";
    if (!confirm(msg)) return;

    setLoading(true);

    // Before archiving, populate name snapshots on all related records.
    // This preserves display names even if the underlying entities are later
    // renamed or deleted — archived data must remain self-contained.
    if (!archived) {
      // Archiving — populate snapshots first

      // 1. Snapshot circuit name on event
      const { data: event } = await supabase
        .from("events")
        .select("circuit_id, circuits(name)")
        .eq("id", eventId)
        .single();
      if (event?.circuits?.name) {
        await supabase
          .from("events")
          .update({ circuit_name_snapshot: event.circuits.name })
          .eq("id", eventId);
      }

      // 2. Snapshot car names on team_entries
      const { data: teamEntries } = await supabase
        .from("team_entries")
        .select("id, car_id, cars(name)")
        .eq("event_id", eventId);
      if (teamEntries?.length > 0) {
        await Promise.all(
          teamEntries.map((te) =>
            te.cars?.name
              ? supabase
                  .from("team_entries")
                  .update({ car_name_snapshot: te.cars.name })
                  .eq("id", te.id)
              : Promise.resolve(),
          ),
        );
      }

      // 3. Snapshot driver names on signups
      const { data: signups } = await supabase
        .from("signups")
        .select("id, driver_id, drivers(name)")
        .eq("event_id", eventId);
      if (signups?.length > 0) {
        await Promise.all(
          signups.map((s) =>
            s.drivers?.name
              ? supabase
                  .from("signups")
                  .update({ driver_name_snapshot: s.drivers.name })
                  .eq("id", s.id)
              : Promise.resolve(),
          ),
        );
      }

      // 4. Snapshot driver names on stints
      // Stints don't have a direct event_id — query them via team_entry_id instead.
      const teamEntryIds = (teamEntries || []).map((te) => te.id);
      if (teamEntryIds.length > 0) {
        const { data: stints } = await supabase
          .from("stints")
          .select("id, driver_id, drivers(name)")
          .in("team_entry_id", teamEntryIds);
        if (stints?.length > 0) {
          await Promise.all(
            stints.map((s) =>
              s.drivers?.name
                ? supabase
                    .from("stints")
                    .update({ driver_name_snapshot: s.drivers.name })
                    .eq("id", s.id)
                : Promise.resolve(),
            ),
          );
        }
      }
    }

    // Toggle archived state
    // All snapshots are written — now safe to flip the archived flag.
    await supabase
      .from("events")
      .update({ archived: !archived })
      .eq("id", eventId);
    router.refresh();
    setLoading(false);
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className="btn btn-secondary"
      style={{ borderColor: archived ? "var(--accent)" : "var(--text-dim)" }}
    >
      {loading ? "…" : archived ? "↩ Désarchiver" : "📦 Archiver"}
    </button>
  );
}
