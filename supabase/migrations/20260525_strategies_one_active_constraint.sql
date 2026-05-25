-- Enforce at most one active strategy per team entry.
-- Prevents the race condition where concurrent effect runs could insert
-- multiple default strategies with is_active = true.
CREATE UNIQUE INDEX strategies_one_active_per_entry
  ON strategies (team_entry_id)
  WHERE is_active = true;
