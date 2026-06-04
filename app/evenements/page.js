import { supabaseServer as supabase } from "../../lib/supabase-server";
import Link from "next/link";
import { getSessionAndDriver, isAdmin } from "../../lib/auth";
import EventTabs from "./EventTabs";
import { getTranslations } from "next-intl/server";

// Earliest start = used for sorting and display of the next upcoming start.
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

// Serialize an event row into a plain object safe to pass to the client component.
// currentDriverId is used to flag whether the current user is signed up.
function serializeEvent(ev, currentDriverId) {
  const earliest = getEarliestStart(ev.event_start_times);
  return {
    id: ev.id,
    name: ev.name,
    format: ev.format,
    duration_minutes: ev.duration_minutes,
    circuit: ev.circuits?.name || "—",
    timezone: ev.timezone || "Europe/Paris",
    irl_start: earliest?.irl_start || null,
    start_count: ev.event_start_times?.length || 0,
    // Total number of distinct pilots signed up across all team entries
    signup_count: ev.signups?.length || 0,
    team_count: ev.team_entries?.length || 0,
    // True if the current driver has at least one signup entry for this event
    is_signed_up: currentDriverId
      ? (ev.signups || []).some((s) => s.driver_id === currentDriverId)
      : false,
    archived: ev.archived || false,
    is_special: ev.is_special || false,
    championship_id: ev.championship_id || null,
    round_number: ev.round_number || null,
  };
}

export default async function EvenementsPage() {
  const t = await getTranslations("events");
  const { driver: currentDriver } = await getSessionAndDriver();
  const admin = isAdmin(currentDriver);
  const isExternal = currentDriver?.role === "external";

  let eventsQuery = supabase
    .from("events")
    .select(
      `
    *,
    circuits (name),
    team_entries (id),
    event_start_times (id, irl_start, label),
    signups (id, driver_id),
    timezone
  `,
    )
    .order("name");

  if (isExternal) {
    const { data: mySignups } = await supabase
      .from("signups")
      .select("event_id")
      .eq("driver_id", currentDriver.id);
    const registeredEventIds = (mySignups || []).map((s) => s.event_id);
    if (registeredEventIds.length > 0) {
      eventsQuery = eventsQuery.in("id", registeredEventIds);
    } else {
      // If the driver has no signups, filter by an impossible UUID to return zero results.
      // This avoids fetching all events and filtering client-side.
      eventsQuery = eventsQuery.eq(
        "id",
        "00000000-0000-0000-0000-000000000000",
      );
    }
  }

  const [{ data: evenements, error }, { data: championships }] =
    await Promise.all([
      eventsQuery,
      supabase.from("championships").select("*").order("name"),
    ]);

  if (error) {
    return (
      <div className="page">
        <div className="alert alert-error">{t("error", { message: error.message })}</div>
      </div>
    );
  }

  const allEvents = (evenements || []).map((ev) =>
    serializeEvent(ev, currentDriver?.id),
  );

  const normalEvents = allEvents.filter(
    (ev) => !ev.is_special && !ev.championship_id,
  );
  const specialEvents = allEvents.filter(
    (ev) => ev.is_special && !ev.championship_id,
  );
  const championshipRounds = allEvents.filter((ev) => ev.championship_id);

  // External drivers only see championships they have a round registered for.
  // For all other roles, show all championships.
  const visibleChampionshipIds = new Set(
    championshipRounds.map((r) => r.championship_id),
  );
  const visibleChampionships = isExternal
    ? (championships || []).filter((c) => visibleChampionshipIds.has(c.id))
    : championships || [];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{t("title")}</h1>
          <div className="accent-line" />
        </div>
        {admin && (
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <Link href="/evenements/nouveau" className="btn btn-secondary">
              {t("addEvent")}
            </Link>
            <Link href="/championnats/nouveau" className="btn btn-primary">
              {t("addChampionship")}
            </Link>
          </div>
        )}
      </div>

      <EventTabs
        allEvents={allEvents}
        normalEvents={normalEvents}
        specialEvents={specialEvents}
        championshipRounds={championshipRounds}
        championships={visibleChampionships}
        admin={admin}
      />
    </div>
  );
}
