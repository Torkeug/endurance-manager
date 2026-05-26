ALTER TABLE iracing_laps
  ADD COLUMN on_pit_road BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN under_caution BOOLEAN NOT NULL DEFAULT false;

CREATE POLICY "iracing_laps_select"
ON iracing_laps FOR SELECT
USING (
  (is_approved_driver() AND (NOT is_external()))
  OR
  (is_external() AND (EXISTS (
    SELECT 1 FROM signups s1
    JOIN signups s2 ON s2.team_entry_id = s1.team_entry_id
    WHERE s1.driver_id = get_current_driver_id()
    AND s2.driver_id = iracing_laps.driver_id
  )))
);
