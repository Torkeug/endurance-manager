import { supabaseServer as supabase } from "../../lib/supabase-server";
import { getSessionAndDriver } from "../../lib/auth";
import { redirect } from "next/navigation";
import InventoryMatrix from "../../components/InventoryMatrix";
import { isLegacyContent } from "../../lib/car-types";

export default async function InventairePage() {
  const { driver: currentDriver } = await getSessionAndDriver();

  // External drivers cannot see inventaire
  if (!currentDriver || currentDriver.role === "external") {
    redirect("/");
  }

  const [
    { data: circuits },
    { data: cars },
    { data: drivers },
    { data: iracingCars },
    { data: allCarOwnership },
    { data: allTrackOwnership },
  ] = await Promise.all([
    supabase.from("circuits").select("*, iracing_track_id").order("name"),
    supabase.from("cars").select("*").order("class").order("name"),
    supabase
      .from("drivers")
      .select("id, name, email, role, approved, refused, iracing_synced_at")
      .order("name"),
    supabase
      .from("iracing_cars")
      .select("iracing_car_id, car_name, car_types, car_type_label")
      .order("car_name"),
    supabase
      .from("driver_car_ownership")
      .select("driver_id, iracing_car_id, car_name, car_category, car_types"),
    supabase
      .from("driver_track_ownership")
      .select("driver_id, track_name, track_category"),
  ]);

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
          <h1>Inventaire</h1>
          <div className="accent-line" />
          <p
            style={{
              marginTop: "0.5rem",
              color: "var(--text-dim)",
              fontSize: "0.85rem",
            }}
          >
            Aperçu des voitures et circuits possédés par les pilotes
          </p>
        </div>
      </div>

      <InventoryMatrix
        matrixDrivers={matrixDrivers}
        allCars={allCarsMatrix}
        allTracks={allTracksMatrix}
        carOwnership={carOwnership}
        trackOwnership={trackOwnership}
        kronosCarsMap={kronosCarsMap}
        iracingLabelById={iracingLabelById}
        kronosCircuitsByTrackId={kronosCircuitsByTrackId}
        kronosCircuitNames={kronosCircuitNames}
      />
    </div>
  );
}
