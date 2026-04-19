import { supabaseServer as supabase } from "../../../../../lib/supabase-server";
import Link from "next/link";
import { notFound } from "next/navigation";
import EquipageTabs from "./EquipageTabs";
import { getSessionAndDriver, isAdmin } from "../../../../../lib/auth";
import { formatTimeInZone } from "../../../../../lib/timezone";
import CollapsibleSummary from "./CollapsibleSummary";

export default async function EquipageDetail({ params }) {
  const { id, entryId } = await params;

  const { driver: currentDriver } = await getSessionAndDriver();
  const isEngineer = currentDriver?.role === "engineer";

  const { data: entry, error } = await supabase
    .from("team_entries")
    .select(
      `
      *,
      cars (id, name, tank_size_litres, class),
      events (name, duration_minutes, ig_start_time, ig_sunrise, ig_sunset, timezone, archived,
        circuits (name, pit_lane_time_seconds)),
      event_start_times (irl_start, label)
    `,
    )
    .eq("id", entryId)
    .single();

  if (error || !entry) notFound();

  // archived flows from the parent event — used to lock all tabs to read-only
  const archived = entry.events?.archived || false;

  const { data: allSignups } = await supabase
    .from("signups")
    .select("*, drivers(id, name, irating)")
    .eq("event_id", entry.event_id)
    .order("drivers(name)");

  // Split signups into assigned (linked to this team entry) and unassigned (no team yet).
  // Both lists are passed to DriversAssignment so admins can promote unassigned drivers.
  const assignedDrivers = (allSignups || []).filter(
    (s) => s.team_entry_id === entryId,
  );
  const unassignedDrivers = (allSignups || []).filter((s) => !s.team_entry_id);

  const pitTime = entry.events?.circuits?.pit_lane_time_seconds;
  const entryCarId = entry.car_id;
  const entryClass = entry.class || entry.cars?.class;

  const driversWithIrating = assignedDrivers.filter((d) => d.drivers?.irating);
  const avgIrating =
    driversWithIrating.length > 0
      ? Math.round(
          driversWithIrating.reduce((sum, d) => sum + d.drivers.irating, 0) /
            driversWithIrating.length,
        )
      : null;

  const infoItems = [
    // Use snapshot if available (archived event), fall back to live car name.
    {
      label: "Voiture",
      value:
        (archived ? entry.car_name_snapshot : null) || entry.cars?.name || "—",
    },
    { label: "Classe", value: entryClass || "—" },
    { label: "SoF", value: avgIrating ? `${avgIrating} iR` : "—" },
    // If BoP tank size is set, show the reduced capacity and the percentage.
    // Otherwise show the car's default full tank size.
    {
      label: "Réservoir",
      value: entry.bop_tank_size_percent
        ? `${((entry.cars?.tank_size_litres * entry.bop_tank_size_percent) / 100).toFixed(1)}L (${entry.bop_tank_size_percent}% BoP)`
        : entry.cars?.tank_size_litres
          ? `${entry.cars.tank_size_litres}L`
          : "—",
    },
    { label: "Pit lane", value: pitTime ? `${pitTime}s` : "—" },
    { label: "BOP Puissance", value: `${entry.bop_power_percent ?? 100}%` },
    { label: "BOP Poids", value: `${entry.bop_weight_kg ?? 0}kg` },
    {
      label: "Ravitaillement",
      value: entry.refuel_time_seconds ? `${entry.refuel_time_seconds}s` : "—",
    },
    { label: "Chgt pneus", value: `${entry.tyre_change_time_seconds ?? 0}s` },
    {
      label: "Alerte relais",
      value: entry.notification_minutes_before
        ? `${entry.notification_minutes_before} min`
        : "—",
    },
    { label: "Lever soleil IG", value: entry.events?.ig_sunrise || "—" },
    { label: "Coucher soleil IG", value: entry.events?.ig_sunset || "—" },
  ];

  const driverId = currentDriver?.id;

  const isInEvent = (allSignups || []).some((s) => s.drivers?.id === driverId);

  const isInTeam = assignedDrivers.some((s) => s.drivers?.id === driverId);

  const canEditTeam = isEngineer || entry.created_by === driverId; // adjust if needed

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {entry.crew_name}
            {/* Archived badge — mirrors the event detail page style */}
            {archived && (
              <span
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  padding: "0.2rem 0.5rem",
                  background: "rgba(224,85,85,0.1)",
                  border: "1px solid var(--danger)",
                  borderRadius: "3px",
                  color: "var(--danger)",
                }}
              >
                Archivé
              </span>
            )}
          </h1>
          <div className="accent-line" />
          <div
            style={{
              marginTop: "0.4rem",
              color: "var(--text-dim)",
              fontSize: "0.85rem",
            }}
          >
            {entry.events?.name} —{" "}
            {(archived ? entry.car_name_snapshot : null) ||
              entry.cars?.name ||
              "Voiture à définir"}
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          {/* Modifier hidden for archived events — all data is read-only */}
          {!archived && !isEngineer && (isAdmin(currentDriver) || isInTeam) && (
            <Link
              href={`/evenements/${id}/equipages/${entryId}/modifier`}
              className="btn btn-secondary"
            >
              Modifier
            </Link>
          )}
          <Link href={`/evenements/${id}`} className="btn btn-secondary">
            Événement
          </Link>
        </div>
      </div>

      <CollapsibleSummary
        entryId={entryId}
        startTime={
          entry.event_start_times
            ? formatTimeInZone(
                entry.event_start_times.irl_start,
                entry.events?.timezone || "Europe/Paris",
              )
            : null
        }
        startLabel={entry.event_start_times?.label}
        streamUrls={entry.stream_urls}
        infoItems={infoItems}
      />

      {/* Tabbed sections — archived passed down to lock all tabs to read-only */}
      <EquipageTabs
        entryId={entryId}
        teamEntry={entry}
        assignedDrivers={assignedDrivers}
        unassignedDrivers={unassignedDrivers}
        entryCarId={entryCarId}
        entryClass={entryClass}
        currentDriver={currentDriver}
        archived={archived}
        isInEvent={isInEvent}
        isInTeam={isInTeam}
        isEngineer={isEngineer}
      />
    </div>
  );
}
