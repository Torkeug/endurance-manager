-- ============================================================================
-- BASELINE SCHEMA — Kronos Team Endurance Manager
-- Captured 2026-06-03. All future migrations build on top of this.
-- ============================================================================


-- ── Reference / catalogue tables (no FK deps) ────────────────────────────────

CREATE TABLE public.iracing_cars (
  iracing_car_id         integer PRIMARY KEY,
  car_name               text NOT NULL,
  car_categories         text[],
  car_types              text[],
  car_type_label         text,
  free_with_subscription boolean DEFAULT false
);

CREATE TABLE public.iracing_tracks (
  iracing_track_id       integer PRIMARY KEY,
  track_name             text NOT NULL,
  config_name            text,
  track_category         text,
  free_with_subscription boolean DEFAULT false
);

CREATE TABLE public.car_classes (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   text NOT NULL UNIQUE,
  sort_order             integer DEFAULT 0,
  refuel_litres_per_second numeric
);

CREATE TABLE public.circuits (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL UNIQUE,
  pit_lane_time_seconds integer,
  iracing_track_id integer REFERENCES public.iracing_tracks (iracing_track_id)
);

CREATE TABLE public.cars (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   text NOT NULL UNIQUE,
  class                  text,
  tank_size_litres       numeric,
  iracing_car_id         integer UNIQUE REFERENCES public.iracing_cars (iracing_car_id),
  car_type_label         text,
  class_id               uuid REFERENCES public.car_classes (id),
  refuel_litres_per_second numeric
);

CREATE TABLE public.championships (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL,
  season             text,
  archived           boolean NOT NULL DEFAULT false,
  created_at         timestamptz DEFAULT now(),
  discord_channel_id text,
  discord_message_id text
);

CREATE TABLE public.crew_names (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  color      varchar
);

CREATE TABLE public.event_duration_presets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  minutes    integer NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.event_types (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  sort_order integer DEFAULT 0
);

CREATE TABLE public.settings (
  key   text PRIMARY KEY,
  value text NOT NULL
);

CREATE TABLE public.signup_tags (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE public.special_event_start_times (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label       text NOT NULL,
  hour        integer NOT NULL,
  minute      integer NOT NULL,
  created_at  timestamptz DEFAULT now(),
  day_of_week text
);

CREATE TABLE public.deleted_signups_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  old_data   jsonb,
  deleted_at timestamptz DEFAULT now()
);

CREATE TABLE public.deleted_team_entries_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  old_data   jsonb,
  deleted_at timestamptz DEFAULT now()
);

-- Discord bot lookup tables (RLS enabled, no app policies — bot access only)
CREATE TABLE public.cars_brands_emojis (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  brand_name       text,
  discord_emoji_id text
);

CREATE TABLE public.cars_brands_emojis_dev (
  id               uuid PRIMARY KEY REFERENCES public.cars_brands_emojis (id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  brand_name       text,
  discord_emoji_id text
);

CREATE TABLE public.crew_emojis (
  id               bigint PRIMARY KEY,
  created_at       timestamptz NOT NULL DEFAULT now(),
  crew_name_id     uuid REFERENCES public.crew_names (id) ON DELETE CASCADE,
  crew_name        text REFERENCES public.crew_names (name) ON DELETE CASCADE,
  discord_emoji_id text
);

CREATE TABLE public.crew_emojis_dev (
  id               bigint PRIMARY KEY REFERENCES public.crew_emojis (id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  crew_name_id     uuid REFERENCES public.crew_names (id) ON DELETE CASCADE,
  crew_name        text REFERENCES public.crew_names (name) ON DELETE CASCADE,
  discord_emoji_id text
);


-- ── Core app tables ───────────────────────────────────────────────────────────

CREATE TABLE public.drivers (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text NOT NULL,
  iracing_id            text,
  irating               integer,
  discord               text,
  twitch                text,
  instagram             text,
  role                  text NOT NULL DEFAULT 'driver',
  email                 text UNIQUE,
  active                boolean DEFAULT true,
  created_at            timestamptz DEFAULT now(),
  approved              boolean NOT NULL DEFAULT false,
  auth_user_id          uuid UNIQUE REFERENCES auth.users (id) ON DELETE SET NULL,
  refused               boolean NOT NULL DEFAULT false,
  membership_ok         boolean NOT NULL DEFAULT false,
  test_driver           boolean NOT NULL DEFAULT false,
  discord_id            text,
  iracing_synced_at     timestamptz,
  is_test_account       boolean DEFAULT false,
  last_driver_sync_at   timestamptz,
  stale_sync_notified_at timestamptz,
  garage61_access_token  text,
  garage61_refresh_token text,
  garage61_slug          text,
  discord_alert_enabled  boolean NOT NULL DEFAULT false,
  discord_alert_minutes  integer
);

CREATE TABLE public.events (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     text NOT NULL,
  circuit_id               uuid REFERENCES public.circuits (id),
  format                   text,
  ig_start_time            text,
  notes                    text,
  created_at               timestamptz DEFAULT now(),
  ig_sunrise               text,
  ig_sunset                text,
  duration_minutes         integer,
  timezone                 text NOT NULL DEFAULT 'Europe/Paris',
  archived                 boolean NOT NULL DEFAULT false,
  circuit_name_snapshot    text,
  is_special               boolean NOT NULL DEFAULT false,
  weekend_start_date       date,
  championship_id          uuid REFERENCES public.championships (id) ON DELETE SET NULL,
  round_number             integer,
  discord_channel_id       text,
  discord_message_id       text,
  green_flag_offset_minutes integer NOT NULL DEFAULT 0,
  discord_event_id         text
);

CREATE UNIQUE INDEX championships_round_number_unique
  ON public.events (championship_id, round_number)
  WHERE championship_id IS NOT NULL AND round_number IS NOT NULL;

CREATE TABLE public.event_start_times (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid REFERENCES public.events (id) ON DELETE CASCADE,
  label      text NOT NULL,
  irl_start  timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.event_type_cars (
  event_type_id uuid REFERENCES public.event_types (id) ON DELETE CASCADE,
  car_id        uuid REFERENCES public.cars (id) ON DELETE CASCADE,
  PRIMARY KEY (event_type_id, car_id)
);

CREATE TABLE public.team_entries (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                 uuid REFERENCES public.events (id) ON DELETE CASCADE,
  car_id                   uuid REFERENCES public.cars (id),
  crew_name                text NOT NULL,
  class                    text,
  refuel_time_seconds      integer DEFAULT 30,
  tyre_change_time_seconds integer DEFAULT 0,
  created_at               timestamptz DEFAULT now(),
  start_time_id            uuid REFERENCES public.event_start_times (id),
  bop_power_percent        numeric DEFAULT 100,
  bop_weight_kg            numeric DEFAULT 0,
  bop_tank_size_percent    numeric,
  car_name_snapshot        text,
  discord_channel_id       text,
  discord_message_id       text,
  night_dry_add_seconds    numeric DEFAULT 0,
  night_wet_add_seconds    numeric DEFAULT 0,
  stream_urls              text[] DEFAULT '{}',

  car_number               integer,
  discord_voice_channel_id text,
  day_wet_add_seconds      double precision DEFAULT 0,
  UNIQUE (event_id, crew_name, start_time_id)
);

CREATE UNIQUE INDEX team_entries_car_number_unique
  ON public.team_entries (event_id, start_time_id, car_number)
  WHERE car_number IS NOT NULL AND start_time_id IS NOT NULL;

CREATE TABLE public.strategies (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_entry_id               uuid NOT NULL REFERENCES public.team_entries (id) ON DELETE CASCADE,
  name                        text NOT NULL DEFAULT 'Stratégie 1',
  sort_order                  integer NOT NULL DEFAULT 1,
  is_active                   boolean NOT NULL DEFAULT false,
  description                 text,
  actual_start_offset_minutes integer NOT NULL DEFAULT 0,
  created_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX strategies_one_active_per_entry
  ON public.strategies (team_entry_id)
  WHERE is_active = true;

CREATE TABLE public.signups (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                        uuid REFERENCES public.events (id) ON DELETE CASCADE,
  driver_id                       uuid REFERENCES public.drivers (id) ON DELETE CASCADE,
  preferred_class                 text[],
  notes                           text,
  created_at                      timestamptz DEFAULT now(),
  team_entry_id                   uuid REFERENCES public.team_entries (id) ON DELETE SET NULL,
  preferred_car_ids               uuid[],
  preferred_start_time_ids        uuid[] DEFAULT '{}',
  driver_name_snapshot            text,
  preferred_start_time_ids_snapshot uuid[],
  preferred_car_names_snapshot    text[],
  tags                            text[],
  discord_alert_enabled_override  boolean DEFAULT NULL,  -- NULL=no override (inherit default); TRUE=override: alerts on; FALSE=override: alerts off
  discord_alert_minutes_override  integer,
  UNIQUE (driver_id, team_entry_id)
);

CREATE UNIQUE INDEX signups_driver_event_no_team_unique
  ON public.signups (driver_id, event_id)
  WHERE team_entry_id IS NULL;

CREATE TABLE public.stints (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_entry_id         uuid REFERENCES public.team_entries (id) ON DELETE CASCADE,
  stint_number          integer NOT NULL,
  driver_id             uuid REFERENCES public.drivers (id),
  irl_start             timestamptz,
  irl_end_planned       timestamptz,
  irl_end_actual        timestamptz,
  rain                  boolean DEFAULT false,
  tyre_change           boolean DEFAULT false,
  laps_planned          integer,
  created_at            timestamptz DEFAULT now(),
  driver_name_snapshot  text,
  fuel_used_calc        numeric,
  target_consumption_skip_last numeric,
  fuel_remaining_calc   double precision,
  previous_driver_id    uuid REFERENCES public.drivers (id) ON DELETE SET NULL,
  strategy_id           uuid REFERENCES public.strategies (id) ON DELETE CASCADE,
  laps_calc             integer,
  duration_sec_calc     integer,
  irl_start_actual      timestamptz,
  UNIQUE (strategy_id, stint_number)
);

CREATE TABLE public.availabilities (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_entry_id   uuid REFERENCES public.team_entries (id) ON DELETE CASCADE,
  driver_id       uuid REFERENCES public.drivers (id) ON DELETE CASCADE,
  slot_start      timestamptz NOT NULL,
  available       boolean DEFAULT false,
  is_first_start  boolean DEFAULT false,
  is_second_start boolean DEFAULT false,
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (team_entry_id, driver_id, slot_start)
);

CREATE TABLE public.driver_car_experience (
  driver_id  uuid REFERENCES public.drivers (id) ON DELETE CASCADE,
  car_id     uuid REFERENCES public.cars (id) ON DELETE CASCADE,
  race_count integer DEFAULT 0,
  PRIMARY KEY (driver_id, car_id)
);

CREATE TABLE public.driver_car_ownership (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id        uuid NOT NULL REFERENCES public.drivers (id) ON DELETE CASCADE,
  iracing_car_id   integer NOT NULL,
  car_name         text NOT NULL,
  car_category     text,
  synced_at        timestamptz DEFAULT now(),
  car_types        text[],
  car_class_name   text,
  car_class_short_name text,
  UNIQUE (driver_id, iracing_car_id)
);

CREATE TABLE public.driver_circuit_experience (
  driver_id  uuid REFERENCES public.drivers (id) ON DELETE CASCADE,
  circuit_id uuid REFERENCES public.circuits (id) ON DELETE CASCADE,
  race_count integer DEFAULT 0,
  PRIMARY KEY (driver_id, circuit_id)
);

CREATE TABLE public.driver_performance (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_entry_id        uuid REFERENCES public.team_entries (id) ON DELETE CASCADE,
  driver_id            uuid REFERENCES public.drivers (id) ON DELETE CASCADE,
  lap_time_dry         numeric,
  lap_time_wet         numeric,
  fuel_dry             numeric,
  fuel_wet             numeric,
  updated_at           timestamptz DEFAULT now(),
  setup_notes_dry      text,
  setup_notes_wet      text,
  lap_time_night_dry   numeric,
  fuel_night_dry       numeric,
  lap_time_night_wet   numeric,
  fuel_night_wet       numeric,
  setup_notes_night_dry text,
  setup_notes_night_wet text,
  UNIQUE (team_entry_id, driver_id)
);

CREATE TABLE public.driver_track_ownership (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id        uuid NOT NULL REFERENCES public.drivers (id) ON DELETE CASCADE,
  iracing_track_id integer NOT NULL,
  track_name       text NOT NULL,
  track_config     text,
  track_category   text,
  synced_at        timestamptz DEFAULT now(),
  UNIQUE (driver_id, iracing_track_id)
);

CREATE TABLE public.irating_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id   uuid NOT NULL REFERENCES public.drivers (id) ON DELETE CASCADE,
  irating     integer NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  category_id integer NOT NULL DEFAULT 5
);

CREATE TABLE public.iracing_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      text NOT NULL,
  iracing_cust_id integer,
  driver_id       uuid REFERENCES public.drivers (id) ON DELETE SET NULL,
  track_id        integer NOT NULL,
  payload         jsonb NOT NULL DEFAULT '{}',
  recorded_at     timestamptz NOT NULL,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE public.iracing_laps (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id            uuid REFERENCES public.drivers (id) ON DELETE CASCADE,
  iracing_cust_id      integer NOT NULL,
  track_id             integer NOT NULL,
  car_id               integer NOT NULL,
  session_type         smallint NOT NULL,
  lap_time             numeric NOT NULL,
  fuel_level           numeric,
  fuel_used            numeric,
  track_wetness_raw    smallint,
  weather_declared_wet boolean,
  track_temp           numeric,
  air_temp             numeric,
  precipitation        numeric,
  solar_altitude       numeric,
  session_time_of_day  numeric,
  is_night             boolean,
  recorded_at          timestamptz NOT NULL,
  created_at           timestamptz DEFAULT now(),
  on_pit_road          boolean NOT NULL DEFAULT false,
  under_caution        boolean NOT NULL DEFAULT false
);


-- ── Additional indexes ────────────────────────────────────────────────────────

CREATE INDEX availabilities_car_entry_id_slot_start_idx ON public.availabilities (team_entry_id, slot_start);
CREATE INDEX availabilities_driver_id_idx               ON public.availabilities (driver_id);
CREATE INDEX car_entries_event_id_idx                   ON public.team_entries (event_id);
CREATE INDEX circuits_iracing_track_id_idx              ON public.circuits (iracing_track_id);
CREATE INDEX driver_performance_car_entry_id_idx        ON public.driver_performance (team_entry_id);
CREATE INDEX drivers_auth_user_id_idx                   ON public.drivers (auth_user_id);
CREATE INDEX drivers_email_idx                          ON public.drivers (email);
CREATE INDEX event_start_times_event_id_idx             ON public.event_start_times (event_id);
CREATE INDEX events_circuit_id_idx                      ON public.events (circuit_id);
CREATE INDEX idx_irating_history_driver                 ON public.irating_history (driver_id, recorded_at DESC);
CREATE INDEX iracing_events_driver_recorded             ON public.iracing_events (driver_id, recorded_at);
CREATE INDEX iracing_events_track_type                  ON public.iracing_events (track_id, event_type, recorded_at);
CREATE INDEX iracing_laps_driver_recorded_at            ON public.iracing_laps (driver_id, recorded_at);
CREATE INDEX iracing_laps_iracing_cust_id               ON public.iracing_laps (iracing_cust_id);
CREATE INDEX signups_car_entry_id_idx                   ON public.signups (team_entry_id);
CREATE INDEX signups_event_id_idx                       ON public.signups (event_id);
CREATE INDEX stints_car_entry_id_stint_number_idx       ON public.stints (team_entry_id, stint_number);
CREATE INDEX stints_driver_id_idx                       ON public.stints (driver_id);
CREATE INDEX stints_previous_driver_id_idx              ON public.stints (previous_driver_id);
CREATE INDEX stints_strategy_id_idx                     ON public.stints (strategy_id);
CREATE INDEX strategies_team_entry_id_idx               ON public.strategies (team_entry_id);
CREATE INDEX team_entries_car_id_idx                    ON public.team_entries (car_id);


-- ── Functions ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_current_driver_id()
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT id FROM drivers
  WHERE auth_user_id = auth.uid()
    AND approved = true
    AND refused = false
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_current_driver_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM drivers
  WHERE auth_user_id = auth.uid()
    AND approved = true
    AND refused = false
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_driver_role(p_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM drivers WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM drivers
    WHERE auth_user_id = auth.uid()
      AND approved = true
      AND refused = false
      AND role IN ('admin', 'super_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_approved_driver()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM drivers
    WHERE auth_user_id = auth.uid()
      AND approved = true
      AND refused = false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_external()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM drivers
    WHERE auth_user_id = auth.uid()
      AND role = 'external'
      AND approved = true
      AND refused = false
  );
$$;

CREATE OR REPLACE FUNCTION public.format_driver_name(name text)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  parts      text[];
  first_part text;
  rest_parts text[];
  i          int;
BEGIN
  IF name IS NULL OR name = '' THEN RETURN name; END IF;
  parts := array_remove(string_to_array(trim(name), ' '), '');
  IF array_length(parts, 1) = 0 THEN RETURN name; END IF;
  first_part := parts[1];
  rest_parts := ARRAY[]::text[];
  FOR i IN 2..array_length(parts, 1) LOOP
    rest_parts := array_append(rest_parts, upper(parts[i]));
  END LOOP;
  IF array_length(rest_parts, 1) > 0 THEN
    RETURN first_part || ' ' || array_to_string(rest_parts, ' ');
  END IF;
  RETURN first_part;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_format_driver_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.name IS NOT NULL THEN
    NEW.name := format_driver_name(NEW.name);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_capture_deleted_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.deleted_signups_logs (old_data) VALUES (to_jsonb(OLD));
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_capture_deleted_team_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.deleted_team_entries_logs (old_data) VALUES (to_jsonb(OLD));
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_event(event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  circuit_name_val text;
  team_entry_ids   uuid[];
BEGIN
  SELECT c.name INTO circuit_name_val
  FROM events e JOIN circuits c ON c.id = e.circuit_id
  WHERE e.id = event_id;

  UPDATE events SET circuit_name_snapshot = circuit_name_val WHERE id = event_id;

  UPDATE team_entries te SET car_name_snapshot = c.name
  FROM cars c WHERE c.id = te.car_id AND te.event_id = archive_event.event_id;

  SELECT ARRAY(SELECT id FROM team_entries WHERE team_entries.event_id = archive_event.event_id)
  INTO team_entry_ids;

  UPDATE signups s SET
    driver_name_snapshot = d.name,
    preferred_car_names_snapshot = (
      SELECT ARRAY(SELECT c.name FROM unnest(s.preferred_car_ids) AS car_id JOIN cars c ON c.id = car_id)
    )
  FROM drivers d WHERE d.id = s.driver_id AND s.event_id = archive_event.event_id;

  UPDATE stints st SET driver_name_snapshot = d.name
  FROM drivers d WHERE d.id = st.driver_id AND st.team_entry_id = ANY(team_entry_ids);

  UPDATE events SET archived = true WHERE id = event_id;
END;
$$;

-- archive_event is intentionally not callable by anon
REVOKE EXECUTE ON FUNCTION public.archive_event(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.archive_event(uuid) TO authenticated, service_role;


-- ── Triggers ──────────────────────────────────────────────────────────────────

CREATE TRIGGER drivers_format_name_trigger
  BEFORE INSERT OR UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION trigger_format_driver_name();

CREATE TRIGGER tr_on_delete_signup
  BEFORE DELETE ON public.signups
  FOR EACH ROW EXECUTE FUNCTION fn_capture_deleted_signup();

CREATE TRIGGER tr_on_delete_team_entry
  BEFORE DELETE ON public.team_entries
  FOR EACH ROW EXECUTE FUNCTION fn_capture_deleted_team_entry();


-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE public.availabilities          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_classes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cars                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cars_brands_emojis      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cars_brands_emojis_dev  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.championships           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circuits                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_emojis             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_emojis_dev         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_names              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deleted_signups_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deleted_team_entries_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_car_experience   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_car_ownership    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_circuit_experience ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_performance      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_track_ownership  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_duration_presets  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_start_times       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_type_cars         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_types             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iracing_cars            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iracing_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iracing_laps            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.irating_history         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signup_tags             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signups                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_event_start_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stints                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategies              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_entries            ENABLE ROW LEVEL SECURITY;

-- availabilities
CREATE POLICY availabilities_select ON public.availabilities FOR SELECT
  USING (is_approved_driver() AND ((NOT is_external()) OR EXISTS (SELECT 1 FROM signups s WHERE s.team_entry_id = availabilities.team_entry_id AND s.driver_id = get_current_driver_id())));
CREATE POLICY availabilities_insert ON public.availabilities FOR INSERT TO authenticated
  WITH CHECK (is_admin() OR (is_approved_driver() AND NOT is_external() AND NOT EXISTS (SELECT 1 FROM team_entries te JOIN events e ON e.id = te.event_id WHERE te.id = availabilities.team_entry_id AND e.archived = true) AND EXISTS (SELECT 1 FROM signups s WHERE s.team_entry_id = availabilities.team_entry_id AND s.driver_id = get_current_driver_id())) OR (is_external() AND driver_id = get_current_driver_id() AND NOT EXISTS (SELECT 1 FROM team_entries te JOIN events e ON e.id = te.event_id WHERE te.id = availabilities.team_entry_id AND e.archived = true)));
CREATE POLICY availabilities_insert_external ON public.availabilities FOR INSERT
  WITH CHECK (is_external() AND driver_id = get_current_driver_id() AND NOT EXISTS (SELECT 1 FROM team_entries te JOIN events e ON e.id = te.event_id WHERE te.id = availabilities.team_entry_id AND e.archived = true));
CREATE POLICY availabilities_update ON public.availabilities FOR UPDATE
  USING (NOT EXISTS (SELECT 1 FROM team_entries te JOIN events e ON e.id = te.event_id WHERE te.id = availabilities.team_entry_id AND e.archived = true) AND (is_admin() OR (is_approved_driver() AND NOT is_external() AND EXISTS (SELECT 1 FROM signups s WHERE s.team_entry_id = availabilities.team_entry_id AND s.driver_id = get_current_driver_id())) OR (is_external() AND driver_id = get_current_driver_id())));
CREATE POLICY availabilities_delete ON public.availabilities FOR DELETE
  USING (is_admin() OR driver_id = get_current_driver_id());

-- car_classes
CREATE POLICY car_classes_select ON public.car_classes FOR SELECT USING (is_approved_driver());
CREATE POLICY car_classes_write  ON public.car_classes FOR ALL   USING (is_admin());

-- cars
CREATE POLICY cars_select ON public.cars FOR SELECT USING (is_approved_driver());
CREATE POLICY cars_write  ON public.cars FOR ALL   USING (is_admin());

-- championships
CREATE POLICY championships_select   ON public.championships FOR SELECT USING (is_approved_driver());
CREATE POLICY championships_realtime ON public.championships FOR SELECT USING (is_approved_driver());
CREATE POLICY championships_write    ON public.championships FOR ALL   USING (is_admin());

-- circuits
CREATE POLICY circuits_select ON public.circuits FOR SELECT USING (is_approved_driver());
CREATE POLICY circuits_write  ON public.circuits FOR ALL   USING (is_admin());

-- crew_names
CREATE POLICY crew_names_select ON public.crew_names FOR SELECT USING (is_approved_driver());
CREATE POLICY crew_names_write  ON public.crew_names FOR ALL   USING (is_admin());

-- deleted logs (admin read-only)
CREATE POLICY deleted_signups_logs_realtime     ON public.deleted_signups_logs     FOR SELECT USING (is_admin());
CREATE POLICY deleted_team_entries_logs_realtime ON public.deleted_team_entries_logs FOR SELECT USING (is_admin());

-- driver_car_experience
CREATE POLICY driver_car_experience_select ON public.driver_car_experience FOR SELECT USING (is_approved_driver());
CREATE POLICY driver_car_experience_write  ON public.driver_car_experience FOR ALL   USING (is_approved_driver());

-- driver_car_ownership
CREATE POLICY "Approved drivers can read car ownership" ON public.driver_car_ownership FOR SELECT
  USING (is_approved_driver());

-- driver_circuit_experience
CREATE POLICY driver_circuit_experience_select ON public.driver_circuit_experience FOR SELECT USING (is_approved_driver());
CREATE POLICY driver_circuit_experience_write  ON public.driver_circuit_experience FOR ALL   USING (is_approved_driver());

-- driver_performance
CREATE POLICY driver_performance_select ON public.driver_performance FOR SELECT
  USING ((is_approved_driver() AND NOT is_external()) OR (is_external() AND EXISTS (SELECT 1 FROM signups WHERE signups.team_entry_id = driver_performance.team_entry_id AND signups.driver_id = get_current_driver_id())));
CREATE POLICY driver_performance_insert ON public.driver_performance FOR INSERT
  WITH CHECK ((is_admin() OR EXISTS (SELECT 1 FROM signups WHERE signups.team_entry_id = driver_performance.team_entry_id AND signups.driver_id = get_current_driver_id())) AND NOT EXISTS (SELECT 1 FROM team_entries te JOIN events e ON e.id = te.event_id WHERE te.id = driver_performance.team_entry_id AND e.archived = true));
CREATE POLICY driver_performance_update ON public.driver_performance FOR UPDATE
  USING ((is_admin() OR EXISTS (SELECT 1 FROM signups WHERE signups.team_entry_id = driver_performance.team_entry_id AND signups.driver_id = get_current_driver_id())) AND NOT EXISTS (SELECT 1 FROM team_entries te JOIN events e ON e.id = te.event_id WHERE te.id = driver_performance.team_entry_id AND e.archived = true));
CREATE POLICY driver_performance_delete ON public.driver_performance FOR DELETE
  USING ((is_admin() OR EXISTS (SELECT 1 FROM signups WHERE signups.team_entry_id = driver_performance.team_entry_id AND signups.driver_id = get_current_driver_id())) AND NOT EXISTS (SELECT 1 FROM team_entries te JOIN events e ON e.id = te.event_id WHERE te.id = driver_performance.team_entry_id AND e.archived = true));

-- driver_track_ownership
CREATE POLICY "Approved drivers can read track ownership" ON public.driver_track_ownership FOR SELECT
  USING (is_approved_driver());

-- drivers
CREATE POLICY drivers_select_approved ON public.drivers FOR SELECT USING (is_approved_driver());
CREATE POLICY drivers_select_self     ON public.drivers FOR SELECT USING (auth.uid() IS NOT NULL AND auth.uid() = auth_user_id);
CREATE POLICY drivers_insert          ON public.drivers FOR INSERT WITH CHECK (auth.uid() = auth_user_id OR is_admin());
CREATE POLICY drivers_update          ON public.drivers FOR UPDATE TO authenticated
  USING (auth.uid() = auth_user_id OR is_admin())
  WITH CHECK (is_admin() OR (auth.uid() = auth_user_id AND role = get_driver_role(id)));
CREATE POLICY drivers_delete          ON public.drivers FOR DELETE USING (is_admin());

-- event_duration_presets
CREATE POLICY duration_presets_select ON public.event_duration_presets FOR SELECT USING (is_approved_driver());
CREATE POLICY duration_presets_write  ON public.event_duration_presets FOR ALL   USING (is_admin());

-- event_start_times
CREATE POLICY event_start_times_select   ON public.event_start_times FOR SELECT USING (is_approved_driver());
CREATE POLICY event_start_times_realtime ON public.event_start_times FOR SELECT USING (is_approved_driver());
CREATE POLICY event_start_times_insert   ON public.event_start_times FOR INSERT WITH CHECK (is_admin() AND NOT EXISTS (SELECT 1 FROM events WHERE events.id = event_start_times.event_id AND events.archived = true));
CREATE POLICY event_start_times_update   ON public.event_start_times FOR UPDATE USING (is_admin() AND NOT EXISTS (SELECT 1 FROM events WHERE events.id = event_start_times.event_id AND events.archived = true));
CREATE POLICY event_start_times_delete   ON public.event_start_times FOR DELETE USING (is_admin() AND NOT EXISTS (SELECT 1 FROM events WHERE events.id = event_start_times.event_id AND events.archived = true));

-- event_type_cars
CREATE POLICY event_type_cars_select ON public.event_type_cars FOR SELECT USING (is_approved_driver());
CREATE POLICY event_type_cars_write  ON public.event_type_cars FOR ALL   USING (is_admin());

-- event_types
CREATE POLICY event_types_select ON public.event_types FOR SELECT USING (is_approved_driver());
CREATE POLICY event_types_write  ON public.event_types FOR ALL   USING (is_admin());

-- events
CREATE POLICY events_select   ON public.events FOR SELECT USING (is_approved_driver());
CREATE POLICY events_realtime ON public.events FOR SELECT USING (is_approved_driver());
CREATE POLICY events_insert   ON public.events FOR INSERT WITH CHECK (is_admin());
CREATE POLICY events_update   ON public.events FOR UPDATE USING (is_admin());
CREATE POLICY events_delete   ON public.events FOR DELETE USING (is_admin());

-- iracing_cars
CREATE POLICY "Approved drivers can read iracing_cars" ON public.iracing_cars FOR SELECT
  USING (is_approved_driver());
CREATE POLICY "Admins can update iracing_cars" ON public.iracing_cars FOR UPDATE
  USING (EXISTS (SELECT 1 FROM drivers WHERE drivers.auth_user_id = auth.uid() AND drivers.role = ANY(ARRAY['admin','super_admin'])));

-- iracing_events
CREATE POLICY iracing_events_select ON public.iracing_events FOR SELECT
  USING ((is_approved_driver() AND NOT is_external()) OR (is_external() AND EXISTS (SELECT 1 FROM signups s1 JOIN signups s2 ON s2.team_entry_id = s1.team_entry_id WHERE s1.driver_id = get_current_driver_id() AND s2.driver_id = iracing_events.driver_id)));

-- iracing_laps
CREATE POLICY iracing_laps_select ON public.iracing_laps FOR SELECT
  USING ((is_approved_driver() AND NOT is_external()) OR (is_external() AND EXISTS (SELECT 1 FROM signups s1 JOIN signups s2 ON s2.team_entry_id = s1.team_entry_id WHERE s1.driver_id = get_current_driver_id() AND s2.driver_id = iracing_laps.driver_id)));

-- iracing_tracks
CREATE POLICY "Approved drivers can read iracing_tracks" ON public.iracing_tracks FOR SELECT
  USING (is_approved_driver());

-- irating_history
CREATE POLICY irating_history_read ON public.irating_history FOR SELECT USING (is_approved_driver());

-- settings
CREATE POLICY settings_select ON public.settings FOR SELECT USING (is_approved_driver());
CREATE POLICY settings_write  ON public.settings FOR ALL   USING (is_admin());

-- signup_tags
CREATE POLICY signup_tags_select ON public.signup_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY signup_tags_admin_write ON public.signup_tags FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM drivers WHERE drivers.auth_user_id = auth.uid() AND drivers.role = ANY(ARRAY['admin','super_admin'])))
  WITH CHECK (EXISTS (SELECT 1 FROM drivers WHERE drivers.auth_user_id = auth.uid() AND drivers.role = ANY(ARRAY['admin','super_admin'])));

-- signups
CREATE POLICY signups_select ON public.signups FOR SELECT USING (is_approved_driver());
CREATE POLICY signups_insert ON public.signups FOR INSERT
  WITH CHECK (is_approved_driver() AND NOT is_external() AND NOT EXISTS (SELECT 1 FROM events e WHERE e.id = signups.event_id AND e.archived = true));
CREATE POLICY signups_update ON public.signups FOR UPDATE
  USING (((driver_id = get_current_driver_id() AND NOT is_external()) OR is_admin() OR (is_approved_driver() AND NOT is_external() AND EXISTS (SELECT 1 FROM signups s WHERE s.event_id = signups.event_id AND s.driver_id = get_current_driver_id()))) AND NOT EXISTS (SELECT 1 FROM events e WHERE e.id = signups.event_id AND e.archived = true));
CREATE POLICY signups_delete ON public.signups FOR DELETE
  USING ((is_admin() OR (driver_id = get_current_driver_id() AND NOT is_external())) AND NOT EXISTS (SELECT 1 FROM events e WHERE e.id = signups.event_id AND e.archived = true));

-- special_event_start_times
CREATE POLICY special_start_times_select ON public.special_event_start_times FOR SELECT USING (is_approved_driver());
CREATE POLICY special_start_times_write  ON public.special_event_start_times FOR ALL   USING (is_admin());

-- stints
CREATE POLICY stints_select ON public.stints FOR SELECT
  USING ((is_approved_driver() AND NOT is_external()) OR (is_external() AND EXISTS (SELECT 1 FROM signups WHERE signups.team_entry_id = stints.team_entry_id AND signups.driver_id = get_current_driver_id())));
CREATE POLICY stints_insert ON public.stints FOR INSERT
  WITH CHECK ((is_admin() OR EXISTS (SELECT 1 FROM signups WHERE signups.team_entry_id = stints.team_entry_id AND signups.driver_id = get_current_driver_id())) AND NOT EXISTS (SELECT 1 FROM team_entries te JOIN events e ON e.id = te.event_id WHERE te.id = stints.team_entry_id AND e.archived = true));
CREATE POLICY stints_update ON public.stints FOR UPDATE
  USING ((is_admin() OR EXISTS (SELECT 1 FROM signups WHERE signups.team_entry_id = stints.team_entry_id AND signups.driver_id = get_current_driver_id())) AND NOT EXISTS (SELECT 1 FROM team_entries te JOIN events e ON e.id = te.event_id WHERE te.id = stints.team_entry_id AND e.archived = true));
CREATE POLICY stints_delete ON public.stints FOR DELETE
  USING ((is_admin() OR EXISTS (SELECT 1 FROM signups WHERE signups.team_entry_id = stints.team_entry_id AND signups.driver_id = get_current_driver_id())) AND NOT EXISTS (SELECT 1 FROM team_entries te JOIN events e ON e.id = te.event_id WHERE te.id = stints.team_entry_id AND e.archived = true));

-- strategies
CREATE POLICY strategies_select ON public.strategies FOR SELECT TO authenticated
  USING ((is_approved_driver() AND NOT is_external()) OR (is_external() AND EXISTS (SELECT 1 FROM signups s WHERE s.team_entry_id = strategies.team_entry_id AND s.driver_id = get_current_driver_id())));
CREATE POLICY strategies_insert ON public.strategies FOR INSERT TO authenticated
  WITH CHECK ((is_admin() OR EXISTS (SELECT 1 FROM signups s WHERE s.team_entry_id = strategies.team_entry_id AND s.driver_id = get_current_driver_id())) AND NOT EXISTS (SELECT 1 FROM team_entries te JOIN events e ON e.id = te.event_id WHERE te.id = strategies.team_entry_id AND e.archived = true));
CREATE POLICY strategies_update ON public.strategies FOR UPDATE TO authenticated
  USING ((is_admin() OR EXISTS (SELECT 1 FROM signups s WHERE s.team_entry_id = strategies.team_entry_id AND s.driver_id = get_current_driver_id())) AND NOT EXISTS (SELECT 1 FROM team_entries te JOIN events e ON e.id = te.event_id WHERE te.id = strategies.team_entry_id AND e.archived = true));
CREATE POLICY strategies_delete ON public.strategies FOR DELETE TO authenticated
  USING ((is_admin() OR EXISTS (SELECT 1 FROM signups s WHERE s.team_entry_id = strategies.team_entry_id AND s.driver_id = get_current_driver_id())) AND NOT EXISTS (SELECT 1 FROM team_entries te JOIN events e ON e.id = te.event_id WHERE te.id = strategies.team_entry_id AND e.archived = true));

-- team_entries
CREATE POLICY team_entries_select   ON public.team_entries FOR SELECT
  USING (is_admin() OR (is_approved_driver() AND NOT is_external()) OR (is_external() AND EXISTS (SELECT 1 FROM signups WHERE signups.team_entry_id = team_entries.id AND signups.driver_id = get_current_driver_id())));
CREATE POLICY team_entries_realtime ON public.team_entries FOR SELECT USING (is_approved_driver());
CREATE POLICY team_entries_insert   ON public.team_entries FOR INSERT
  WITH CHECK (is_approved_driver() AND NOT is_external() AND NOT EXISTS (SELECT 1 FROM events WHERE events.id = team_entries.event_id AND events.archived = true));
CREATE POLICY team_entries_update   ON public.team_entries FOR UPDATE
  USING ((is_admin() OR (NOT is_external() AND EXISTS (SELECT 1 FROM signups WHERE signups.team_entry_id = team_entries.id AND signups.driver_id = get_current_driver_id()))) AND NOT EXISTS (SELECT 1 FROM events WHERE events.id = team_entries.event_id AND events.archived = true));
CREATE POLICY team_entries_delete   ON public.team_entries FOR DELETE
  USING (is_admin() AND NOT EXISTS (SELECT 1 FROM events WHERE events.id = team_entries.event_id AND events.archived = true));


-- ── Realtime publications ─────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE
  public.championships,
  public.deleted_signups_logs,
  public.deleted_team_entries_logs,
  public.drivers,
  public.event_start_times,
  public.events,
  public.iracing_events,
  public.iracing_laps,
  public.signups,
  public.stints,
  public.team_entries;


-- ── pg_cron jobs ──────────────────────────────────────────────────────────────

-- Auto-archive events 2 hours after their last start time + duration has elapsed.
-- Runs every 15 minutes; calls archive_event() which snapshots names before flipping archived = true.
SELECT cron.schedule(
  'auto-archive-events',
  '*/15 * * * *',
  $$
  DO $inner$
  DECLARE
    ev RECORD;
  BEGIN
    FOR ev IN
      SELECT e.id
      FROM events e
      WHERE e.archived = false
        AND EXISTS (
          SELECT 1 FROM event_start_times est
          WHERE est.event_id = e.id
          GROUP BY e.id, e.duration_minutes
          HAVING MAX(est.irl_start) +
                 (e.duration_minutes + 120) * interval '1 minute' < NOW()
        )
    LOOP
      PERFORM archive_event(ev.id);
    END LOOP;
  END;
  $inner$
  $$
);
