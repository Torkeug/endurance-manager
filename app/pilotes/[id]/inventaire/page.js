import { supabaseServer as supabase } from "../../../../lib/supabase-server";
import { getSessionAndDriver, isAdmin } from "../../../../lib/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

// Human-readable labels for iRacing category keys
const CAR_CATEGORY_LABELS = {
  sports_car: "Sports Car",
  formula_car: "Formula Car",
  oval: "Oval",
  dirt_oval: "Dirt Oval",
  dirt_road: "Dirt Road",
};

const TRACK_CATEGORY_LABELS = {
  road: "Route",
  oval: "Oval",
  dirt_oval: "Dirt Oval",
  dirt_road: "Dirt Road",
};

// Inline badge for cars/tracks that exist in the Kronos DB
function KronosBadge() {
  return (
    <span
      style={{
        fontSize: "0.68rem",
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--accent)",
        border: "1px solid var(--accent)",
        borderRadius: "3px",
        padding: "0.1rem 0.4rem",
        flexShrink: 0,
      }}
    >
      Kronos
    </span>
  );
}

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

  // Fetch owned cars and tracks for this driver
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

  // Fetch Kronos reference lists for badge matching
  const { data: kronosCars } = await supabase.from("cars").select("name");
  const { data: kronosCircuits } = await supabase
    .from("circuits")
    .select("name");

  // Build Sets for O(1) lookup
  const kronosCarNames = new Set((kronosCars || []).map((c) => c.name));
  const kronosCircuitNames = new Set((kronosCircuits || []).map((c) => c.name));

  // Group cars by category, sorted by category name then car name
  const carsByCategory = {};
  for (const car of ownedCars || []) {
    const cat = car.car_category || "other";
    if (!carsByCategory[cat]) carsByCategory[cat] = [];
    carsByCategory[cat].push(car);
  }

  // Group tracks by category, sorted by category name then track name
  const tracksByCategory = {};
  for (const track of ownedTracks || []) {
    const cat = track.track_category || "other";
    if (!tracksByCategory[cat]) tracksByCategory[cat] = [];
    tracksByCategory[cat].push(track);
  }

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
          {/* Only the driver themselves can trigger a sync */}
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

      {/* Not linked yet */}
      {!driver.iracing_id && (
        <div className="card" style={{ marginBottom: "2rem" }}>
          <div className="empty">
            Ce pilote n&apos;a pas encore lié son compte iRacing.
            L&apos;inventaire sera disponible après la liaison.
          </div>
        </div>
      )}

      {/* Linked but no data synced yet */}
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

      {/* Cars section */}
      {Object.keys(carsByCategory).length > 0 && (
        <section style={{ marginBottom: "2.5rem" }}>
          <h2 style={{ marginBottom: "1rem" }}>
            Voitures
            <span
              style={{
                fontSize: "0.85rem",
                fontWeight: 500,
                color: "var(--text-dim)",
                marginLeft: "0.75rem",
              }}
            >
              {(ownedCars || []).length}
            </span>
          </h2>

          {Object.entries(carsByCategory)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([category, cars]) => (
              <div key={category} style={{ marginBottom: "1.5rem" }}>
                {/* Category heading */}
                <h3
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--text-dim)",
                    marginBottom: "0.5rem",
                  }}
                >
                  {CAR_CATEGORY_LABELS[category] || category}
                </h3>

                <div className="card" style={{ padding: 0 }}>
                  {cars.map((car, i) => (
                    <div
                      key={car.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "1rem",
                        padding: "0.6rem 1rem",
                        borderBottom:
                          i < cars.length - 1
                            ? "1px solid var(--border)"
                            : "none",
                      }}
                    >
                      <div>
                        <span style={{ fontSize: "0.88rem" }}>
                          {car.car_name}
                        </span>
                        {(car.car_types || []).length > 0 && (
                          <div
                            style={{
                              display: "flex",
                              gap: "0.3rem",
                              flexWrap: "wrap",
                              marginTop: "0.2rem",
                            }}
                          >
                            {car.car_types.map((t) => (
                              <span
                                key={t}
                                style={{
                                  fontSize: "0.65rem",
                                  fontWeight: 700,
                                  letterSpacing: "0.06em",
                                  textTransform: "uppercase",
                                  color: "var(--text-dim)",
                                  background: "var(--surface)",
                                  border: "1px solid var(--border)",
                                  borderRadius: "3px",
                                  padding: "0.1rem 0.35rem",
                                }}
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {kronosCarNames.has(car.car_name) && <KronosBadge />}
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </section>
      )}

      {/* Tracks section */}
      {Object.keys(tracksByCategory).length > 0 && (
        <section style={{ marginBottom: "2.5rem" }}>
          <h2 style={{ marginBottom: "1rem" }}>
            Circuits
            <span
              style={{
                fontSize: "0.85rem",
                fontWeight: 500,
                color: "var(--text-dim)",
                marginLeft: "0.75rem",
              }}
            >
              {(ownedTracks || []).length}
            </span>
          </h2>

          {Object.entries(tracksByCategory)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([category, tracks]) => (
              <div key={category} style={{ marginBottom: "1.5rem" }}>
                {/* Category heading */}
                <h3
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--text-dim)",
                    marginBottom: "0.5rem",
                  }}
                >
                  {TRACK_CATEGORY_LABELS[category] || category}
                </h3>

                <div className="card" style={{ padding: 0 }}>
                  {tracks.map((track, i) => {
                    // Show "Track Name — Config" when a config exists
                    const displayName = track.track_config
                      ? `${track.track_name} — ${track.track_config}`
                      : track.track_name;
                    // Badge matches on base track name only (ignoring config variant)
                    const isKronos = kronosCircuitNames.has(track.track_name);
                    return (
                      <div
                        key={track.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "1rem",
                          padding: "0.6rem 1rem",
                          borderBottom:
                            i < tracks.length - 1
                              ? "1px solid var(--border)"
                              : "none",
                        }}
                      >
                        <span style={{ fontSize: "0.88rem" }}>
                          {displayName}
                        </span>
                        {isKronos && <KronosBadge />}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </section>
      )}
    </div>
  );
}
