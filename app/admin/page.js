import { supabaseServer as supabase } from "../../lib/supabase-server";
import { getSessionAndDriver } from "../../lib/auth";
import { redirect } from "next/navigation";
import AdminTabs from "./AdminTabs";
import { isLegacyContent } from "../../lib/car-types";

export default async function AdminPage() {
  const { driver: currentDriver } = await getSessionAndDriver();
  // Redirect non-admin users — this is a server-side guard,
  // middleware also blocks this route but we double-check here
  if (
    !currentDriver ||
    (currentDriver.role !== "admin" && currentDriver.role !== "super_admin")
  ) {
    redirect("/");
  }

  const [
    { data: circuits },
    { data: cars },
    { data: crewNames },
    { data: carClasses },
    { data: eventTypes },
    { data: eventTypeCars },
    { data: drivers },
    { data: settingsData },
    { data: durationPresets },
    { data: specialStartTimes },
    { data: carTypeLabels },
    { data: allCarOwnership },
    { data: allTrackOwnership },
  ] = await Promise.all([
    supabase.from("circuits").select("*").order("name"),
    supabase.from("cars").select("*").order("class").order("name"),
    supabase.from("crew_names").select("*").order("name"),
    supabase.from("car_classes").select("*").order("sort_order"),
    supabase.from("event_types").select("*").order("sort_order"),
    supabase.from("event_type_cars").select("event_type_id, car_id"),
    supabase
      .from("drivers")
      .select(
        "id, name, email, role, approved, refused, iracing_id, discord, discord_id, active, membership_ok, test_driver, iracing_synced_at",
      )
      .order("name"),
    supabase.from("settings").select("key, value"),
    supabase.from("event_duration_presets").select("*").order("minutes"),
    supabase
      .from("special_event_start_times")
      .select("*")
      .order("hour")
      .order("minute"),
    supabase.from("car_type_labels").select("*").order("priority"),
    supabase
      .from("driver_car_ownership")
      .select("driver_id, iracing_car_id, car_name, car_category, car_types"),
    supabase
      .from("driver_track_ownership")
      .select("driver_id, track_name, track_category"),
  ]);

  // Reshape settings rows into a plain key→value object for easier prop passing
  const settings = Object.fromEntries(
    (settingsData || []).map((s) => [s.key, s.value]),
  );

  // ── Inventory matrix data ────────────────────────────────────────────────
  // Only drivers with a completed iRacing sync appear as matrix columns
  const matrixDrivers = (drivers || []).filter(
    (d) => d.approved && d.iracing_synced_at,
  );

  // Build unique cars list — one entry per iracing_car_id
  const carMap = new Map();
  for (const row of allCarOwnership || []) {
    if (!carMap.has(row.iracing_car_id)) {
      carMap.set(row.iracing_car_id, {
        iracing_car_id: row.iracing_car_id,
        car_name: row.car_name,
        car_category: row.car_category,
        car_types: row.car_types,
        isLegacy: isLegacyContent(row.car_name),
      });
    }
  }
  const allCarsMatrix = [...carMap.values()].sort((a, b) =>
    a.car_name.localeCompare(b.car_name),
  );

  // Car ownership map: driver_id → iracing_car_id[]
  const carOwnership = {};
  for (const row of allCarOwnership || []) {
    if (!carOwnership[row.driver_id]) carOwnership[row.driver_id] = [];
    carOwnership[row.driver_id].push(row.iracing_car_id);
  }

  // Build unique base tracks list — deduped by track_name (configs merged)
  const trackMap = new Map();
  for (const row of allTrackOwnership || []) {
    if (!trackMap.has(row.track_name)) {
      trackMap.set(row.track_name, {
        track_name: row.track_name,
        track_category: row.track_category,
        isLegacy: isLegacyContent(row.track_name),
      });
    }
  }
  const allTracksMatrix = [...trackMap.values()].sort((a, b) =>
    a.track_name.localeCompare(b.track_name),
  );

  // Track ownership map: driver_id → track_name[] (any config = owned)
  const trackOwnership = {};
  for (const row of allTrackOwnership || []) {
    if (!trackOwnership[row.driver_id]) trackOwnership[row.driver_id] = [];
    if (!trackOwnership[row.driver_id].includes(row.track_name)) {
      trackOwnership[row.driver_id].push(row.track_name);
    }
  }

  // Kronos reference arrays for matrix badges
  const kronosCarNames = (cars || []).map((c) => c.name);
  const kronosCircuitNames = (circuits || []).map((c) => c.name);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Administration</h1>
          <div className="accent-line" />
          <p
            style={{
              marginTop: "0.5rem",
              color: "var(--text-dim)",
              fontSize: "0.85rem",
            }}
          >
            Données de référence &amp; gestion des accès
          </p>
        </div>
      </div>

      <AdminTabs
        circuits={circuits || []}
        cars={cars || []}
        crewNames={crewNames || []}
        carClasses={carClasses || []}
        eventTypes={eventTypes || []}
        eventTypeCars={eventTypeCars || []}
        drivers={drivers || []}
        currentDriver={currentDriver}
        settings={settings}
        durationPresets={durationPresets || []}
        specialStartTimes={specialStartTimes || []}
        carTypeLabels={carTypeLabels || []}
        matrixDrivers={matrixDrivers}
        allCarsMatrix={allCarsMatrix}
        allTracksMatrix={allTracksMatrix}
        carOwnership={carOwnership}
        trackOwnership={trackOwnership}
        kronosCarNames={kronosCarNames}
        kronosCircuitNames={kronosCircuitNames}
      />
    </div>
  );
}
