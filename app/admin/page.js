import { supabaseServer as supabase } from "../../lib/supabase-server";
import { getSessionAndDriver } from "../../lib/auth";
import { redirect } from "next/navigation";
import AdminTabs from "./AdminTabs";
import { isLegacyContent } from "../../lib/car-types";
import { getTranslations } from "next-intl/server";

export default async function AdminPage() {
  const t = await getTranslations("admin");
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
    { data: iracingCars },
    { data: iracingTracks },
    { data: allCarOwnership },
    { data: allTrackOwnership },
    { data: signupTags },
  ] = await Promise.all([
    supabase.from("circuits").select("*, iracing_track_id").order("name"),
    supabase.from("cars").select("*").order("class").order("name"),
    supabase.from("crew_names").select("*").order("name"),
    supabase.from("car_classes").select("*").order("sort_order"),
    supabase.from("event_types").select("*").order("sort_order"),
    supabase.from("event_type_cars").select("event_type_id, car_id"),
    (() => {
      let q = supabase
        .from("drivers")
        .select(
          "id, name, email, role, approved, refused, iracing_id, discord, discord_id, active, membership_ok, test_driver, is_test_account, iracing_synced_at",
        )
        .order("name");
      if (process.env.NEXT_PUBLIC_SHOW_TEST_ACCOUNTS !== "true") {
        q = q.eq("is_test_account", false);
      }
      return q;
    })(),
    supabase.from("settings").select("key, value"),
    supabase.from("event_duration_presets").select("*").order("minutes"),
    supabase
      .from("special_event_start_times")
      .select("*")
      .order("hour")
      .order("minute"),
    supabase
      .from("iracing_cars")
      .select("iracing_car_id, car_name, car_types, car_type_label")
      .order("car_name"),
    supabase
      .from("iracing_tracks")
      .select("iracing_track_id, track_name, config_name, track_category")
      .order("track_name"),
    supabase
      .from("driver_car_ownership")
      .select("driver_id, iracing_car_id, car_name, car_category, car_types"),
    supabase
      .from("driver_track_ownership")
      .select("driver_id, track_name, track_category"),
    supabase.from("signup_tags").select("*").order("sort_order").order("name"),
  ]);

  // Reshape settings rows into a plain key→value object for easier prop passing
  const settings = Object.fromEntries(
    (settingsData || []).map((s) => [s.key, s.value]),
  );

  // ── Inventory matrix data ────────────────────────────────────────────────
  // Only drivers with a completed iRacing sync appear as matrix columns
  const matrixDrivers = (drivers || []).filter(
    (d) => d.approved && d.active !== false && d.iracing_synced_at,
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

  // Build unique base tracks list — deduped by track_name
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

  // Kronos cars map: iracing_car_id → { class, car_type_label }
  // Used by matrix and inventaire for class grouping and Kronos badge
  const kronosCarsMap = {};
  for (const car of cars || []) {
    if (car.iracing_car_id) {
      kronosCarsMap[car.iracing_car_id] = {
        class: car.class,
        car_type_label: car.car_type_label,
      };
    }
  }

  // Catalog label map: iracing_car_id → car_type_label for non-Kronos cars
  // Same fallback used in inventaire/page.js
  const iracingLabelById = {};
  for (const car of iracingCars || []) {
    if (car.car_type_label)
      iracingLabelById[car.iracing_car_id] = car.car_type_label;
  }

  // Kronos circuits map: iracing_track_id → circuit (for exact badge matching)
  const kronosCircuitsByTrackId = {};
  for (const circuit of circuits || []) {
    if (circuit.iracing_track_id) {
      kronosCircuitsByTrackId[circuit.iracing_track_id] = circuit;
    }
  }

  // Keep name-based fallback for circuits not yet linked to iRacing
  const kronosCircuitNames = (circuits || [])
    .filter((c) => !c.iracing_track_id)
    .map((c) => c.name);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{t("pageTitle")}</h1>
          <div className="accent-line" />
          <p
            style={{
              marginTop: "0.5rem",
              color: "var(--text-dim)",
              fontSize: "0.85rem",
            }}
          >
            {t("pageSubtitle")}
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
        signupTags={signupTags || []}
        iracingCars={iracingCars || []}
        matrixDrivers={matrixDrivers}
        allCarsMatrix={allCarsMatrix}
        allTracksMatrix={allTracksMatrix}
        carOwnership={carOwnership}
        trackOwnership={trackOwnership}
        kronosCircuitNames={kronosCircuitNames}
        kronosCarsMap={kronosCarsMap}
        iracingLabelById={iracingLabelById}
        iracingTracks={iracingTracks || []}
        kronosCircuitsByTrackId={kronosCircuitsByTrackId}
      />
    </div>
  );
}
