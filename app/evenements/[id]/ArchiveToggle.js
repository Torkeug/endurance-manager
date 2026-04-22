"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser as supabase } from "../../../lib/supabase-browser";

export default function ArchiveToggle({ eventId, archived }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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
      // 3. Snapshot driver names and preferred car names on signups.
      // Car names are resolved from the cars table at archive time so the
      // inscriptions tab stays accurate even if cars are later renamed or deleted.
      const { data: signups } = await supabase
        .from("signups")
        .select("id, driver_id, drivers(name), preferred_car_ids")
        .eq("event_id", eventId);

      // Fetch all cars referenced across all signups in one query
      const allPreferredCarIds = [
        ...new Set((signups || []).flatMap((s) => s.preferred_car_ids || [])),
      ];
      const { data: preferredCars } =
        allPreferredCarIds.length > 0
          ? await supabase
              .from("cars")
              .select("id, name")
              .in("id", allPreferredCarIds)
          : { data: [] };
      const preferredCarsMap = Object.fromEntries(
        (preferredCars || []).map((c) => [c.id, c.name]),
      );

      if (signups?.length > 0) {
        await Promise.all(
          signups.map((s) => {
            // Resolve preferred car IDs to names — drop any that no longer exist
            const carNamesSnapshot = (s.preferred_car_ids || [])
              .map((id) => preferredCarsMap[id])
              .filter(Boolean);
            return supabase
              .from("signups")
              .update({
                driver_name_snapshot: s.drivers?.name || null,
                // Always write the array — empty array is valid (driver had no car prefs)
                // NULL means "not yet snapshotted" (pre-feature archives)
                preferred_car_names_snapshot: carNamesSnapshot,
              })
              .eq("id", s.id);
          }),
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
