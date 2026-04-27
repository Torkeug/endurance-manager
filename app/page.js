import { supabaseServer as supabase } from "../lib/supabase-server";
import { getSessionAndDriver, isAdmin, isEngineer } from "../lib/auth";
import Link from "next/link";
import { formatInZone } from "../lib/timezone";
import HomeTabs from "./HomeTabs";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDuration(minutes) {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

function timeUntil(dtStr) {
  if (!dtStr) return null;
  const diff = new Date(dtStr) - new Date();
  // Returns null for past times — callers use this to filter out elapsed starts
  if (diff < 0) return null;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `dans ${days}j ${hours}h`;
  if (hours > 0) return `dans ${hours}h`;
  return "imminent";
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
  const { driver: currentDriver } = await getSessionAndDriver();
  const admin = isAdmin(currentDriver);
  // Engineers don't have personal stints — "Mon prochain relais" is not relevant to them
  const engineer = isEngineer(currentDriver);

  // ── Data fetching ──────────────────────────────────────────────────────────
  const [
    { data: events },
    { data: mySignups },
    { data: myStints },
    { data: pendingDrivers },
    { count: totalDrivers },
    { count: testDrivers },
    { count: overdueMembers },
    { data: teamEntries },
    { data: championships },
    // Active strategies — used to scope the "no stints" incomplete teams check
    { data: activeStrategies },
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
            // strategies!inner filters to stints that belong to a strategy — .eq below
            // restricts to the active one so "Mon prochain relais" never shows
            // stints from inactive scenario strategies.
            `*, strategies!inner(is_active), team_entries(id, crew_name, event_id, events(name, timezone), event_start_times(label, irl_start))`,
          )
          .eq("driver_id", currentDriver.id)
          .eq("strategies.is_active", true)
          .order("irl_start")
      : { data: [] },

    admin
      ? supabase
          .from("drivers")
          .select("id")
          .eq("approved", false)
          .eq("refused", false)
      : { data: [] },

    admin
      ? supabase
          .from("drivers")
          .select("*", { count: "exact", head: true })
          .eq("active", true)
      : { count: 0 },

    admin
      ? supabase
          .from("drivers")
          .select("*", { count: "exact", head: true })
          .eq("test_driver", true)
          .eq("approved", true)
      : { count: 0 },

    admin
      ? supabase
          .from("drivers")
          .select("*", { count: "exact", head: true })
          .eq("membership_ok", false)
          .eq("approved", true)
          .eq("test_driver", false)
      : { count: 0 },

    admin
      ? supabase
          .from("team_entries")
          .select(
            // strategy_id included so the derived-data check can filter to active strategy only
            `id, crew_name, event_id, events (name), signups (id), stints (id, driver_id, strategy_id)`,
          )
          .order("crew_name")
      : { data: [] },

    supabase.from("championships").select("id, name, archived").order("name"),

    // Fetch active strategy IDs — one per team entry — to scope the stints check below
    admin
      ? supabase
          .from("strategies")
          .select("id, team_entry_id")
          .eq("is_active", true)
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
    .filter(
      (ev) =>
        !ev.championship_id || !archivedChampionshipIds.has(ev.championship_id),
    )
    .map((ev) => {
      const starts = (ev.event_start_times || []).sort(
        (a, b) => new Date(a.irl_start) - new Date(b.irl_start),
      );
      const next = starts.find((s) => new Date(s.irl_start) > now);
      return { ...ev, nextStart: next };
    })
    .filter((ev) => ev.nextStart)
    .sort(
      (a, b) =>
        new Date(a.nextStart.irl_start) - new Date(b.nextStart.irl_start),
    );

  const nextEvent = upcomingEvents[0] || null;

  const myNextStint =
    (myStints || [])
      .filter((s) => s.irl_start && new Date(s.irl_start) > now)
      .sort((a, b) => new Date(a.irl_start) - new Date(b.irl_start))[0] || null;

  const myUpcomingSignups = (mySignups || [])
    .filter(
      (s) =>
        !s.events?.championship_id ||
        !archivedChampionshipIds.has(s.events.championship_id),
    )
    .filter((s) => {
      const starts = s.events?.event_start_times || [];
      return starts.some((st) => new Date(st.irl_start) > now);
    })
    .sort((a, b) => {
      const aStart = Math.min(
        ...(a.events?.event_start_times || []).map(
          (st) => new Date(st.irl_start),
        ),
      );
      const bStart = Math.min(
        ...(b.events?.event_start_times || []).map(
          (st) => new Date(st.irl_start),
        ),
      );
      return aStart - bStart;
    });

  const pendingCount = (pendingDrivers || []).length;
  const totalEvents = (events || []).length;

  // Admin: team entries with zero signups
  const noDrivers = admin
    ? (teamEntries || []).filter((te) => (te.signups || []).length === 0)
    : [];

  // Active strategy IDs as a Set for O(1) lookup
  const activeStrategyIdSet = new Set(
    (activeStrategies || []).map((s) => s.id),
  );

  // Admin: team entries with signups but no assigned stints in their active strategy.
  // Scoped to active strategy only — inactive scenario strategies are excluded
  // so a team with stints only in a non-active strategy correctly appears here.
  const noStints = admin
    ? (teamEntries || []).filter(
        (te) =>
          (te.signups || []).length > 0 &&
          (te.stints || []).filter(
            (s) => s.driver_id && activeStrategyIdSet.has(s.strategy_id),
          ).length === 0,
      )
    : [];

  // ── Planning section — server-rendered JSX, passed as a slot to HomeTabs ──

  const planningTab = (
    <div>
      {/* Next event + next stint side by side */}
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
          <h2 style={{ marginBottom: "1rem" }}>Prochain événement</h2>
          {nextEvent ? (
            <Link
              href={`/evenements/${nextEvent.id}`}
              style={{ textDecoration: "none", flex: 1, display: "flex" }}
            >
              <div
                className="card event-card"
                style={{ cursor: "pointer", flex: 1 }}
              >
                {(nextEvent.is_special || nextEvent.championship_id) && (
                  <div
                    style={{
                      display: "flex",
                      gap: "0.4rem",
                      flexWrap: "wrap",
                      marginBottom: "0.35rem",
                    }}
                  >
                    {nextEvent.is_special && <Badge label="Spécial" />}
                    {nextEvent.championship_id && (
                      <Badge
                        label={`${championshipsMap[nextEvent.championship_id] || "?"} · Manche ${nextEvent.round_number}`}
                        color="var(--text-dim)"
                        bg="var(--surface-2)"
                        border="var(--border)"
                      />
                    )}
                  </div>
                )}
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: "1rem",
                    marginBottom: "0.35rem",
                  }}
                >
                  {nextEvent.name}
                </div>
                <div
                  style={{
                    fontSize: "0.82rem",
                    color: "var(--text-dim)",
                    marginBottom: "0.5rem",
                  }}
                >
                  {nextEvent.circuits?.name}
                  {nextEvent.format && ` · ${nextEvent.format}`}
                  {nextEvent.duration_minutes &&
                    ` · ${formatDuration(nextEvent.duration_minutes)}`}
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: "0.85rem",
                    color: "var(--accent)",
                    marginBottom: "0.25rem",
                  }}
                >
                  {formatInZone(
                    nextEvent.nextStart.irl_start,
                    nextEvent.timezone || "Europe/Paris",
                  )}
                </div>
                <div
                  style={{
                    fontSize: "0.78rem",
                    color: "var(--text-dim)",
                    marginBottom: "0.5rem",
                  }}
                >
                  {timeUntil(nextEvent.nextStart.irl_start)}
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>
                  {nextEvent.team_entries?.length || 0} équipage
                  {(nextEvent.team_entries?.length || 0) !== 1 ? "s" : ""}
                </div>
              </div>
            </Link>
          ) : (
            <div
              className="card"
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div className="empty">Aucun événement à venir.</div>
            </div>
          )}
        </div>

        {/* Driver's next planned stint */}
        {!engineer && (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <h2 style={{ marginBottom: "1rem" }}>Mon prochain relais</h2>
            {myNextStint ? (
              <Link
                href={`/evenements/${myNextStint.team_entries?.event_id}/equipages/${myNextStint.team_entry_id}`}
                style={{ textDecoration: "none", flex: 1, display: "flex" }}
              >
                <div className="card" style={{ flex: 1 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: "1rem",
                      marginBottom: "0.35rem",
                    }}
                  >
                    {myNextStint.team_entries?.events?.name}
                  </div>
                  <div
                    style={{
                      fontSize: "0.82rem",
                      color: "var(--text-dim)",
                      marginBottom: "0.5rem",
                    }}
                  >
                    {myNextStint.team_entries?.crew_name} · Relais #
                    {myNextStint.stint_number}
                    {myNextStint.rain && " 💧"}
                    {myNextStint.tyre_change && " 🛞"}
                  </div>
                  <div
                    className="mono"
                    style={{
                      fontSize: "0.85rem",
                      color: "var(--accent)",
                      marginBottom: "0.25rem",
                    }}
                  >
                    {formatInZone(
                      myNextStint.irl_start,
                      myNextStint.team_entries?.events?.timezone ||
                        "Europe/Paris",
                    )}
                  </div>
                  <div
                    style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}
                  >
                    {timeUntil(myNextStint.irl_start)}
                  </div>
                </div>
              </Link>
            ) : (
              <div
                className="card"
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div className="empty">Aucun relais assigné.</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Driver's upcoming signups */}
      {myUpcomingSignups.length > 0 ? (
        <div style={{ marginBottom: "2rem" }}>
          <h2 style={{ marginBottom: "1rem" }}>Mes événements à venir</h2>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
          >
            {myUpcomingSignups.map((signup) => {
              const ev = signup.events;
              const starts = (ev?.event_start_times || []).sort(
                (a, b) => new Date(a.irl_start) - new Date(b.irl_start),
              );
              const nextStart = starts.find((s) => new Date(s.irl_start) > now);
              const teamEntry = signup.team_entries;
              return (
                <div
                  key={signup.id}
                  className="card"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "1rem",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    {(ev?.is_special || ev?.championship_id) && (
                      <div
                        style={{
                          display: "flex",
                          gap: "0.4rem",
                          flexWrap: "wrap",
                          marginBottom: "0.25rem",
                        }}
                      >
                        {ev?.is_special && <Badge label="Spécial" />}
                        {ev?.championship_id && (
                          <Badge
                            label={`${championshipsMap[ev.championship_id] || "?"} · Manche ${ev.round_number}`}
                            color="var(--text-dim)"
                            bg="var(--surface-2)"
                            border="var(--border)"
                          />
                        )}
                      </div>
                    )}
                    <div style={{ fontWeight: 600 }}>{ev?.name}</div>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--text-dim)",
                        marginTop: "0.2rem",
                      }}
                    >
                      {ev?.circuits?.name}
                      {nextStart &&
                        ` · ${formatInZone(nextStart.irl_start, ev?.timezone || "Europe/Paris")}`}
                      {nextStart && ` · ${timeUntil(nextStart.irl_start)}`}
                    </div>
                    {teamEntry ? (
                      <div
                        style={{
                          fontSize: "0.78rem",
                          color: "var(--accent)",
                          marginTop: "0.2rem",
                        }}
                      >
                        {teamEntry.crew_name} —{" "}
                        {teamEntry.cars?.name || "Voiture à définir"}
                      </div>
                    ) : (
                      <div
                        style={{
                          fontSize: "0.78rem",
                          color: "var(--text-dim)",
                          marginTop: "0.2rem",
                        }}
                      >
                        Non assigné à une équipe
                      </div>
                    )}
                  </div>
                  <Link
                    href={`/evenements/${ev?.id}`}
                    className="btn btn-secondary btn-sm"
                  >
                    Voir →
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <div className="empty">Aucune inscription à venir.</div>
        </div>
      )}
    </div>
  );

  // ── Incomplete teams section — server-rendered JSX ──────────────────────

  const incompleteTab = (
    <div>
      {noDrivers.length === 0 && noStints.length === 0 ? (
        <div className="table-wrap">
          <div className="empty">Aucun équipage incomplet. ✓</div>
        </div>
      ) : (
        <>
          {noDrivers.length > 0 && (
            <div style={{ marginBottom: "2rem" }}>
              <h2 style={{ marginBottom: "1rem" }}>Équipages sans pilotes</h2>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                {noDrivers.map((te) => (
                  <Link
                    key={te.id}
                    href={`/evenements/${te.event_id}/equipages/${te.id}`}
                    style={{ textDecoration: "none" }}
                  >
                    <div
                      className="card event-card"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "1rem",
                        cursor: "pointer",
                        padding: "0.75rem 1rem",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>{te.crew_name}</div>
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "var(--text-dim)",
                          }}
                        >
                          {te.events?.name}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          padding: "0.15rem 0.4rem",
                          background: "rgba(224,85,85,0.1)",
                          border: "1px solid var(--danger)",
                          borderRadius: "2px",
                          color: "var(--danger)",
                        }}
                      >
                        Aucun pilote
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {noStints.length > 0 && (
            <div>
              <h2 style={{ marginBottom: "1rem" }}>
                Équipages sans relais planifiés
              </h2>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                {noStints.map((te) => (
                  <Link
                    key={te.id}
                    href={`/evenements/${te.event_id}/equipages/${te.id}`}
                    style={{ textDecoration: "none" }}
                  >
                    <div
                      className="card event-card"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "1rem",
                        cursor: "pointer",
                        padding: "0.75rem 1rem",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>{te.crew_name}</div>
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "var(--text-dim)",
                          }}
                        >
                          {te.events?.name}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          padding: "0.15rem 0.4rem",
                          background: "rgba(224,85,85,0.1)",
                          border: "1px solid var(--danger)",
                          borderRadius: "2px",
                          color: "var(--danger)",
                        }}
                      >
                        Aucun relais
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="page">
      {/* Stale iRacing sync warning — shown to the logged-in driver when their own data is stale */}
      {currentDriver &&
        !admin &&
        (!currentDriver.last_driver_sync_at ||
          Date.now() - new Date(currentDriver.last_driver_sync_at).getTime() >
            100 * 24 * 60 * 60 * 1000) && (
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
            <span
              style={{ color: "#f59e0b", fontWeight: 600, fontSize: "0.9rem" }}
            >
              ⚠️ Vos données iRacing n&apos;ont pas été synchronisées depuis
              plus de 100 jours.
            </span>
            <Link
              href={`/pilotes/${currentDriver.id}`}
              className="btn btn-sm"
              style={{
                borderColor: "#f59e0b",
                color: "#f59e0b",
                background: "transparent",
              }}
            >
              Mon profil →
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
          <span
            style={{
              color: "var(--danger)",
              fontWeight: 600,
              fontSize: "0.9rem",
            }}
          >
            ⚠️ {pendingCount} pilote{pendingCount > 1 ? "s " : " "}en attente
            d&apos;approbation
          </span>
          <Link href="/admin" className="btn btn-danger btn-sm">
            Gérer les accès →
          </Link>
        </div>
      )}

      {/* Page header */}
      <div className="page-header">
        <div>
          <h1>Tableau de bord</h1>
          <div className="accent-line" />
          {currentDriver && (
            <div
              style={{
                marginTop: "0.4rem",
                color: "var(--text-dim)",
                fontSize: "0.9rem",
              }}
            >
              Bienvenue,{" "}
              <span style={{ color: "var(--text)", fontWeight: 600 }}>
                {currentDriver.name}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Quick actions — always at the top */}
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          flexWrap: "wrap",
          marginBottom: "2rem",
        }}
      >
        {admin && (
          <>
            <Link href="/pilotes/nouveau" className="btn btn-primary">
              + Ajouter un pilote
            </Link>
            <Link href="/evenements/nouveau" className="btn btn-primary">
              + Créer un événement
            </Link>
            <Link href="/championnats/nouveau" className="btn btn-primary">
              + Créer un championnat
            </Link>
          </>
        )}
        <Link href="/evenements" className="btn btn-secondary">
          Voir les événements
        </Link>
        {currentDriver && (
          <Link
            href={`/pilotes/${currentDriver.id}`}
            className="btn btn-secondary"
          >
            Mon profil
          </Link>
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
            {
              label: totalEvents > 1 ? "Événements" : "Événement",
              value: totalEvents,
              color: "var(--accent)",
            },
            {
              label: totalDrivers > 1 ? "Pilotes actifs" : "Pilote actif",
              value: totalDrivers,
              color: "var(--accent)",
            },
            {
              label: "En attente",
              value: pendingCount,
              color: pendingCount > 0 ? "var(--danger)" : "var(--text-dim)",
            },
            {
              label: (testDrivers || 0) > 1 ? "Pilotes test" : "Pilote test",
              value: testDrivers || 0,
              color: "var(--text-dim)",
            },
            {
              label:
                (overdueMembers || 0) > 1
                  ? "Cotisations expirées"
                  : "Cotisation expirée",
              value: overdueMembers || 0,
              color: overdueMembers > 0 ? "var(--danger)" : "var(--text-dim)",
            },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="card"
              style={{ padding: "1rem", textAlign: "center" }}
            >
              <div
                className="mono"
                style={{ fontSize: "1.8rem", fontWeight: 700, color }}
              >
                {value}
              </div>
              <div
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-dim)",
                  marginTop: "0.25rem",
                }}
              >
                {label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Admin: tabbed content — HomeTabs is a thin client shell, content is server-rendered */}
      {admin ? (
        <HomeTabs
          signupCount={myUpcomingSignups.length}
          incompleteCount={noDrivers.length + noStints.length}
          planningTab={planningTab}
          incompleteTab={incompleteTab}
        />
      ) : (
        // Non-admin: render planning content directly, no client component needed
        planningTab
      )}
    </div>
  );
}
