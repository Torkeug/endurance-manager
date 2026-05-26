-- Live lap telemetry uploaded by the Kronos iRacing Bridge running on each driver's PC.
-- One row per completed lap. Used as Tier 0 in stint calculations during a race.
-- driver_id is resolved at insert time by matching iracing_cust_id → drivers.iracing_id.

CREATE TABLE iracing_laps (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Driver linkage
  driver_id       UUID        REFERENCES drivers(id) ON DELETE CASCADE,
  iracing_cust_id INTEGER     NOT NULL,

  -- Session identity (from iRacing YAML)
  track_id        INTEGER     NOT NULL,
  car_id          INTEGER     NOT NULL,
  session_type    SMALLINT    NOT NULL,  -- 1=Practice  2=Qualify  3=Race

  -- Performance
  lap_time        NUMERIC(10,3) NOT NULL,  -- seconds
  fuel_level      NUMERIC(8,3),            -- litres remaining at lap end
  fuel_used       NUMERIC(8,3),            -- litres used this lap (computed delta)

  -- Conditions
  track_wetness_raw     SMALLINT,          -- irsdk_TrackWetness enum 0–7
  weather_declared_wet  BOOLEAN,
  track_temp            NUMERIC(5,1),      -- °C  (TrackTempCrew)
  air_temp              NUMERIC(5,1),      -- °C  (AirTemp)
  precipitation         NUMERIC(6,3),      -- %   (Precipitation)
  solar_altitude        NUMERIC(8,4),      -- radians  (SolarAltitude)
  session_time_of_day   NUMERIC(12,3),     -- seconds since midnight, in-game
  is_night              BOOLEAN,

  -- Timestamps
  recorded_at     TIMESTAMPTZ NOT NULL,    -- IRL UTC time on driver's machine
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Stint matching: find laps for a driver within a time window
CREATE INDEX iracing_laps_driver_recorded_at
  ON iracing_laps (driver_id, recorded_at);

-- Fast insert lookup: resolve driver_id from iracing_cust_id
CREATE INDEX iracing_laps_iracing_cust_id
  ON iracing_laps (iracing_cust_id);

-- Block all direct client access — all reads/writes go through the service role
ALTER TABLE iracing_laps ENABLE ROW LEVEL SECURITY;
