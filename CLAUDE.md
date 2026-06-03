# Kronos Team Endurance Manager — Claude Context

Web app for managing iRacing endurance teams. Handles driver registration/approval, event sign-ups, team entry configuration, stint planning, iRacing data sync, and race-day tooling. UI is entirely in French.

## Stack

- **Next.js 16** — App Router, mostly JS (not TS). Server components for data fetching, client components for interactivity.
- **Supabase** — Postgres + Auth + Realtime. Project ref: `xiehdrcywoyeggtnbzcl`
- **Resend** — transactional email (driver approval, stale sync warnings)
- **iRacing API** — syncs driver iRating, car/track inventory via OAuth PKCE
- **Garage61** — lap data integration via OAuth PKCE
- **Recharts** — iRating history charts
- **Luxon** — timezone-aware date/time formatting
- **Discord bot** — separate external codebase, not in this repo

## Supabase

MCP is configured in `.mcp.json` — use it to inspect the live schema and apply migrations without copy-pasting SQL.

- **Read queries:** `execute_sql`
- **Schema changes:** `apply_migration` (records a versioned entry in `supabase_migrations`)
- **Migrations:** `supabase/migrations/`. Baseline is `0000_baseline.sql`. New migrations: `0001_...sql`, `0002_...sql`, etc.

## Key lib files

| File | Purpose |
|------|---------|
| `lib/supabase-server.js` | Service role client — server components and API routes, bypasses RLS |
| `lib/supabase-browser.js` | Browser client (`@supabase/ssr`) — client components, uses session cookie |
| `lib/supabase.js` | Legacy anon client — not actively used |
| `lib/auth.js` | `getSessionAndDriver()`, `isAdmin()`, `isSuperAdmin()`, `isExternal()`, `isEngineer()` |
| `lib/timezone.js` | Luxon helpers — `localToUTC`, `utcToLocal`, `formatInZone`, `getTZAbbr` |
| `lib/garage61.js` | Garage61 API fetch + token refresh; module-level cache (tracks 1h, stats 15min) |
| `lib/db-utils.js` | `fetchAllRows()` — paginates past PostgREST's 1000-row limit |
| `lib/car-types.js` | Car class/type definitions and lookup helpers |
| `lib/manufacturers.js` | Manufacturer lookup for iRacing cars |

## App routes

### Auth & registration
| Route | What it does |
|-------|-------------|
| `/login` | Email/password login |
| `/register` | Self-registration → creates Supabase Auth + driver record via `/api/register-driver` |
| `/pending` | Waiting room after registration |
| `/refused` | Shown when admin rejects account |
| `/reset-password` | Forgot password form |
| `/auth/reset` | PKCE token handler for reset links |
| `/update-password` | Set new password after reset link |
| `/change-password` | Change password while logged in |

### Main app
| Route | What it does |
|-------|-------------|
| `/` | Dashboard: upcoming events, next stint, admin stat cards, Planning/Suivi tabs |
| `/evenements` | Event list |
| `/evenements/nouveau` | Create event (admin) |
| `/evenements/[id]` | Event detail — Équipages / Inscriptions / Courses tabs |
| `/evenements/[id]/modifier` | Edit event (admin) |
| `/evenements/[id]/inscription` | Driver signup form |
| `/evenements/[id]/equipages/nouveau` | Create team entry (admin) |
| `/evenements/[id]/equipages/[entryId]` | Team entry hub — 6 tabs (see below) |
| `/evenements/[id]/equipages/[entryId]/modifier` | Edit team entry (admin) |
| `/pilotes` | Driver list |
| `/pilotes/nouveau` | Create driver (admin) |
| `/pilotes/[id]` | Driver profile — Profil / Statistiques / Inventaire / Engagements tabs |
| `/pilotes/[id]/modifier` | Edit driver profile (admin) |
| `/pilotes/[id]/inventaire` | Per-driver iRacing car + track inventory |
| `/inventaire` | Global car × driver ownership matrix |
| `/admin` | Admin panel — Pilotes / Équipages / Voitures / Classes / Circuits / Types / Paramètres tabs |
| `/championnats/nouveau` | Create championship |
| `/championnats/[id]/modifier` | Edit championship |
| `/championnats/[id]/nouveau-round` | Add round |
| `/guide` | End-user documentation with interactive demos |

### Team entry tabs (`/evenements/[id]/equipages/[entryId]`)
| Tab | Component | What it does |
|-----|-----------|-------------|
| Pilotes | `DriversAssignment.js` | Assign drivers, show iRating, mismatch warnings |
| Disponibilités | `AvailabilityGrid.js` | 30-min availability slots per driver |
| Relais | `StintGrid.js` | Core stint planning + fuel calc engine |
| Planning | `PlanningTab.js` | Gantt chart of stints with current-time indicator |
| Performances | `PerformanceData.js` | Lap time + fuel entry, Garage61 import panel |
| 🏁 Course | `RaceMode.js` | Live race tracking, actual end time input |

## API routes

### Auth / OAuth
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/iracing` | GET | Initiate iRacing OAuth PKCE. Modes: `driver` (self-link), `syncall` (admin syncs all) |
| `/api/auth/callback/iracing` | GET | Exchange code, sync inventory + iRating |
| `/api/auth/garage61` | GET | Initiate Garage61 OAuth PKCE |
| `/api/auth/callback/garage61` | GET | Exchange code, store tokens + slug |
| `/api/auth/callback` | GET | Supabase Auth callback handler |
| `/api/register-driver` | POST | Insert driver record with service role (user has no session yet) |

### Notifications (Resend email)
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/notify-admins` | POST | Email all admins on new driver registration |
| `/api/notify-driver-approved` | POST | Email driver on approval |
| `/api/notify-admins-approval` | POST | Email other admins when approval happens |
| `/api/notify-stale-sync` | POST | Email driver whose iRacing data is >100 days stale |

### Garage61 data
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/garage61-sync` | GET | Fetch laps for a circuit (Performances tab import) |
| `/api/garage61-laps` | GET | Filtered laps (condition, session type, car, fuel/temp ranges, date) |
| `/api/garage61-practice` | GET | Aggregated per-circuit practice stats (driver profile) |
| `/api/admin/garage61-detect` | GET | Admin: detect Garage61-linked drivers |

### iRacing webhooks (bridge → app)
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/iracing/event` | POST | Store session event (event_type, track_id, payload). Auth: Bearer `API_KEY` |
| `/api/iracing/lap` | POST | Store lap telemetry (lap_time, fuel, track conditions). Auth: Bearer `API_KEY` |

### Cron jobs (Vercel-triggered)
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/cron/check-stale-syncs` | GET | Find drivers with >100-day stale iRacing sync, send email (30-day cooldown per driver) |
| `/api/cron/cleanup-iracing-laps` | GET | Delete iRacing laps older than 7 days |

Both require `Authorization: Bearer $CRON_SECRET`.

## Data flows

### Auth & registration
1. `/register` → `supabase.auth.signUp()` → `POST /api/register-driver` (service role, approved: false)
2. `POST /api/notify-admins` → emails all admins
3. Driver lands on `/pending`
4. Admin approves in `/admin` → `drivers.approved = true`
5. `POST /api/notify-driver-approved` → emails driver

### iRacing sync
1. Driver clicks "Lier iRacing" on profile → `GET /api/auth/iracing?mode=driver&returnTo=...`
2. PKCE challenge generated, redirect to iRacing OAuth
3. Callback at `/api/auth/callback/iracing` → exchanges code, fetches profile + catalogs
4. Upserts `iracing_cars`, `iracing_tracks`; updates `drivers.irating`, `last_driver_sync_at`; inserts into `irating_history`, `driver_car_ownership`, `driver_track_ownership`
5. Redirects back with `?iracing_synced=true`

Admin "Sync All" mode: same flow but iterates over all approved, active, non-engineer, non-test-account drivers with an iRacing ID.

### Stint calculation engine (`StintGrid.js`)
Client-side calc, runs on demand (recalc modal) or after strategy changes.

1. Fetch active strategy, stints, availabilities, performance data
2. For each stint: resolve driver → look up lap time and fuel per lap via 4-tier fallback:
   - Tier 1: exact condition match (e.g. dry-night)
   - Tier 2: proxy condition (different weather, no modifier)
   - Tier 3: night shift (try non-night perf if stint is at night)
   - Tier 4: team average across all drivers
3. `duration_sec_calc = Math.round(laps * lapTimeSec)` — **must use Math.round**, floats cause Postgres 400 on the `integer` column
4. Write `irl_start`, `irl_end_planned`, `duration_sec_calc`, `laps_calc` to DB

### Garage61 lap import (Performances tab)
1. Team entry Performances tab shows drivers assigned to entry
2. Click "📥 Garage61" → calls `GET /api/garage61-laps?iracing_track_id=X&driver_id=Y`
3. Resolves iRacing `track_id` → Garage61 track ID
4. Fetches driver laps with filters (condition, session type, car, fuel/temp ranges, date presets)
5. Click a lap row → pre-fills `fuel_per_lap` + `lap_time` in performance form

## Non-obvious things

### Roles
`super_admin` → `admin` → `driver` → `external` → `engineer`

- **Engineers** — read-only race-day access. Excluded from: active driver count, sync requirement checks, stale sync emails, inactive count.
- **Externals** — guest/co-driver role. Scoped access: only see their own team's data, limited write access, cannot sign up independently.

### Test accounts vs test drivers
Two distinct flags — do not conflate them:
- `drivers.is_test_account` — permanent bot/automation accounts. Excluded from: active driver count, stale sync emails.
- `drivers.test_driver` — temporary flag toggled per-driver by admins. Excluded from: membership overdue count, sync required count, inactive count. **NOT excluded from active driver count** — use `is_test_account` there.

### Discord bot
External codebase, not in this repo. Reads directly from the DB. Current schema it should use:

| Column | Table | Purpose |
|--------|-------|---------|
| `discord_notifications_override` | `signups` | boolean — enable alerts for this driver on this entry |
| `discord_alert_minutes_override` | `signups` | int — per-entry alert timing override |
| `discord_alert_minutes` | `drivers` | int — per-driver default alert timing |
| `notification_minutes_before` | `team_entries` | int — legacy team-level fallback (still in DB) |

**Resolution order:** signup override → driver default → team fallback → disabled.

⚠️ **The bot currently queries `signups.discord_notifications` which no longer exists** (renamed to `discord_notifications_override`). The bot needs updating before the Discord notification system works again.

### Discord alert driver-based feature (in progress)
DB schema is applied (migration done). App UI not yet built:
- Driver profile edit page needs `discord_alert_minutes` input
- AvailabilityGrid needs `discord_alert_minutes_override` input per driver row

### Admin home page stat cards
Active driver count excludes: `is_test_account = true`, `role = engineer`.
Sync required / inactive / overdue membership counts exclude: `test_driver = true`, `role = engineer`.

### RLS policy analysis
When auditing RLS policies, always cross-check against the actual UI code (role guards, button visibility, page-level auth checks) before drawing conclusions. Do not infer intent from adjacent policies — a DELETE being admin-only does not mean INSERT should be too. The source of truth for intended access is the UI guard, not the shape of nearby policies.

### Archiving events
Done via the `archive_event(uuid)` DB function — snapshots circuit/car/driver names then sets `archived = true`. Callable by `authenticated` and `service_role` only (anon is explicitly revoked).

**Auto-archiving:** a pg_cron job (`auto-archive-events`) runs every 15 minutes and automatically calls `archive_event()` on any unarchived event whose last start time + duration + 2h buffer has passed. No manual archiving needed after a race.

### Supabase clients
Always use `supabase-server.js` in server components and API routes. Use `supabase-browser.js` in `"use client"` components. The legacy `supabase.js` anon client is not actively used.

### Timezone handling
All event times stored in UTC. Displayed using Luxon with the event's `timezone` field (e.g. `Europe/Paris`). Use `lib/timezone.js` helpers — never do raw `new Date()` on event times in server components; use `LocalDate` client component for display.

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL       # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY  # Supabase anon key (public)
SUPABASE_SERVICE_ROLE_KEY      # Service role key (server only)
NEXT_PUBLIC_APP_URL            # Must match OAuth redirect URIs
GARAGE61_CLIENT_SECRET         # Garage61 OAuth client secret (server only)
RESEND_API_KEY                 # Resend email API key (server only)
API_KEY                        # Bearer token for iRacing webhook endpoints
CRON_SECRET                    # Bearer token for Vercel cron endpoints
NEXT_PUBLIC_SHOW_TEST_ACCOUNTS # Set to "true" to show test accounts in driver lists
```
