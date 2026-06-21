import { supabaseServer as supabase } from "../../lib/supabase-server";
import { getSessionAndDriver } from "../../lib/auth";
import { redirect } from "next/navigation";
import AdminTabs from "./AdminTabs";
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
    supabase.from("signup_tags").select("*").order("sort_order").order("name"),
  ]);

  // Reshape settings rows into a plain key→value object for easier prop passing
  const settings = Object.fromEntries(
    (settingsData || []).map((s) => [s.key, s.value]),
  );

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
        iracingTracks={iracingTracks || []}
      />
    </div>
  );
}
