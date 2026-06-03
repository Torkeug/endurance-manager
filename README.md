# Kronos Endurance Planner

Web app for managing iRacing endurance events — team entries, driver signups, stint planning, availability grids, race mode, and practice tracking.

Built with Next.js 16 + React 19, backed by Supabase.

## Stack

- **Next.js 16** (App Router, server components)
- **Supabase** — auth, database, real-time
- **Recharts** — performance charts
- **Luxon** — timezone-aware time formatting
- **Resend** — transactional emails (registration, approval, stale-sync warnings)

## Getting started

### Prerequisites

- Node.js 18+
- A Supabase project

### Environment variables

Create a `.env.local` file at the project root:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
GARAGE61_CLIENT_SECRET=your-garage61-client-secret
RESEND_API_KEY=your-resend-api-key
API_KEY=your-iracing-webhook-secret
CRON_SECRET=your-cron-secret
NEXT_PUBLIC_SHOW_TEST_ACCOUNTS=true
```

`SUPABASE_SERVICE_ROLE_KEY`, `GARAGE61_CLIENT_SECRET`, `RESEND_API_KEY`, `API_KEY`, and `CRON_SECRET` are server-side only (never exposed to the client). `NEXT_PUBLIC_APP_URL` must match the registered OAuth redirect URIs. iRacing OAuth uses a hardcoded public client ID and PKCE — no server-side secret required.

### Install and run

```bash
npm install
npm run dev       # development server at http://localhost:3000
npm run build     # production build
npm run start     # serve production build
npm run lint      # ESLint
```

## Project structure

```
app/
  admin/                    # Admin panel — single-page tabbed interface
                            # Tabs: Pilotes (pending approvals), Équipages, Voitures,
                            #       Classes, Circuits, Types d'événement, Paramètres
  api/
    garage61-laps/          # Fetches best lap at a specific circuit for a driver from Garage61
    garage61-practice/      # Aggregates per-circuit practice stats for a driver from Garage61
    garage61-sync/          # Imports lap data from Garage61 into team entry performance table
    notify-admins/          # Emails all admins when a new driver registers
    notify-admins-approval/ # Emails other admins when a pending driver is approved (avoids acting on stale lists)
    notify-driver-approved/ # Emails a driver to confirm their account has been approved
    notify-stale-sync/      # Emails a driver whose iRacing data hasn't been synced in over 100 days
    register-driver/        # Server-side driver record insert during registration (bypasses RLS — user has no session yet)
  api/
    iracing/
      event/                # Webhook: receives iRacing session events from the bridge (auth: Bearer API_KEY)
      lap/                  # Webhook: receives lap telemetry from the bridge (auth: Bearer API_KEY)
    cron/
      check-stale-syncs/    # Finds drivers with >100-day stale iRacing sync, sends email (cooldown: 30d per driver)
      cleanup-iracing-laps/ # Deletes iRacing laps older than 7 days
  auth/
    callback/
      garage61/             # Garage61 OAuth callback — exchanges code, stores tokens + slug
      iracing/              # iRacing OAuth callback — exchanges code, stores tokens, syncs inventory + iRating
    garage61/               # Garage61 OAuth init (PKCE)
    iracing/                # iRacing OAuth init (PKCE)
    reset/                  # PKCE token handler for password-reset emails — redirects to /update-password
  championnats/             # Championship list
    [id]/                   # Championship detail (rounds, standings)
      modifier/             # Edit championship (admin)
      nouveau-round/        # Add round (admin)
    nouveau/                # Create championship (admin)
  change-password/          # Change password for logged-in users (requires current password)
  evenements/               # Event list
    [id]/                   # Event detail
      equipages/            # Team entries (race mode, stint planning, performances)
      inscription/          # Driver signup form
      modifier/             # Edit event (admin)
    nouveau/                # Create event (admin)
  guide/                    # End-user guide (pilot-facing docs)
  inventaire/               # Global inventory matrix (cars + tracks)
  login/                    # Login page
  pending/                  # Shown after registration — driver waits for admin approval
  pilotes/                  # Driver list
    [id]/                   # Driver profile (stats, inventory, Garage61, connections)
      inventaire/           # Per-driver iRacing inventory
      modifier/             # Edit driver profile (admin)
    nouveau/                # Create driver profile (admin)
  refused/                  # Shown when an account is rejected by an admin
  register/                 # Self-registration form (creates Supabase Auth account + driver record)
  reset-password/           # Forgot-password form — sends reset email via Supabase
  update-password/          # Set new password after clicking the reset link
lib/
  supabase.js           # Legacy anon client
  supabase-server.js    # Server-side client (service role)
  supabase-browser.js   # Browser client (@supabase/ssr)
  auth.js               # Session helpers, role checks
  garage61.js           # Shared Garage61 API fetch + token refresh helpers
  db-utils.js           # Shared DB query helpers
  timezone.js           # Luxon timezone formatting
  car-types.js          # Car class / type definitions
  manufacturers.js      # Manufacturer lookup
supabase/
  migrations/       # SQL migrations — 0000_baseline.sql is the full schema snapshot;
                    # new migrations are applied via Supabase MCP or dashboard
.mcp.json           # Supabase MCP server config (Claude Code integration)
```

## Roles

| Role          | Access                            |
| ------------- | --------------------------------- |
| `super_admin` | Full access including admin panel |
| `admin`       | Full event and driver management  |
| `engineer`    | Read access + relais tab          |
| `driver`      | Own signups, assigned team entry  |
| `external`    | Own entry only (limited view)     |

## Auth

Supabase Auth (email/password). The middleware protects all routes — unauthenticated users are redirected to `/login`.

**Registration flow:** drivers self-register at `/register`, which creates a Supabase Auth account and inserts a driver record via the `/api/register-driver` server route (necessary because the user has no active session yet, so RLS blocks a direct client insert). After registration, the driver lands on `/pending`. Admins receive an email notification via Resend. Once an admin approves the driver, both the driver and all other admins receive confirmation emails. Rejected accounts are redirected to `/refused`.

**Password reset:** `/reset-password` (enter email) → Supabase sends a reset link → `/auth/reset` handles the PKCE token → `/update-password` sets the new password. Logged-in users can change their password at `/change-password` (requires confirming the current password).

## Third-party integrations

### iRacing

OAuth PKCE flow linked from the driver profile page. On callback, stores `iracing_access_token` / `iracing_refresh_token` on the `drivers` table and immediately syncs the driver's iRacing inventory (owned cars + tracks) and iRating history.

### Garage61

OAuth PKCE flow linked from the driver profile page (`/pilotes/[id]`). On callback, stores `garage61_access_token` / `garage61_refresh_token` / `garage61_slug` on the `drivers` table.

Once linked, Garage61 data is available in two places:

**Performance import (team entry → Performances tab)**
A `📥 Garage61` button appears next to each driver's row when the circuit has an `iracing_track_id` set. It opens an import panel that fetches the driver's laps from Garage61 for that circuit and lets you apply a lap time and fuel consumption directly into the performance form. Filters: condition (dry/wet), session type (P/Q/R), same car (on by default), fuel level range (min/max L), track temp range (min/max °C), date range with presets (7j / 30j / 3 mois). Columns: condition, lap time, fuel used, fuel level, track temp, date, car, session.

**Practice stats (driver profile → Statistiques → Garage61)**
A `Garage61` subtab in the Statistics section of the driver profile shows an aggregated view of the driver's practice sessions across all circuits recorded on Garage61. Features: sort by laps / clean % / time on track / name; multi-select category filter (Road, Oval, Dirt Road, Dirt Oval) always grouped by category; expand any circuit row to see the best lap (time, car, session type, clean/wet, date) with a direct link to Garage61.

Both features use the requesting user's Garage61 token to fetch team-level data — any linked team member can view data for any other driver in the team without requiring that driver to be online.

API responses are cached server-side: track catalogue 1 h, team statistics and laps 15 min, `/me` 1 h.

### Discord bot

A separate external codebase (not in this repo) that reads directly from the database to send stint handoff alerts. It uses:

- `signups.discord_notifications_override` — whether to send alerts for a driver on a given entry
- `signups.discord_alert_minutes_override` — per-entry timing override
- `drivers.discord_alert_minutes` — per-driver default timing

Resolution order: signup override → driver default → disabled.

### iRacing webhook bridge

An external bridge sends session and lap telemetry to this app in real time:

- `POST /api/iracing/event` — session events (start, end, etc.)
- `POST /api/iracing/lap` — per-lap telemetry (lap time, fuel, conditions, weather)

Both endpoints require `Authorization: Bearer $API_KEY`.

## Cron jobs

Triggered by Vercel Cron. Both require `Authorization: Bearer $CRON_SECRET`.

| Endpoint | Frequency | Purpose |
|----------|-----------|---------|
| `GET /api/cron/check-stale-syncs` | Mondays 8am UTC | Find drivers with >100-day stale iRacing sync, send email reminder (30-day per-driver cooldown) |
| `GET /api/cron/cleanup-iracing-laps` | Daily 3am UTC | Delete iRacing laps older than 7 days |
