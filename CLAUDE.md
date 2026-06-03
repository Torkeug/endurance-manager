# Kronos Team Endurance Manager

Web app for managing iRacing endurance teams. Handles driver registration/approval, event sign-ups, team entry configuration, stint planning, iRacing data sync, and race-day tooling.

## Stack

- **Next.js 16** — App Router, mostly JS (not TS). Server components for data fetching, client components for interactivity.
- **Supabase** — Postgres + Auth + Realtime. Project ref: `xiehdrcywoyeggtnbzcl`
- **Resend** — transactional email (driver approval, stale sync warnings)
- **iRacing API** — syncs driver iRating, car/track inventory via OAuth
- **Garage61** — lap data integration via OAuth
- **Discord bot** — separate external codebase, not in this repo (see below)

## Supabase

MCP is configured in `.mcp.json` — use it to inspect schema and apply migrations directly.

- Read queries: `execute_sql`
- Schema changes: `apply_migration` (creates a versioned entry in `supabase_migrations`)
- Migrations live in `supabase/migrations/`. Baseline is `0000_baseline.sql`. New migrations: `0001_...sql`, `0002_...sql`, etc.

## Key non-obvious things

### Roles
`super_admin`, `admin`, `driver`, `external`, `engineer`. Engineers have read-only race-day access and are excluded from active driver counts, sync requirement checks, and stale sync emails. Externals (guest drivers) have scoped access — only see their own team's data.

### Test accounts vs test drivers
Two separate flags that mean different things:
- `drivers.is_test_account` — permanent test/bot accounts. Excluded from stale sync emails and active driver counts.
- `drivers.test_driver` — a temporary "test driver" status toggled by admins. Excluded from membership overdue, sync required, and inactive driver counts, but NOT from active driver count (use `is_test_account` there).

### Supabase clients
- `lib/supabase-server.js` — server components and API routes
- `lib/supabase-browser.js` — client components

### Discord bot (external)
The bot is a separate codebase not in this repo. It reads directly from the DB. Key fields it uses:
- `signups.discord_notifications_override` (boolean) — whether to send alerts for this driver on this entry
- `signups.discord_alert_minutes_override` (int) — per-entry alert timing override
- `drivers.discord_alert_minutes` (int) — per-driver default alert timing
- `team_entries.notification_minutes_before` (int) — legacy team-level fallback, still in DB

Resolution order the bot should use: signup override → driver default → team fallback → disabled.

**The bot currently uses the old column name `discord_notifications` which no longer exists** — it was renamed to `discord_notifications_override`. The bot needs updating.

### Discord alert driver-based feature (in progress)
DB schema is done (migration applied). App UI not yet built:
- Driver profile edit page needs a `discord_alert_minutes` input
- AvailabilityGrid needs a `discord_alert_minutes_override` input per driver row

### Stint calculation
`StintGrid.js` runs a client-side calc engine. The "covering stint" path must use `Math.round()` on `_laps * _lapTimeSec` before writing to `duration_sec_calc` (integer column). Floats cause a Postgres 400 error.

### Archiving events
Done via the `archive_event(event_id uuid)` DB function — snapshots circuit/car/driver names before flipping `archived = true`. Only callable by `authenticated` and `service_role` (anon is explicitly revoked).

## UI language
French throughout. All user-facing strings, labels, and error messages are in French.
