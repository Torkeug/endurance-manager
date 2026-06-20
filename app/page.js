import { supabaseServer as supabase } from "../lib/supabase-server";
import { getSessionAndDriver, isAdmin, isEngineer } from "../lib/auth";
import Link from "next/link";
import { formatInZone } from "../lib/timezone";
import HomeTabs from "./HomeTabs";
import IncompleteTab from "./IncompleteTab";
import { getTranslations, getLocale } from "next-intl/server";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDuration(minutes) {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

function Badge({
  label,
  color = "var(--accent)",
  bg = "var(--accent-dim)",
  border = "var(--accent)",
}) {
  return (
    <span
      style={{
        fontSize: "0.7rem",
        fontWeight: 700,
        padding: "0.1rem 0.4rem",
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: "3px",
        color,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const [t, locale] = await Promise.all([getTranslations("dashboard"), getLocale()]);
  const { driver: currentDriver } = await getSessionAndDriver();
  const admin = isAdmin(currentDriver);
  // Engineers don't have personal stints — "My next stint" is not relevant to them
  const engineer = isEngineer(currentDriver);

  const timeUntil = (dtStr) => {
    if (!dtStr) return null;
    const diff = new Date(dtStr) - new Date();
    if (diff < 0) return null;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return t("timeUntilDays", { days, hours });
    if (hours > 0) return t("timeUntilHours", { hours });
    return t("imminent");
  };

  // ── Data fetching ──────────────────────────────────────────────────────────
  const syncCutoff = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: events },
    { data: mySignups },
    { data: myStints },
    { data: pendingDrivers },
    { count: totalDrivers },
    { count: testDrivers },
    { count: overdueMembers },
    { count: syncRequired },
    { count: inactiveDrivers },
    { data: teamEntries },
    { data: championships },
    { data: activeStrategies },
    { data: unassignedSignupsRaw },
  ] = await Promise.all([
    supabase
      .from("events")
      .select(
        `id, name, format, duration_minutes, is_special, championship_id, round_number,
         event_start_times (id, label, irl_start),
         circuits (name),
         team_entries (id, crew_name),
         timezone`,
      )
      .eq("archived", false)
      .order("name"),

    currentDriver
      ? supabase
          .from("signups")
          .select(
            `*, events (id, name, duration_minutes, format, timezone, is_special, championship_id, round_number,
               circuits(name), event_start_times(id, label, irl_start)),
             team_entries (id, crew_name, cars(name), event_start_times(label, irl_start))`,
          )
          .eq("driver_id", currentDriver.id)
      : { data: [] },

    currentDriver
      ? supabase
          .from("stints")
          .select(
            `*, strategies!inner(is_active), team_entries(id, crew_name, event_id, events(name, timezone), event_start_times(label, irl_start))`,
          )
          .eq("driver_id", currentDriver.id)
          .eq("strategies.is_active", true)
          .order("irl_start")
      : { data: [] },

    admin
      ? supabase.from("drivers").select("id").eq("approved", false).eq("refused", false)
      : { data: [] },

    admin
      ? supabase.from("drivers").select("*", { count: "exact", head: true }).eq("active", true).eq("is_test_account", false).neq("role", "engineer")
      : { count: 0 },

    admin
      ? supabase.from("drivers").select("*", { count: "exact", head: true }).eq("test_driver", true).eq("approved", true)
      : { count: 0 },

    admin
      ? supabase.from("drivers").select("*", { count: "exact", head: true }).eq("membership_ok", false).eq("approved", true).eq("active", true).eq("test_driver", false)
      : { count: 0 },

    admin
      ? supabase.from("drivers").select("*", { count: "exact", head: true }).eq("approved", true).eq("active", true).eq("is_test_account", false).neq("role", "engineer").or(`last_driver_sync_at.is.null,last_driver_sync_at.lt.${syncCutoff}`)
      : { count: 0 },

    admin
      ? supabase.from("drivers").select("*", { count: "exact", head: true }).eq("approved", true).eq("active", false).neq("role", "engineer")
      : { count: 0 },

    admin
      ? supabase.from("team_entries").select(`id, crew_name, event_id, events (name, archived), signups (id), stints (id, driver_id, strategy_id)`).order("crew_name")
      : { data: [] },

    supabase.from("championships").select("id, name, archived").order("name"),

    admin
      ? supabase.from("strategies").select("id, team_entry_id").eq("is_active", true)
      : { data: [] },

    admin
      ? supabase.from("signups").select(`id, driver_id, event_id, drivers (name), events (id, name, archived)`).is("team_entry_id", null)
      : { data: [] },
  ]);

  // ── Derived data ───────────────────────────────────────────────────────────

  const now = new Date();

  const championshipsMap = Object.fromEntries(
    (championships || []).map((c) => [c.id, c.name]),
  );

  const archivedChampionshipIds = new Set(
    (championships || []).filter((c) => c.archived).map((c) => c.id),
  );

  const upcomingEvents = (events || [])
    .filter((ev) => !ev.championship_id || !archivedChampionshipIds.has(ev.championship_id))
    .map((ev) => {
      const starts = (ev.event_start_times || []).sort((a, b) => new Date(a.irl_start) - new Date(b.irl_start));
      const next = starts.find((s) => new Date(s.irl_start) > now);
      return { ...ev, nextStart: next };
    })
    .filter((ev) => ev.nextStart)
    .sort((a, b) => new Date(a.nextStart.irl_start) - new Date(b.nextStart.irl_start));

  const nextEvent = upcomingEvents[0] || null;

  const myNextStint =
    (myStints || [])
      .filter((s) => s.irl_start && new Date(s.irl_start) > now)
      .sort((a, b) => new Date(a.irl_start) - new Date(b.irl_start))[0] || null;

  const myUpcomingSignups = (mySignups || [])
    .filter((s) => !s.events?.championship_id || !archivedChampionshipIds.has(s.events.championship_id))
    .filter((s) => {
      const starts = s.events?.event_start_times || [];
      return starts.some((st) => new Date(st.irl_start) > now);
    })
    .sort((a, b) => {
      const aStart = Math.min(...(a.events?.event_start_times || []).map((st) => new Date(st.irl_start)));
      const bStart = Math.min(...(b.events?.event_start_times || []).map((st) => new Date(st.irl_start)));
      return aStart - bStart;
    });

  const pendingCount = (pendingDrivers || []).length;
  const totalEvents = (events || []).length;

  const eventNextStartMap = Object.fromEntries(
    (events || []).map((ev) => {
      const next =
        (ev.event_start_times || [])
          .map((s) => new Date(s.irl_start))
          .filter((d) => d > now)
          .sort((a, b) => a - b)[0] || null;
      return [ev.id, next];
    }),
  );

  const noDrivers = admin
    ? (teamEntries || []).filter((te) => !te.events?.archived && (te.signups || []).length === 0)
    : [];

  const activeStrategyIdSet = new Set((activeStrategies || []).map((s) => s.id));

  const noStints = admin
    ? (teamEntries || []).filter(
        (te) =>
          !te.events?.archived &&
          (te.signups || []).length > 0 &&
          (te.stints || []).filter((s) => s.driver_id && activeStrategyIdSet.has(s.strategy_id)).length === 0,
      )
    : [];

  const unassignedSignups = admin
    ? (unassignedSignupsRaw || []).filter((s) => !s.events?.archived)
    : [];

  // ── Planning section ───────────────────────────────────────────────────────

  const planningTab = (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: engineer ? "1fr" : "1fr 1fr",
          gap: "1.5rem",
          marginBottom: "2rem",
          alignItems: "stretch",
        }}
      >
        {/* Next upcoming event */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <h2 style={{ marginBottom: "1rem" }}>{t("nextEvent")}</h2>
          {nextEvent ? (
            <Link href={`/evenements/${nextEvent.id}`} style={{ textDecoration: "none", flex: 1, display: "flex" }}>
              <div className="card event-card" style={{ cursor: "pointer", flex: 1 }}>
                {(nextEvent.is_special || nextEvent.championship_id) && (
                  <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.35rem" }}>
                    {nextEvent.is_special && <Badge label={t("specialBadge")} />}
                    {nextEvent.championship_id && (
                      <Badge
                        label={`${championshipsMap[nextEvent.championship_id] || "?"} · ${t("round", { number: nextEvent.round_number })}`}
                        color="var(--text-dim)"
                        bg="var(--surface-2)"
                        border="var(--border)"
                      />
                    )}
                  </div>
                )}
                <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "0.35rem" }}>{nextEvent.name}</div>
                <div style={{ fontSize: "0.82rem", color: "var(--text-dim)", marginBottom: "0.5rem" }}>
                  {nextEvent.circuits?.name}
                  {nextEvent.format && ` · ${nextEvent.format}`}
                  {nextEvent.duration_minutes && ` · ${formatDuration(nextEvent.duration_minutes)}`}
                </div>
                <div className="mono" style={{ fontSize: "0.85rem", color: "var(--accent)", marginBottom: "0.25rem" }}>
                  {formatInZone(nextEvent.nextStart.irl_start, nextEvent.timezone || "Europe/Paris", locale)}
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-dim)", marginBottom: "0.5rem" }}>
                  {timeUntil(nextEvent.nextStart.irl_start)}
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>
                  {nextEvent.team_entries?.length || 0}{" "}
                  {(nextEvent.team_entries?.length || 0) !== 1 ? t("teamCount_other") : t("teamCount_one")}
                </div>
              </div>
            </Link>
          ) : (
            <div className="card" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div className="empty">{t("noUpcomingEvent")}</div>
            </div>
          )}
        </div>

        {/* Driver's next planned stint */}
        {!engineer && (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <h2 style={{ marginBottom: "1rem" }}>{t("myNextStint")}</h2>
            {myNextStint ? (
              <Link
                href={`/evenements/${myNextStint.team_entries?.event_id}/equipages/${myNextStint.team_entry_id}`}
                style={{ textDecoration: "none", flex: 1, display: "flex" }}
              >
                <div className="card" style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "0.35rem" }}>
                    {myNextStint.team_entries?.events?.name}
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "var(--text-dim)", marginBottom: "0.5rem" }}>
                    {myNextStint.team_entries?.crew_name} · {t("stintLabel", { number: myNextStint.stint_number })}
                    {myNextStint.rain && " 💧"}
                    {myNextStint.tyre_change && " 🛞"}
                  </div>
                  <div className="mono" style={{ fontSize: "0.85rem", color: "var(--accent)", marginBottom: "0.25rem" }}>
                    {formatInZone(myNextStint.irl_start, myNextStint.team_entries?.events?.timezone || "Europe/Paris", locale)}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>
                    {timeUntil(myNextStint.irl_start)}
                  </div>
                </div>
              </Link>
            ) : (
              <div className="card" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div className="empty">{t("noStintAssigned")}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Driver's upcoming signups */}
      {myUpcomingSignups.length > 0 ? (
        <div style={{ marginBottom: "2rem" }}>
          <h2 style={{ marginBottom: "1rem" }}>{t("myUpcomingEvents")}</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {myUpcomingSignups.map((signup) => {
              const ev = signup.events;
              const starts = (ev?.event_start_times || []).sort((a, b) => new Date(a.irl_start) - new Date(b.irl_start));
              const nextStart = starts.find((s) => new Date(s.irl_start) > now);
              const teamEntry = signup.team_entries;
              return (
                <div
                  key={signup.id}
                  className="card"
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}
                >
                  <div>
                    {(ev?.is_special || ev?.championship_id) && (
                      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.25rem" }}>
                        {ev?.is_special && <Badge label={t("specialBadge")} />}
                        {ev?.championship_id && (
                          <Badge
                            label={`${championshipsMap[ev.championship_id] || "?"} · ${t("round", { number: ev.round_number })}`}
                            color="var(--text-dim)"
                            bg="var(--surface-2)"
                            border="var(--border)"
                          />
                        )}
                      </div>
                    )}
                    <div style={{ fontWeight: 600 }}>{ev?.name}</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginTop: "0.2rem" }}>
                      {ev?.circuits?.name}
                      {nextStart && ` · ${formatInZone(nextStart.irl_start, ev?.timezone || "Europe/Paris", locale)}`}
                      {nextStart && ` · ${timeUntil(nextStart.irl_start)}`}
                    </div>
                    {teamEntry ? (
                      <div style={{ fontSize: "0.78rem", color: "var(--accent)", marginTop: "0.2rem" }}>
                        {teamEntry.crew_name} — {teamEntry.cars?.name || t("noCar")}
                      </div>
                    ) : (
                      <div style={{ fontSize: "0.78rem", color: "var(--text-dim)", marginTop: "0.2rem" }}>
                        {t("notAssigned")}
                      </div>
                    )}
                  </div>
                  <Link href={`/evenements/${ev?.id}`} className="btn btn-secondary btn-sm">
                    {t("view")}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <div className="empty">{t("noUpcomingSignups")}</div>
        </div>
      )}
    </div>
  );

  // ── Suivi sub-tab sections ─────────────────────────────────────────────────

  function groupByEvent(items, getEventId, getEventName) {
    const groups = {};
    for (const item of items) {
      const eid = getEventId(item);
      if (!groups[eid]) groups[eid] = { name: getEventName(item), items: [] };
      groups[eid].items.push(item);
    }
    return Object.entries(groups).sort(([aId], [bId]) => {
      const aNext = eventNextStartMap[aId];
      const bNext = eventNextStartMap[bId];
      if (!aNext && !bNext) return 0;
      if (!aNext) return 1;
      if (!bNext) return -1;
      return aNext - bNext;
    });
  }

  const badgeStyle = {
    fontSize: "0.72rem",
    padding: "0.15rem 0.4rem",
    background: "rgba(224,85,85,0.1)",
    border: "1px solid var(--danger)",
    borderRadius: "2px",
    color: "var(--danger)",
  };

  function SuviSection({ items, getBadge, getEventId, getHref, getName }) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {groupByEvent(items, getEventId, (item) => item.events?.name).map(([eventId, { items: groupItems }]) => (
          <div key={eventId}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginBottom: "0.4rem" }}>
              <span style={{ fontWeight: 700, fontSize: "0.85rem" }}>{groupItems[0]?.events?.name}</span>
              {eventNextStartMap[eventId] && (
                <span style={{ fontSize: "0.75rem", color: "var(--accent)" }}>
                  {timeUntil(eventNextStartMap[eventId].toISOString())}
                </span>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", paddingLeft: "0.75rem", borderLeft: "2px solid var(--border)" }}>
              {groupItems.map((item) => (
                <Link key={item.id} href={getHref(item)} style={{ textDecoration: "none" }}>
                  <div
                    className="card event-card"
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", cursor: "pointer", padding: "0.6rem 0.85rem" }}
                  >
                    <div style={{ fontWeight: 600 }}>{getName(item)}</div>
                    <span style={badgeStyle}>{getBadge()}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const noDriversSection =
    noDrivers.length === 0 ? (
      <div className="table-wrap"><div className="empty">{t("noDriversEmpty")}</div></div>
    ) : (
      <SuviSection
        items={noDrivers}
        getEventId={(te) => te.event_id}
        getHref={(te) => `/evenements/${te.event_id}/equipages/${te.id}`}
        getName={(te) => te.crew_name}
        getBadge={() => t("noDriversBadge")}
      />
    );

  const noStintsSection =
    noStints.length === 0 ? (
      <div className="table-wrap"><div className="empty">{t("noStintsEmpty")}</div></div>
    ) : (
      <SuviSection
        items={noStints}
        getEventId={(te) => te.event_id}
        getHref={(te) => `/evenements/${te.event_id}/equipages/${te.id}`}
        getName={(te) => te.crew_name}
        getBadge={() => t("noStintsBadge")}
      />
    );

  const unassignedSection =
    unassignedSignups.length === 0 ? (
      <div className="table-wrap"><div className="empty">{t("unassignedEmpty")}</div></div>
    ) : (
      <SuviSection
        items={unassignedSignups}
        getEventId={(s) => s.event_id}
        getHref={(s) => `/evenements/${s.event_id}`}
        getName={(s) => s.drivers?.name}
        getBadge={() => t("unassignedBadge")}
      />
    );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="page">
      {/* Stale iRacing sync warning */}
      {currentDriver &&
        !admin &&
        (!currentDriver.last_driver_sync_at ||
          Date.now() - new Date(currentDriver.last_driver_sync_at).getTime() > 100 * 24 * 60 * 60 * 1000) && (
          <div
            style={{
              background: "rgba(245,158,11,0.08)",
              border: "1px solid #f59e0b",
              borderRadius: "4px",
              padding: "0.75rem 1rem",
              marginBottom: "1.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              flexWrap: "wrap",
            }}
          >
            <span style={{ color: "#f59e0b", fontWeight: 600, fontSize: "0.9rem" }}>
              ⚠️ {t("staleSyncWarning")}
            </span>
            <Link
              href={`/pilotes/${currentDriver.id}`}
              className="btn btn-sm"
              style={{ borderColor: "#f59e0b", color: "#f59e0b", background: "transparent" }}
            >
              {t("myProfileArrow")}
            </Link>
          </div>
        )}

      {/* Pending approval warning (admin only) */}
      {admin && pendingCount > 0 && (
        <div
          style={{
            background: "rgba(224,85,85,0.1)",
            border: "1px solid var(--danger)",
            borderRadius: "4px",
            padding: "0.75rem 1rem",
            marginBottom: "1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <span style={{ color: "var(--danger)", fontWeight: 600, fontSize: "0.9rem" }}>
            ⚠️ {pendingCount === 1 ? t("pendingWarning_one").replace("#", pendingCount) : t("pendingWarning_other").replace("#", pendingCount)}
          </span>
          <Link href="/admin" className="btn btn-danger btn-sm">{t("manageAccess")}</Link>
        </div>
      )}

      {/* Page header */}
      <div className="page-header">
        <div>
          <h1>{t("title")}</h1>
          <div className="accent-line" />
          {currentDriver && (
            <div style={{ marginTop: "0.4rem", color: "var(--text-dim)", fontSize: "0.9rem" }}>
              {t("welcome")}{" "}
              <span style={{ color: "var(--text)", fontWeight: 600 }}>{currentDriver.name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "2rem" }}>
        {admin && (
          <>
            <Link href="/pilotes/nouveau" className="btn btn-primary">{t("addDriver")}</Link>
            <Link href="/evenements/nouveau" className="btn btn-primary">{t("createEvent")}</Link>
            <Link href="/championnats/nouveau" className="btn btn-primary">{t("createChampionship")}</Link>
          </>
        )}
        <Link href="/evenements" className="btn btn-secondary">{t("viewEvents")}</Link>
        {currentDriver && (
          <Link href={`/pilotes/${currentDriver.id}`} className="btn btn-secondary">{t("myProfile")}</Link>
        )}
      </div>

      {/* Admin stats grid */}
      {admin && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
            gap: "0.75rem",
            marginBottom: "2rem",
          }}
        >
          {[
            { label: totalEvents !== 1 ? t("statEvents_other") : t("statEvents_one"), value: totalEvents, color: "var(--accent)", href: "/evenements" },
            { label: totalDrivers !== 1 ? t("statActiveDrivers_other") : t("statActiveDrivers_one"), value: totalDrivers, color: "var(--accent)", href: "/admin?filter=all" },
            { label: (inactiveDrivers || 0) !== 1 ? t("statInactiveDrivers_other") : t("statInactiveDrivers_one"), value: inactiveDrivers || 0, color: "var(--text-dim)", href: "/admin?filter=all" },
            { label: (testDrivers || 0) !== 1 ? t("statTestDrivers_other") : t("statTestDrivers_one"), value: testDrivers || 0, color: "var(--text-dim)", href: "/admin?filter=all" },
            { label: t("statPending"), value: pendingCount, color: pendingCount > 0 ? "var(--danger)" : "var(--text-dim)", href: pendingCount > 0 ? "/admin?filter=pending" : undefined },
            { label: (overdueMembers || 0) !== 1 ? t("statOverdue_other") : t("statOverdue_one"), value: overdueMembers || 0, color: overdueMembers > 0 ? "var(--danger)" : "var(--text-dim)", href: "/admin?filter=all" },
            { label: (syncRequired || 0) !== 1 ? t("statSync_other") : t("statSync_one"), value: syncRequired || 0, color: (syncRequired || 0) > 0 ? "#f59e0b" : "var(--text-dim)", href: "/pilotes" },
          ].map(({ label, value, color, href }) => {
            const cardContent = (
              <>
                <div className="mono" style={{ fontSize: "1.8rem", fontWeight: 700, color }}>{value}</div>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-dim)", marginTop: "0.25rem" }}>
                  {label}
                </div>
              </>
            );
            return href ? (
              <Link key={label} href={href} style={{ textDecoration: "none" }}>
                <div className="card" style={{ padding: "1rem", textAlign: "center", cursor: "pointer", height: "100%" }}>{cardContent}</div>
              </Link>
            ) : (
              <div key={label} className="card" style={{ padding: "1rem", textAlign: "center" }}>{cardContent}</div>
            );
          })}
        </div>
      )}

      {admin ? (
        <HomeTabs
          signupCount={myUpcomingSignups.length}
          incompleteCount={noDrivers.length + noStints.length + unassignedSignups.length}
          planningTab={planningTab}
          incompleteTab={
            <IncompleteTab
              noDriversSection={noDriversSection}
              noStintsSection={noStintsSection}
              unassignedSection={unassignedSection}
              noDriversCount={noDrivers.length}
              noStintsCount={noStints.length}
              unassignedCount={unassignedSignups.length}
            />
          }
        />
      ) : (
        planningTab
      )}
    </div>
  );
}
