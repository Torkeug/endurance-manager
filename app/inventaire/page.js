import { supabaseServer as supabase } from "../../lib/supabase-server";
import { getSessionAndDriver } from "../../lib/auth";
import { redirect } from "next/navigation";
import InventoryMatrix from "../../components/InventoryMatrix";

export default async function InventairePage({ searchParams }) {
  const { driver: currentDriver } = await getSessionAndDriver();
  const { iracing_synced, error: syncError } = await searchParams;

  // External drivers cannot see inventaire
  if (!currentDriver || currentDriver.role === "external") {
    redirect("/");
  }

  // ── Small reference data only — large ownership/catalog data fetched client-side ──
  const [{ data: circuits }, { data: cars }, { data: drivers }] =
    await Promise.all([
      supabase.from("circuits").select("name, iracing_track_id").order("name"),
      supabase
        .from("cars")
        .select("id, name, class, car_type_label, iracing_car_id")
        .order("class")
        .order("name"),
      supabase
        .from("drivers")
        .select("id, name, role, approved, active, iracing_synced_at, iracing_id")
        .eq("active", true)
        .order("name"),
    ]);

  // Only active drivers with a completed iRacing sync appear as matrix columns
  const matrixDrivers = (drivers || []).filter(
    (d) => d.approved && d.iracing_synced_at,
  );

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

  // Kronos circuits map: iracing_track_id → circuit (for exact badge matching)
  const kronosCircuitsByTrackId = {};
  for (const circuit of circuits || []) {
    if (circuit.iracing_track_id) {
      kronosCircuitsByTrackId[circuit.iracing_track_id] = circuit;
    }
  }

  // Name-based fallback for circuits not yet linked to iRacing
  const kronosCircuitNames = (circuits || [])
    .filter((c) => !c.iracing_track_id)
    .map((c) => c.name);

  // Current driver's iRacing link status — used for sync button visibility
  const currentDriverHasIracingId = !!(drivers || []).find(
    (d) => d.id === currentDriver?.id,
  )?.iracing_id;

  return (
    <div className="page">
      {/* Re-sync success banner */}
      {iracing_synced === "true" && (
        <div className="alert alert-success" style={{ marginBottom: "1rem" }}>
          ✓ Synchronisation réussie — inventaire mis à jour.
        </div>
      )}
      {/* Sync error banner */}
      {syncError && (
        <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
          {syncError === "iracing_sync_failed"
            ? "Erreur lors de la synchronisation iRacing. Vos données n'ont pas été modifiées."
            : "Une erreur iRacing est survenue. Veuillez réessayer."}
        </div>
      )}

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
        {/* Sync button — only shown when current driver has a linked iRacing account */}
        {currentDriverHasIracingId && (
          <a
            href="/auth/iracing?mode=driver&returnTo=/inventaire"
            className="btn btn-secondary btn-sm"
          >
            🔄 Mettre à jour mon inventaire
          </a>
        )}
      </div>

      <InventoryMatrix
        matrixDrivers={matrixDrivers}
        kronosCarsMap={kronosCarsMap}
        kronosCircuitsByTrackId={kronosCircuitsByTrackId}
        kronosCircuitNames={kronosCircuitNames}
        currentDriverId={currentDriver?.id}
        currentDriverHasIracingId={currentDriverHasIracingId}
      />
    </div>
  );
}
