# Kronos Endurance Planner

Web app for managing iRacing endurance events — team entries, driver signups, stint planning, availability grids, and race mode.

Built with Next.js 16 + React 19, backed by Supabase.

## Stack

- **Next.js 16** (App Router, server components)
- **Supabase** — auth, database, real-time
- **Tailwind CSS v4**
- **Recharts** — performance charts
- **Luxon** — timezone-aware time formatting

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
```

`SUPABASE_SERVICE_ROLE_KEY` and `GARAGE61_CLIENT_SECRET` are used server-side only (never exposed to the client). `NEXT_PUBLIC_APP_URL` must match the registered OAuth redirect URI.

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
  evenements/       # Event pages (list, detail, signup, team entries)
  pilotes/          # Driver profiles
  championnats/     # Championship management
  inventaire/       # Global inventory
  guide/            # End-user guide (pilot-facing docs)
  admin/            # Admin panel
  auth/
    garage61/       # Garage61 OAuth init (PKCE)
    iracing/        # iRacing OAuth init (PKCE)
    callback/
      garage61/     # Garage61 OAuth callback — exchanges code, stores tokens
      iracing/      # iRacing OAuth callback
  api/
    garage61-sync/  # Fetches driver laps from Garage61 by iRacing track ID
lib/
  supabase.js           # Legacy anon client
  supabase-server.js    # Server-side client (service role)
  supabase-browser.js   # Browser client (@supabase/ssr)
  auth.js               # Session helpers, role checks
  db-utils.js           # Shared DB query helpers
  timezone.js           # Luxon timezone formatting
  car-types.js          # Car class / type definitions
  manufacturers.js      # Manufacturer lookup
supabase/
  migrations/       # SQL migrations — run manually in Supabase dashboard
```

## Roles

| Role | Access |
|------|--------|
| `super_admin` | Full access including admin panel |
| `admin` | Full event and driver management |
| `engineer` | Read access + relais tab |
| `driver` | Own signups, assigned team entry |
| `external` | Own entry only (limited view) |

## Auth

Supabase Auth (email/password). The middleware protects all routes — unauthenticated users are redirected to `/login`. New accounts land on `/pending` until approved by an admin.

## Third-party integrations

### iRacing
OAuth PKCE flow linked from the driver profile page. Stores `iracing_access_token` / `iracing_refresh_token` on the `drivers` table.

### Garage61
OAuth PKCE flow linked from the driver profile page (`/pilotes/[id]`). Stores `garage61_access_token` / `garage61_refresh_token` on the `drivers` table.

Once linked, the **Performances** tab on a team entry shows a **📥 Garage61** button (when the circuit has an `iracing_track_id` set). This opens an import panel that fetches the driver's laps from Garage61 for that circuit and lets you apply a lap time and fuel consumption directly into the performance form. Filters: condition, session type, day/night, same car, clean laps only, date range.

Any team member can import data for any driver — consent is implicit when the driver links their account.

**Required DB migration** (run once in Supabase dashboard):
```sql
-- supabase/migrations/20260525_add_garage61_tokens.sql
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS garage61_access_token TEXT,
  ADD COLUMN IF NOT EXISTS garage61_refresh_token TEXT;
```
