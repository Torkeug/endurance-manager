CREATE TABLE iracing_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN ('pit_entry', 'pit_exit', 'race_start', 'conditions_change')),
  iracing_cust_id INTEGER,
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  track_id INTEGER NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  recorded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX iracing_events_driver_recorded ON iracing_events (driver_id, recorded_at);
CREATE INDEX iracing_events_track_type ON iracing_events (track_id, event_type, recorded_at);

ALTER TABLE iracing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "iracing_events_select"
ON iracing_events FOR SELECT
USING (
  (is_approved_driver() AND (NOT is_external()))
  OR
  (is_external() AND (EXISTS (
    SELECT 1 FROM signups s1
    JOIN signups s2 ON s2.team_entry_id = s1.team_entry_id
    WHERE s1.driver_id = get_current_driver_id()
    AND s2.driver_id = iracing_events.driver_id
  )))
);
