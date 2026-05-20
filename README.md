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
```

`SUPABASE_SERVICE_ROLE_KEY` is used server-side only (never exposed to the client).

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
lib/
  supabase.js           # Legacy anon client
  supabase-server.js    # Server-side client (service role)
  supabase-browser.js   # Browser client (@supabase/ssr)
  auth.js               # Session helpers, role checks
  db-utils.js           # Shared DB query helpers
  timezone.js           # Luxon timezone formatting
  car-types.js          # Car class / type definitions
  manufacturers.js      # Manufacturer lookup
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
