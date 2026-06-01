import { supabaseServer as supabase } from "../../../../../lib/supabase-server";
import Link from "next/link";
import { notFound } from "next/navigation";
import EquipageTabs from "./EquipageTabs";
import {
  getSessionAndDriver,
  isAdmin,
  isExternal as checkIsExternal,
} from "../../../../../lib/auth";
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
      cars (id, name, tank_size_litres, class, refuel_litres_per_second, car_classes(refuel_litres_per_second)),
      events (name, duration_minutes, ig_start_time, ig_sunrise, ig_sunset, timezone, archived, championship_id, green_flag_offset_minutes,
      circuits (name, pit_lane_time_seconds, iracing_track_id)),
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
    .select("*, drivers(id, name, irating, garage61_slug)")
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

  // ── Preference resolution maps ────────────────────────────────────────────
  // Build id→name maps so DriversAssignment can show human-readable car and
  // start time names in mismatch tooltips instead of raw UUIDs.
  const { data: allCars } = await supabase.from("cars").select("id, name");
  const carsMap = Object.fromEntries(
    (allCars || []).map((c) => [c.id, c.name]),
  );

  // Collect every start time ID referenced anywhere in this page:
  // the team's own start time + all preferred_start_time_ids from every signup.
  // Fetching by explicit ID list (rather than filtering by event_id) ensures
  // we can resolve preferences even if a driver's saved preference points to
  // a start time that was later reassigned or belongs to a sibling event.
  const referencedStartTimeIds = [
    ...(entry.start_time_id ? [entry.start_time_id] : []),
    ...(allSignups || []).flatMap((s) => s.preferred_start_time_ids || []),
  ];
  const uniqueStartTimeIds = [...new Set(referencedStartTimeIds)];

  // Fetch from both tables — regular and special event start times.
  // When an event is converted to a special event, drivers may still have
  // preferred_start_time_ids pointing to the old event_start_times rows.
  // Merging both maps ensures all IDs resolve correctly regardless of event type.
  const [{ data: regularStartTimes }, { data: specialStartTimes }] =
    await Promise.all([
      uniqueStartTimeIds.length > 0
        ? supabase
            .from("event_start_times")
            .select("id, label, irl_start") // add irl_start
            .in("id", uniqueStartTimeIds)
        : Promise.resolve({ data: [] }),
      uniqueStartTimeIds.length > 0
        ? supabase
            .from("special_event_start_times")
            .select("id, label, hour, minute") // add hour, minute
            .in("id", uniqueStartTimeIds)
        : Promise.resolve({ data: [] }),
    ]);

  const tz = entry.events?.timezone || "Europe/Paris";

  // Pre-format labels with date + time so tooltips in DriversAssignment
  // are human-readable without needing timezone logic client-side.
  const startTimesMap = Object.fromEntries([
    ...(regularStartTimes || []).map((t) => [
      t.id,
      `${t.label} à ${formatTimeInZone(t.irl_start, tz, "HH:mm")}`,
    ]),
    ...(specialStartTimes || []).map((t) => [
      t.id,
      // special_event_start_times stores hour/minute directly — no UTC conversion needed
      `${t.label} à ${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`,
    ]),
  ]);

  // Name of the car the team is running — passed for rich tooltip display.
  const entryCarName = entry.cars?.name || entry.car_name_snapshot || null;

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
    ...(entry.events?.championship_id
      ? [
          {
            label: "#",
            value: entry.car_number != null ? `#${entry.car_number}` : "—",
          },
        ]
      : []),
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
    { label: "BOP Puissance", value: `${entry.bop_power_percent ?? 100}%` },
    { label: "BOP Poids", value: `${entry.bop_weight_kg ?? 0}kg` },
    { label: "Pit lane", value: pitTime ? `${pitTime}s` : "—" },
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
          {/* Modifier hidden for archived events, engineers, and external drivers */}
          {!archived &&
            !isEngineer &&
            !checkIsExternal(currentDriver) &&
            (isAdmin(currentDriver) || isInTeam) && (
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
        entryCarName={entryCarName}
        entryClass={entryClass}
        carsMap={carsMap}
        startTimesMap={startTimesMap}
        currentDriver={currentDriver}
        archived={archived}
        isInEvent={isInEvent}
        isInTeam={isInTeam}
        isEngineer={isEngineer}
      />
    </div>
  );
}
