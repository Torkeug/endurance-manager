import { supabaseServer as supabase } from "../../../../lib/supabase-server";
import { getSessionAndDriver, isAdmin } from "../../../../lib/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import InventaireDisplay from "./InventaireDisplay";

export default async function InventairePage({ params }) {
  const { id } = await params;
  const { driver: currentDriver } = await getSessionAndDriver();
  const admin = isAdmin(currentDriver);

  // Access: own driver or admin only
  if (!admin && currentDriver?.id !== id) redirect("/pilotes");

  const { data: driver, error } = await supabase
    .from("drivers")
    .select("id, name, iracing_id, iracing_synced_at")
    .eq("id", id)
    .single();

  if (error || !driver) notFound();

  const { data: ownedCars } = await supabase
    .from("driver_car_ownership")
    .select("*")
    .eq("driver_id", id)
    .order("car_name");

  const { data: ownedTracks } = await supabase
    .from("driver_track_ownership")
    .select("*")
    .eq("driver_id", id)
    .order("track_name");

  // Kronos reference lists for badge matching
  const { data: kronosCars } = await supabase.from("cars").select("name");
  const { data: kronosCircuits } = await supabase
    .from("circuits")
    .select("name");

  // ── Build car structure: category → class → cars[] ───────────────────────
  const carCatMap = {};
  for (const car of ownedCars || []) {
    const cat = car.car_category || "other";
    const cls = car.car_class_short_name || "—";
    if (!carCatMap[cat]) carCatMap[cat] = {};
    if (!carCatMap[cat][cls]) carCatMap[cat][cls] = [];
    carCatMap[cat][cls].push(car);
  }

  const carData = Object.entries(carCatMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, classes]) => ({
      category,
      // Total cars owned in this category
      count: Object.values(classes).reduce((sum, cars) => sum + cars.length, 0),
      classes: Object.entries(classes)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([cls, cars]) => ({
          class: cls,
          count: cars.length,
          cars,
        })),
    }));

  // ── Build track structure: category → base track → configs[] ─────────────
  const trackCatMap = {};
  for (const track of ownedTracks || []) {
    const cat = track.track_category || "other";
    const base = track.track_name;
    if (!trackCatMap[cat]) trackCatMap[cat] = {};
    if (!trackCatMap[cat][base]) trackCatMap[cat][base] = [];
    trackCatMap[cat][base].push(track.track_config || null);
  }

  const trackData = Object.entries(trackCatMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, tracks]) => ({
      category,
      // Count of unique base tracks (not configs) for the category header
      count: Object.keys(tracks).length,
      tracks: Object.entries(tracks)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([track_name, configs]) => ({
          track_name,
          count: configs.length,
          configs: configs.filter(Boolean),
        })),
    }));

  const syncedAt = driver.iracing_synced_at
    ? new Date(driver.iracing_synced_at).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const hasData =
    (ownedCars || []).length > 0 || (ownedTracks || []).length > 0;

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Inventaire — {driver.name}</h1>
          <div className="accent-line" />
          {syncedAt && (
            <p
              style={{
                color: "var(--text-dim)",
                fontSize: "0.82rem",
                marginTop: "0.4rem",
              }}
            >
              Synchronisé le {syncedAt}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          {currentDriver?.id === id && (
            <a
              href="/auth/iracing?mode=driver"
              className="btn btn-primary btn-sm"
            >
              🔄 Mettre à jour
            </a>
          )}
          <Link href={`/pilotes/${id}`} className="btn btn-secondary">
            ← Pilote
          </Link>
        </div>
      </div>

      {/* Not linked */}
      {!driver.iracing_id && (
        <div className="card" style={{ marginBottom: "2rem" }}>
          <div className="empty">
            Ce pilote n&apos;a pas encore lié son compte iRacing.
            L&apos;inventaire sera disponible après la liaison.
          </div>
        </div>
      )}

      {/* Linked but no data */}
      {driver.iracing_id && !hasData && (
        <div className="card" style={{ marginBottom: "2rem" }}>
          <div className="empty">
            Aucune donnée synchronisée.{" "}
            {currentDriver?.id === id
              ? "Cliquez sur « Mettre à jour » pour importer l'inventaire depuis iRacing."
              : "Ce pilote doit lancer une synchronisation depuis son profil."}
          </div>
        </div>
      )}

      {/* Main display — client component handles all collapse state */}
      {hasData && (
        <InventaireDisplay
          carData={carData}
          trackData={trackData}
          // Sets can't cross server/client boundary — pass as arrays
          kronosCarNamesArr={(kronosCars || []).map((c) => c.name)}
          kronosCircuitNamesArr={(kronosCircuits || []).map((c) => c.name)}
        />
      )}
    </div>
  );
}
