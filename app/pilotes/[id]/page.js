import { supabaseServer as supabase } from "../../../lib/supabase-server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionAndDriver, isAdmin } from "../../../lib/auth";
import { formatInZone, formatTimeInZone } from "../../../lib/timezone";
import DriverPageTabs from "./DriverPageTabs";
import DriverStats from "./DriverStats";
import EngagementsTab from "./EngagementsTab";

export default async function DriverDetail({ params, searchParams }) {
  const { id } = await params;
  const {
    iracing_linked,
    iracing_synced,
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

  // Fetch assigned stints
  const { data: stints } =
    teamEntryIds.length > 0
      ? await supabase
          .from("stints")
          .select(
            `
            *,
            team_entries(
              crew_name,
              event_start_times(irl_start),
              events(name, timezone, ig_start_time, ig_sunrise, ig_sunset, championship_id)
            )
          `,
          )
          .eq("driver_id", id)
          .in("team_entry_id", teamEntryIds)
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
      availMap[a.team_entry_id] = { filled: 0, available: 0 };
    availMap[a.team_entry_id].filled++;
    if (a.available === true) availMap[a.team_entry_id].available++;
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
      {/* iRacing sync/OAuth error */}
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
          {![
            "iracing_sync_failed",
            "iracing_token",
            "iracing_profile",
            "iracing_already_linked",
            "iracing_denied",
          ].includes(syncError) &&
            "Une erreur iRacing est survenue. Veuillez réessayer."}
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
        {/* Left: iRacing Lié + Mettre à jour buttons */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
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

      {/* iRacing sync timestamp — shown if data has been synced at least once */}
      {driver.iracing_synced_at && (
        <div
          style={{
            marginBottom: "1.5rem",
            fontSize: "0.8rem",
            color: "var(--text-dim)",
          }}
        >
          Données iRacing synchronisées le{" "}
          {new Date(driver.iracing_synced_at).toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
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
                    }}
                  >
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
                              : label === "iRacing ID"
                                ? "var(--text-dim)"
                                : "var(--accent)",
                        textDecoration:
                          label === "iRacing ID" ? "underline" : "none",
                      }}
                    >
                      {value}
                      {label === "iRacing ID" ? " ↗" : ""}
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
            sortedSignups={sortedSignups}
            availMap={availMap}
            stintsMap={stintsMap}
            carsMap={carsMap}
          />
        }
        statsContent={
          <DriverStats
            stints={stints || []}
            driverPerfData={driverPerfData || []}
            teamPerfData={teamPerfData || []}
            teammatesData={teammatesData || []}
            signups={signups || []}
            iratingHistory={iratingHistoryAll || []}
            currentIrating={driver.irating}
          />
        }
      />
    </div>
  );
}
