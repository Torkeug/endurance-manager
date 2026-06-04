import { supabaseServer as supabase } from "../../../../lib/supabase-server";
import { getSessionAndDriver, isAdmin } from "../../../../lib/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import InventaireDisplay from "./InventaireDisplay";
import { isLegacyContent } from "../../../../lib/car-types";
import { fetchAllRows } from "../../../../lib/db-utils";
import LocalDate from "../../../../components/LocalDate";
import { getTranslations } from "next-intl/server";

export default async function InventairePage({ params, searchParams }) {
  const { id } = await params;
  const { iracing_synced, error: syncError } = await searchParams;
  const { driver: currentDriver } = await getSessionAndDriver();
  const admin = isAdmin(currentDriver);
  const t = await getTranslations("driverInventory");

  if (!admin && currentDriver?.id !== id) redirect("/pilotes");

  const { data: driver, error } = await supabase
    .from("drivers")
    .select("id, name, iracing_id, iracing_synced_at")
    .eq("id", id)
    .single();

  if (error || !driver) notFound();

  // Paginated fetches — PostgREST enforces a 1000-row cap per request regardless
  // of key type or .range() call. fetchAllRows chunks requests until exhausted.
  const [ownedCars, ownedTracks] = await Promise.all([
    fetchAllRows((from, to) =>
      supabase
        .from("driver_car_ownership")
        .select("*")
        .eq("driver_id", id)
        .order("car_name")
        .range(from, to),
    ),
    fetchAllRows((from, to) =>
      supabase
        .from("driver_track_ownership")
        .select("*")
        .eq("driver_id", id)
        .order("track_name")
        .range(from, to),
    ),
  ]);

  // Fetch Kronos cars with iRacing link — used for badge and class grouping
  const { data: kronosCars } = await supabase
    .from("cars")
    .select("iracing_car_id, class, car_type_label, name")
    .not("iracing_car_id", "is", null);

  const { data: kronosCircuits } = await supabase
    .from("circuits")
    .select("name, iracing_track_id");

  // Fetch iRacing catalog labels — used for non-Kronos car grouping in inventory
  const { data: iracingCatalog } = await supabase
    .from("iracing_cars")
    .select("iracing_car_id, car_type_label, free_with_subscription")
    .not("car_type_label", "is", null);

  // Fetch only free tracks — minimal payload, matched by track_name in display
  const { data: iracingTracksFree } = await supabase
    .from("iracing_tracks")
    .select("track_name")
    .eq("free_with_subscription", true);

  // Kronos track IDs for exact badge matching
  const kronosTrackIds = new Set(
    (kronosCircuits || [])
      .filter((c) => c.iracing_track_id)
      .map((c) => c.iracing_track_id),
  );
  // Name fallback for circuits not yet linked to iRacing
  const kronosCircuitNamesFallback = (kronosCircuits || [])
    .filter((c) => !c.iracing_track_id)
    .map((c) => c.name);

  // Build lookup map: iracing_car_id → { class, car_type_label } for Kronos cars
  const kronosCarsById = new Map();
  for (const car of kronosCars || []) {
    kronosCarsById.set(car.iracing_car_id, car);
  }

  // Build lookup map: iracing_car_id → car_type_label for catalog cars
  const iracingLabelById = new Map();
  for (const car of iracingCatalog || []) {
    iracingLabelById.set(car.iracing_car_id, car.car_type_label);
  }

  // Build arrays of free content IDs/names — serialized for client component props
  const freeCarIdsArr = (iracingCatalog || [])
    .filter((c) => c.free_with_subscription)
    .map((c) => c.iracing_car_id);

  const freeTrackNamesArr = (iracingTracksFree || []).map((tr) => tr.track_name);

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
      if (car_types.some((tp) => match.includes(tp))) return label;
    }
    return "—";
  }

  // ── Build car structure: category → class → cars[], with legacy bucket ───
  // Class label comes from Kronos cars map (explicit admin selection).
  // Non-Kronos cars fall back to "Autre" within their category.
  // Legacy/retired cars (detected by [Legacy]/[Retired] in name) are grouped separately.
  const carCatMap = {};
  for (const car of ownedCars || []) {
    const cat = car.car_category || "other";
    const kronosInfo = kronosCarsById.get(car.iracing_car_id);
    // Priority: Kronos explicit label → Kronos class → catalog label → fallback
    const cls =
      kronosInfo?.car_type_label?.toUpperCase() ||
      kronosInfo?.class ||
      iracingLabelById.get(car.iracing_car_id)?.toUpperCase() ||
      "Autre";
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


  const hasData =
    ownedCars.length > 0 || ownedTracks.length > 0;

  return (
    <div className="page">
      {/* Re-sync success banner */}
      {iracing_synced === "true" && (
        <div className="alert alert-success" style={{ marginBottom: "1rem" }}>
          {t("syncSuccess")}
        </div>
      )}
      {/* Sync error banner */}
      {syncError && (
        <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
          {syncError === "iracing_sync_failed"
            ? t("errorSyncFailed")
            : t("errorGeneric")}
        </div>
      )}

      <div className="page-header">
        <div>
          <h1>{t("title", { name: driver.name })}</h1>
          <div className="accent-line" />
          {driver.iracing_synced_at && (
            <p
              style={{
                color: "var(--text-dim)",
                fontSize: "0.82rem",
                marginTop: "0.4rem",
              }}
            >
              {t("syncedAt")} <LocalDate iso={driver.iracing_synced_at} />
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          {currentDriver?.id === id && (
            <a
              href={`/auth/iracing?mode=driver&returnTo=/pilotes/${id}/inventaire`}
              className="btn btn-primary btn-sm"
            >
              {t("syncNow")}
            </a>
          )}
          <Link href={`/pilotes/${id}`} className="btn btn-secondary">
            {t("back")}
          </Link>
        </div>
      </div>

      {!driver.iracing_id && (
        <div className="card" style={{ marginBottom: "2rem" }}>
          <div className="empty">{t("noIRacingId")}</div>
        </div>
      )}

      {driver.iracing_id && !hasData && (
        <div className="card" style={{ marginBottom: "2rem" }}>
          <div className="empty">
            {currentDriver?.id === id
              ? t("noDataSelf")
              : t("noDataOther")}
          </div>
        </div>
      )}

      {hasData && (
        <InventaireDisplay
          carData={carData}
          trackData={trackData}
          kronosCarIdsArr={[...kronosCarsById.keys()]}
          kronosTrackIdsArr={[...kronosTrackIds]}
          kronosCircuitNamesArr={kronosCircuitNamesFallback}
          freeCarIdsArr={freeCarIdsArr}
          freeTrackNamesArr={freeTrackNamesArr}
        />
      )}
    </div>
  );
}
