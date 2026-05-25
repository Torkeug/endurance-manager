-- Add Garage61 OAuth token storage to drivers table.
-- garage61_access_token: bearer token for Garage61 API calls.
-- garage61_refresh_token: used to renew the access token when it expires.
-- Both are nullable — null means the driver has not linked their Garage61 account.
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS garage61_access_token TEXT,
  ADD COLUMN IF NOT EXISTS garage61_refresh_token TEXT;
