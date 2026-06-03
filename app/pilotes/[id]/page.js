import { supabaseServer as supabase } from "../../../lib/supabase-server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionAndDriver, isAdmin } from "../../../lib/auth";
import DriverPageTabs from "./DriverPageTabs";
import DriverStats from "./DriverStats";
import EngagementsTab from "./EngagementsTab";
import LocalDate from "../../../components/LocalDate";

export default async function DriverDetail({ params, searchParams }) {
  const { id } = await params;
  const {
    iracing_linked,
    iracing_synced,
    garage61_linked,
    error: syncError,
  } = await searchParams;
  const { driver: currentDriver } = await getSessionAndDriver();
  const admin = isAdmin(currentDriver);

  // Fetch driver
  const { data: driver, error } = await supabase
    .from("drivers")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !driver) notFound();

  // Backfill garage61_slug for drivers who linked before slug-saving was added
  if (driver.garage61_access_token && !driver.garage61_slug) {
    try {
      const meRes = await fetch("https://garage61.net/api/v1/me", {
        headers: { Authorization: `Bearer ${driver.garage61_access_token}` },
      });
      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData.slug) {
          await supabase
            .from("drivers")
            .update({ garage61_slug: meData.slug })
            .eq("id", driver.id);
          driver.garage61_slug = meData.slug;
        }
      }
    } catch {
      // non-critical — slug will be populated on next visit or re-link
    }
  }

  // Fetch all signups for this driver with full context
  const { data: signups } = await supabase
    .from("signups")
    .select(
      `
    *,
    events (
      id, name, duration_minutes, format, championship_id, archived,
      circuits (name),
      event_start_times (id, label, irl_start)
    ),
    team_entries (
      id, crew_name, class,
      cars (name),
      event_start_times (label, irl_start)
    )
  `,
    )
    .eq("driver_id", id)
    .order("created_at", { ascending: false });

  // Availabilities are stored per team_entry_id, not per event —
  // collect all team entry IDs from signups before querying.
  const teamEntryIds = (signups || [])
    .map((s) => s.team_entry_id)
    .filter(Boolean);

  const { data: availData } =
    teamEntryIds.length > 0
      ? await supabase
          .from("availabilities")
          .select("team_entry_id, available")
          .eq("driver_id", id)
          .in("team_entry_id", teamEntryIds)
      : { data: [] };

  // Fetch assigned stints — scoped to active strategy per team entry so driver
  // stats and stint history don't double-count laps across scenario strategies.
  const { data: stints } =
    teamEntryIds.length > 0
      ? await supabase
          .from("stints")
          .select(
            `
            *,
            strategies!inner(is_active),
            team_entries(
              crew_name,
              event_start_times(irl_start),
              events(name, timezone, ig_start_time, ig_sunrise, ig_sunset, championship_id)
            )
          `,
          )
          .eq("driver_id", id)
          .in("team_entry_id", teamEntryIds)
          .eq("strategies.is_active", true)
          .order("stint_number")
      : { data: [] };

  // Driver's performance data across all team entries, with circuit info
  const { data: driverPerfData } =
    teamEntryIds.length > 0
      ? await supabase
          .from("driver_performance")
          .select("*, team_entries(id, events(name, circuits(name)))")
          .eq("driver_id", id)
          .in("team_entry_id", teamEntryIds)
      : { data: [] };

  // All teammates' performance data for the same team entries (fuel comparison)
  const { data: teamPerfData } =
    teamEntryIds.length > 0
      ? await supabase
          .from("driver_performance")
          .select(
            "driver_id, team_entry_id, fuel_dry, fuel_wet, fuel_night_dry, fuel_night_wet, lap_time_dry, lap_time_wet",
          )
          .in("team_entry_id", teamEntryIds)
          .neq("driver_id", id)
      : { data: [] };

  // Co-drivers in the same team entries (teammate frequency)
  const { data: teammatesData } =
    teamEntryIds.length > 0
      ? await supabase
          .from("signups")
          .select("driver_id, team_entry_id, drivers(id, name)")
          .in("team_entry_id", teamEntryIds)
          .neq("driver_id", id)
      : { data: [] };

  // Irating history to build irating graph
  const { data: iratingHistoryAll } = await supabase
    .from("irating_history")
    .select("irating, recorded_at, category_id")
    .eq("driver_id", id)
    .order("recorded_at", { ascending: true });

  // Build team_entry_id → { filled, available } map for O(1) lookup per signup card.
  // filled = total slots entered, available = slots marked green.
  const availMap = {};
  (availData || []).forEach((a) => {
    if (!availMap[a.team_entry_id])
      availMap[a.team_entry_id] = { filled: 0, available: 0, tentative: 0 };
    availMap[a.team_entry_id].filled++;
    if (a.available === true) availMap[a.team_entry_id].available++;
    // null = tentative/incertain — counts as renseigné
    if (a.available === null) availMap[a.team_entry_id].tentative++;
  });

  // Build stints map: team_entry_id → stints[]
  const stintsMap = {};
  (stints || []).forEach((s) => {
    if (!stintsMap[s.team_entry_id]) stintsMap[s.team_entry_id] = [];
    stintsMap[s.team_entry_id].push(s);
  });

  // Sort by earliest start time descending — uses Math.min across all start
  // times rather than [0] which is Supabase insertion order, not chronological.
  const sortedSignups = (signups || []).sort((a, b) => {
    const aDate =
      Math.min(
        ...(a.events?.event_start_times || []).map(
          (st) => new Date(st.irl_start),
        ),
      ) || 0;
    const bDate =
      Math.min(
        ...(b.events?.event_start_times || []).map(
          (st) => new Date(st.irl_start),
        ),
      ) || 0;
    return bDate - aDate;
  });

  // Fetch all cars for preferred car ID resolution in EngagementsTab
  const { data: allCars } = await supabase.from("cars").select("id, name");
  const carsMap = Object.fromEntries(
    (allCars || []).map((c) => [c.id, c.name]),
  );

  const socials = [
    {
      label: "iRacing ID",
      value: driver.iracing_id,
      link: driver.iracing_id
        ? `https://members-ng.iracing.com/web/racing/profile?cust_id=${driver.iracing_id}&tab=licenses`
        : null,
    },
    { label: "Email", value: driver.email || "—" },
    { label: "Discord", value: driver.discord || "—" },
    {
      label: "Alerte relais",
      value: driver.discord_alert_enabled && driver.discord_alert_minutes
        ? `${driver.discord_alert_minutes} min`
        : "Désactivée",
    },
    {
      label: "Twitch",
      value: driver.twitch,
      link: driver.twitch ? `https://twitch.tv/${driver.twitch}` : null,
    },
    {
      label: "Instagram",
      value: driver.instagram,
      link: driver.instagram
        ? `https://instagram.com/${driver.instagram}`
        : null,
    },
    {
      label: "Garage61",
      value: driver.garage61_slug,
      link: driver.garage61_slug
        ? `https://garage61.net/app/drivers/${driver.garage61_slug}`
        : null,
    },
    // Always show Email even if empty — it's the primary contact field.
    // Other socials are filtered out if not set to keep the card clean.
  ].filter((s) => s.value || s.label === "Email");

  return (
    <div className="page">
      {/* ────────────────────────────────────────────────────────────────────────
          SECTION 1: Name + iR (left) | Back button (right)
          ──────────────────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "1rem",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1>{driver.name}</h1>
          <div className="accent-line" />
          <div
            style={{
              marginTop: "0.4rem",
              display: "flex",
              gap: "1rem",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <span
              className="mono"
              style={{ color: "var(--accent)", fontSize: "0.9rem" }}
            >
              {driver.irating
                ? `${driver.irating} iR`
                : "iRating non renseigné"}
            </span>
            {!driver.active && (
              <span className="badge badge-driver">Inactif</span>
            )}
          </div>
        </div>
        {/* Back button — top right */}
        <Link href="/pilotes" className="btn btn-secondary">
          ← Pilotes
        </Link>
      </div>

      {/* Staleness warning — shown to admins and to the driver themselves */}
      {(admin || currentDriver?.id === id) &&
        (!driver.last_driver_sync_at ||
          Date.now() - new Date(driver.last_driver_sync_at).getTime() >
            100 * 24 * 60 * 60 * 1000) && (
          <div
            style={{
              marginBottom: "1rem",
              padding: "0.65rem 1rem",
              background: "rgba(245,158,11,0.08)",
              border: "1px solid #f59e0b",
              borderRadius: "4px",
              fontSize: "0.85rem",
              color: "#f59e0b",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              flexWrap: "wrap",
            }}
          >
            <span>
              ⚠️ Les données iRacing (inventaire voitures &amp; circuits)
              n&apos;ont pas été synchronisées depuis plus de 100 jours.
            </span>
            {/* Only show the sync button to the driver themselves */}
            {currentDriver?.id === id && driver.iracing_id && (
              <a
                href={`/auth/iracing?mode=driver&returnTo=/pilotes/${id}`}
                className="btn btn-sm"
                style={{
                  borderColor: "#f59e0b",
                  color: "#f59e0b",
                  background: "transparent",
                  whiteSpace: "nowrap",
                }}
              >
                🔄 Synchroniser maintenant
              </a>
            )}
          </div>
        )}

      {/* iRacing first-link success */}
      {iracing_linked === "true" && (
        <div className="alert alert-success" style={{ marginBottom: "1rem" }}>
          ✓ Compte iRacing lié avec succès.
        </div>
      )}
      {/* iRacing re-sync success */}
      {iracing_synced === "true" && (
        <div className="alert alert-success" style={{ marginBottom: "1rem" }}>
          ✓ Synchronisation réussie — inventaire mis à jour.
        </div>
      )}
      {/* Garage61 first-link success */}
      {garage61_linked === "true" && (
        <div className="alert alert-success" style={{ marginBottom: "1rem" }}>
          ✓ Compte Garage61 lié avec succès.
        </div>
      )}
      {/* iRacing / Garage61 OAuth errors — both use the same ?error= param */}
      {syncError && (
        <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
          {syncError === "iracing_sync_failed" &&
            "Erreur lors de la synchronisation iRacing. Vos données n'ont pas été modifiées."}
          {syncError === "iracing_token" &&
            "Erreur d'authentification iRacing. Veuillez réessayer."}
          {syncError === "iracing_profile" &&
            "Impossible de récupérer le profil iRacing. Veuillez réessayer."}
          {syncError === "iracing_already_linked" &&
            "Ce compte iRacing est déjà lié à un autre pilote."}
          {syncError === "iracing_denied" && "Autorisation iRacing refusée."}
          {syncError === "garage61_denied" &&
            "Autorisation Garage61 refusée."}
          {syncError === "garage61_token" &&
            "Erreur d'authentification Garage61. Veuillez réessayer."}
          {syncError === "garage61_save" &&
            "Impossible d'enregistrer les tokens Garage61. Veuillez réessayer."}
          {syncError === "garage61_no_driver" &&
            "Compte Garage61 : profil pilote introuvable. Contactez un administrateur."}
          {syncError === "garage61_error" &&
            "Une erreur inattendue est survenue lors de la liaison Garage61. Veuillez réessayer."}
          {![
            "iracing_sync_failed",
            "iracing_token",
            "iracing_profile",
            "iracing_already_linked",
            "iracing_denied",
            "garage61_denied",
            "garage61_token",
            "garage61_save",
            "garage61_no_driver",
            "garage61_error",
          ].includes(syncError) &&
            "Une erreur d'authentification est survenue. Veuillez réessayer."}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          SECTION 2: iRacing buttons (left) | Inventory button (right) + sync timestamp
          ──────────────────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          marginBottom: "0.5rem",
          flexWrap: "wrap",
        }}
      >
        {/* Left: iRacing + Garage61 connection buttons */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {/* Garage61 — only shown to the driver themselves */}
          {currentDriver?.id === id &&
            (driver.garage61_access_token ? (
              <span
                className="btn btn-sm"
                style={{
                  background: "var(--surface-2)",
                  color: "#2eb460",
                  border: "1px solid #2eb460",
                  cursor: "default",
                }}
              >
                ✓ Garage61 lié
              </span>
            ) : (
              <a
                href={`/auth/garage61?returnTo=/pilotes/${id}`}
                className="btn btn-primary btn-sm"
              >
                🔗 Lier Garage61
              </a>
            ))}

          {currentDriver?.id === id &&
            (driver.iracing_id ? (
              <>
                <span
                  className="btn btn-sm"
                  style={{
                    background: "var(--surface-2)",
                    color: "#2eb460",
                    border: "1px solid #2eb460",
                    cursor: "default",
                  }}
                >
                  ✓ iRacing lié
                </span>
                <a
                  href={`/auth/iracing?mode=driver&returnTo=/pilotes/${id}`}
                  className="btn btn-secondary btn-sm"
                >
                  🔄 Mettre à jour
                </a>
              </>
            ) : (
              <a
                href={`/auth/iracing?mode=driver&returnTo=/pilotes/${id}`}
                className="btn btn-primary btn-sm"
              >
                🏎️ Lier iRacing
              </a>
            ))}
        </div>

        {/* Right: Inventory button */}
        {(admin || currentDriver?.id === id) && (
          <Link
            href={`/pilotes/${id}/inventaire`}
            className="btn btn-secondary btn-sm"
          >
            📦 Inventaire
          </Link>
        )}
      </div>

      {/* iRacing sync timestamps — iRating updated by syncall or driver mode,
          inventory only updated by driver mode (last_driver_sync_at) */}
      {(driver.iracing_synced_at || driver.last_driver_sync_at) && (
        <div
          style={{
            marginBottom: "1.5rem",
            fontSize: "0.8rem",
            color: "var(--text-dim)",
            display: "flex",
            flexDirection: "column",
            gap: "0.2rem",
          }}
        >
          {driver.iracing_synced_at && (
            <span>
              iRating synchronisé le{" "}
              <LocalDate iso={driver.iracing_synced_at} />
            </span>
          )}
          {driver.last_driver_sync_at && (
            <span>
              Inventaire synchronisé le{" "}
              <LocalDate iso={driver.last_driver_sync_at} />
            </span>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          Summary card: Data grid (left) + Auth buttons (right)
          ──────────────────────────────────────────────────────────────────────── */}
      {socials.length > 0 && (
        <div className="card" style={{ marginBottom: "2rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "1.5rem",
              flexWrap: "wrap",
            }}
          >
            {/* Left: Socials data grid */}
            <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
              {socials.map(({ label, value, link }) => (
                <div key={label}>
                  <div
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "var(--text-dim)",
                      marginBottom: "0.2rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.3rem",
                    }}
                  >
                    {(label === "Discord" || label === "Alerte relais") && (
                      <svg viewBox="0 0 24 24" fill="#5865F2" style={{ width: 10, height: 10, flexShrink: 0 }}>
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.001.033.022.063.044.083a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                      </svg>
                    )}
                    {label}
                  </div>
                  {link ? (
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mono"
                      style={{
                        fontSize: "0.85rem",
                        color:
                          label === "Instagram"
                            ? "#405DE6"
                            : label === "Twitch"
                              ? "#9147ff"
                              : label === "Garage61"
                                ? "#e85d26"
                                : label === "iRacing ID"
                                  ? "var(--text-dim)"
                                  : "var(--accent)",
                        textDecoration:
                          label === "iRacing ID" || label === "Garage61"
                            ? "underline"
                            : "none",
                      }}
                    >
                      {value}
                      {label === "iRacing ID" || label === "Garage61"
                        ? " ↗"
                        : ""}
                    </a>
                  ) : (
                    <span className="mono" style={{ fontSize: "0.85rem" }}>
                      {value}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Right: Auth buttons (Changer mot de passe + Modifier) */}
            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                flexWrap: "wrap",
                justifyContent: "flex-end",
              }}
            >
              {currentDriver?.id === id && (
                <Link
                  href="/change-password"
                  className="btn btn-secondary btn-sm"
                >
                  Changer mot de passe
                </Link>
              )}
              {(admin || currentDriver?.id === id) && (
                <Link
                  href={`/pilotes/${id}/modifier`}
                  className="btn btn-secondary btn-sm"
                >
                  Modifier
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          Engagements section
          ──────────────────────────────────────────────────────────────────────── */}
      <DriverPageTabs
        engagementsContent={
          <EngagementsTab
            key="engagements"
            sortedSignups={sortedSignups}
            availMap={availMap}
            stintsMap={stintsMap}
            carsMap={carsMap}
          />
        }
        statsContent={
          <DriverStats
            key="statistiques"
            stints={stints || []}
            driverPerfData={driverPerfData || []}
            teamPerfData={teamPerfData || []}
            teammatesData={teammatesData || []}
            signups={signups || []}
            iratingHistory={iratingHistoryAll || []}
            currentIrating={driver.irating}
            garage61Slug={driver.garage61_slug ?? null}
          />
        }
      />
    </div>
  );
}
