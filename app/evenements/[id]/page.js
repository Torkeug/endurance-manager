import { supabaseServer as supabase } from "../../../lib/supabase-server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionAndDriver, isAdmin, isEngineer } from "../../../lib/auth";
import { formatInZone } from "../../../lib/timezone";
import ArchiveToggle from "./ArchiveToggle";
import DeleteEventButton from "./DeleteEventButton";
import CollapsibleEventInfo from "./CollapsibleEventInfo";
import EventPageTabs from "./EventPageTabs";

function formatDuration(minutes) {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h${m.toString().padStart(2, "0")}`;
}

function getEarliestStart(startTimes) {
  if (!startTimes || startTimes.length === 0) return null;
  return startTimes.reduce(
    (earliest, st) =>
      !earliest || new Date(st.irl_start) < new Date(earliest.irl_start)
        ? st
        : earliest,
    null,
  );
}

export default async function EvenementDetail({ params }) {
  const { id } = await params;
  const t = await getTranslations("events");

  const { driver: currentDriver } = await getSessionAndDriver();
  const admin = isAdmin(currentDriver);
  const isExternal = currentDriver?.role === "external";
  // Engineers can view all event data but cannot sign up or manage team entries
  const engineer = isEngineer(currentDriver);

  const [{ data: event, error }, { data: allCars }, { data: crewNames }] =
    await Promise.all([
      supabase
        .from("events")
        .select(
          `
          *,
          circuits (name, pit_lane_time_seconds),
          team_entries (
            id, crew_name, class, stream_urls, start_time_id,
            car_name_snapshot, car_number,
            cars (id, name, iracing_car_id),
            event_start_times (irl_start, label),
            signups (
              team_entry_id,
              driver_name_snapshot,
              drivers (id, name, irating)
            )
          ),
          event_start_times (id, label, irl_start),
          signups (
            id, preferred_class, preferred_car_ids, preferred_car_names_snapshot,
            preferred_start_time_ids, tags, team_entry_id,
            driver_name_snapshot,
            drivers (id, name, irating),
            team_entries (crew_name)
          ),
          timezone,
          championships (id, name)
        `,
        )
        .eq("id", id)
        .single(),
      supabase.from("cars").select("id, name, class"),
      // Fetch crew name colors for the pill system
      supabase.from("crew_names").select("name, color"),
    ]);

  if (error || !event) notFound();

  const earliest = getEarliestStart(event.event_start_times);

  // Build crew name → hex color map for pill coloring.
  // Entries with no color set will fall back to the hash-based palette in CrewPill.
  const crewColorsMap = (crewNames || []).reduce((acc, cn) => {
    if (cn.color) acc[cn.name] = cn.color;
    return acc;
  }, {});

  // Info items — first 4 are shown as condensed summary when collapsed:
  // Circuit · Format · Durée · Départ IG
  const infoItems = [
    {
      label: t("infoCircuit"),
      value: event.archived
        ? event.circuit_name_snapshot || event.circuits?.name || "—"
        : event.circuits?.name || "—",
    },
    { label: t("infoFormat"), value: event.format || "—" },
    { label: t("infoDuration"), value: formatDuration(event.duration_minutes) },
    { label: t("infoIGStart"), value: event.ig_start_time || "—" },

    // Hide counts for external users
    ...(!isExternal
      ? [
          {
            label: t("infoSignedUp"),
            value: String(event.signups?.length ?? 0),
          },
          {
            label: t("equipagesLabel"),
            value: String(event.team_entries?.length ?? 0),
          },
        ]
      : []),

    { label: t("infoSunrise"), value: event.ig_sunrise || "—" },
    { label: t("infoSunset"), value: event.ig_sunset || "—" },
    {
      label: t("infoPitLane"),
      value: event.circuits?.pit_lane_time_seconds
        ? `${event.circuits.pit_lane_time_seconds}s`
        : "—",
    },
  ];

  return (
    <div className="page">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {event.name}
            {event.archived && (
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
                {t("badgeArchived")}
              </span>
            )}
          </h1>
          <div className="accent-line" />
          {event.championships && (
            <div
              style={{
                fontSize: "0.82rem",
                color: "var(--text-dim)",
                marginTop: "0.2rem",
              }}
            >
              {event.championships.name}
              {event.round_number && ` · ${t("badgeRound", { number: event.round_number })}`}
            </div>
          )}
          <div
            style={{
              marginTop: "0.5rem",
              color: "var(--text-dim)",
              fontSize: "0.9rem",
            }}
          >
            {earliest
              ? formatInZone(
                  earliest.irl_start,
                  event.timezone || "Europe/Paris",
                )
              : t("dateUnknown")}
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          {admin && !event.archived && (
            <Link
              href={`/evenements/${id}/modifier`}
              className="btn btn-secondary"
            >
              {t("editEvent")}
            </Link>
          )}
          {admin && <ArchiveToggle eventId={id} archived={event.archived} />}
          {admin && event.archived && <DeleteEventButton eventId={id} />}
          <Link href="/evenements" className="btn btn-secondary">
            {t("back")}
          </Link>
        </div>
      </div>

      {/* ── Collapsible info grid + notes ────────────────────────────────── */}
      <CollapsibleEventInfo
        eventId={id}
        items={infoItems}
        notes={event.notes}
      />

      {/* ── Tabbed sections ──────────────────────────────────────────────── */}
      <EventPageTabs
        event={event}
        allCars={allCars || []}
        admin={admin}
        isExternal={isExternal}
        engineer={engineer}
        currentDriver={currentDriver}
        crewColorsMap={crewColorsMap}
      />
    </div>
  );
}
