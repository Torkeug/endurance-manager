import { supabaseServer as supabase } from "../../../../lib/supabase-server";
import { getSessionAndDriver, isAdmin } from "../../../../lib/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import InventaireDisplay from "./InventaireDisplay";
import { deriveCarClass, isLegacyContent } from "../../../../lib/car-types";

export default async function InventairePage({ params }) {
  const { id } = await params;
  const { driver: currentDriver } = await getSessionAndDriver();
  const admin = isAdmin(currentDriver);

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

  const { data: kronosCars } = await supabase.from("cars").select("name");
  const { data: kronosCircuits } = await supabase
    .from("circuits")
    .select("name");

  const { data: carTypeLabels } = await supabase
    .from("car_type_labels")
    .select("*")
    .order("priority");

  // ── Car type priority lookup ──────────────────────────────────────────────
  // iRacing's car class system is series-based and unreliable for grouping.
  // Instead we derive a class label from car_types, which are type-based tags.
  // Priority order: most specific first, generic last. First match wins.
  const CAR_TYPE_PRIORITY = [
    { match: ["gtp", "lmdh"], label: "GTP" },
    { match: ["lmp2", "p2"], label: "LMP2" },
    { match: ["lmp3"], label: "LMP3" },
    { match: ["dp", "daytonaprototype"], label: "DP" },
    { match: ["prototype"], label: "Prototype" },
    { match: ["gte", "gtlm"], label: "GTE" },
    { match: ["gt3", "gtd"], label: "GT3" },
    { match: ["gt4"], label: "GT4" },
    { match: ["gs"], label: "GS" },
    { match: ["gt"], label: "GT" },
    { match: ["tcr"], label: "TCR" },
    { match: ["supercup"], label: "Supercup" },
    { match: ["formula", "formulavee", "openwheel"], label: "Formula" },
    {
      match: [
        "nascar",
        "cupcar",
        "xfinity",
        "nationwide",
        "truck",
        "cot",
        "classb",
        "craftsman",
        "ss",
      ],
      label: "NASCAR",
    },
    { match: ["oval", "arca", "legends"], label: "Oval" },
    { match: ["supercars", "v8sc", "aussiev8"], label: "Supercars" },
    { match: ["sprintcar", "dirtoval"], label: "Dirt Oval" },
    { match: ["dirtroad", "rallycross", "irx", "offroad"], label: "Dirt Road" },
    {
      match: ["rookie", "srf", "mx5", "miata", "mini", "starmazda"],
      label: "Road",
    },
  ];

  function deriveCarClass(car_types) {
    if (!car_types || car_types.length === 0) return "—";
    for (const { match, label } of CAR_TYPE_PRIORITY) {
      if (car_types.some((t) => match.includes(t))) return label;
    }
    return "—";
  }

  // ── Build car structure: category → class → cars[], with legacy bucket ───
  // Uses car_type_labels from DB for classification (priority-ordered, admin-editable).
  // Legacy/retired cars (detected by [Legacy]/[Retired] in name) are grouped
  // separately at the bottom of each category.
  const carCatMap = {};
  for (const car of ownedCars || []) {
    const cat = car.car_category || "other";
    const cls = deriveCarClass(car.car_types, carTypeLabels || []);
    const legacy = isLegacyContent(car.car_name);
    if (!carCatMap[cat]) carCatMap[cat] = { normal: {}, legacy: [] };
    if (legacy) {
      carCatMap[cat].legacy.push(car);
    } else {
      if (!carCatMap[cat].normal[cls]) carCatMap[cat].normal[cls] = [];
      carCatMap[cat].normal[cls].push(car);
    }
  }

  const carData = Object.entries(carCatMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, { normal, legacy }]) => ({
      category,
      count:
        Object.values(normal).reduce((sum, cars) => sum + cars.length, 0) +
        legacy.length,
      classes: Object.entries(normal)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([cls, cars]) => ({
          class: cls,
          count: cars.length,
          cars,
        })),
      legacyCars:
        legacy.length > 0
          ? legacy.sort((a, b) => a.car_name.localeCompare(b.car_name))
          : null,
      legacyCarCount: legacy.length,
    }));

  // ── Build track structure: category → { normal, legacy } ─────────────────
  // Legacy/retired tracks are detected by [Legacy] or [Retired] in the name.
  // They are grouped into a dedicated collapsible within their category,
  // rather than overriding the category itself.
  const trackCatMap = {};
  for (const track of ownedTracks || []) {
    const cat = track.track_category || "other";
    const base = track.track_name;
    const isLegacy = /\[(legacy|retired)\]/i.test(track.track_name);

    if (!trackCatMap[cat]) trackCatMap[cat] = { normal: {}, legacy: {} };
    const bucket = isLegacy ? "legacy" : "normal";
    if (!trackCatMap[cat][bucket][base]) trackCatMap[cat][bucket][base] = [];
    trackCatMap[cat][bucket][base].push(track.track_config || null);
  }

  // Serialize into an array for the client component
  const trackData = Object.entries(trackCatMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, { normal, legacy }]) => {
      const normalTracks = Object.entries(normal)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([track_name, configs]) => ({
          track_name,
          count: configs.length,
          configs: configs.filter(Boolean).sort(),
        }));

      const legacyTracks = Object.entries(legacy)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([track_name, configs]) => ({
          track_name,
          count: configs.length,
          configs: configs.filter(Boolean).sort(),
        }));

      return {
        category,
        // Category count = unique base track names across both buckets
        count: Object.keys(normal).length + Object.keys(legacy).length,
        tracks: normalTracks,
        // Legacy group only present if there are legacy/retired tracks
        legacyTracks: legacyTracks.length > 0 ? legacyTracks : null,
        legacyCount: legacyTracks.length,
      };
    });

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

      {!driver.iracing_id && (
        <div className="card" style={{ marginBottom: "2rem" }}>
          <div className="empty">
            Ce pilote n&apos;a pas encore lié son compte iRacing.
            L&apos;inventaire sera disponible après la liaison.
          </div>
        </div>
      )}

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

      {hasData && (
        <InventaireDisplay
          carData={carData}
          trackData={trackData}
          kronosCarNamesArr={(kronosCars || []).map((c) => c.name)}
          kronosCircuitNamesArr={(kronosCircuits || []).map((c) => c.name)}
        />
      )}
    </div>
  );
}
