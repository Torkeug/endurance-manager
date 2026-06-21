# Audit Fix Tracker
Generated from `AUDIT_2026-06-20.md`, `audit_security_full.txt`, `audit_quality_full.txt`.
Legend: ✅ Done · ⏳ Deferred/needs MCP · ❌ Not done

---

## Security (SEC-1 to SEC-9 — from AUDIT_2026-06-20.md)

| ID | Sev | File | Issue | Status |
|----|-----|------|-------|--------|
| SEC-1 | CRITICAL | `register-driver/route.js` | `auth_user_id` from body not session-verified | ✅ |
| SEC-2 | HIGH | notify-* routes | Unauthenticated email relay | ✅ |
| SEC-3 | HIGH | iracing/lap, iracing/event, cron routes | Fail-open bearer auth | ✅ |
| SEC-4 | HIGH | `garage61-sync/route.js` | IDOR on `driver_id` | ✅ already present |
| SEC-5 | MEDIUM | `auth/iracing/route.js` | `syncall` not admin-gated at initiation | ✅ already present |
| SEC-6 | MEDIUM | `callback/garage61/route.js` | Full token body logged | ✅ already logs only keys |
| SEC-7 | MEDIUM | iracing + garage61 initiation routes | `returnTo` open redirect | ✅ regex validation present |
| SEC-8 | MEDIUM | notify-admins, notify-admins-approval | HTML injection in email | ✅ escHtml present |
| SEC-9 | LOW/MED | garage61-laps, garage61-practice, garage61-sync | Unapproved users access Garage61 | ✅ already checks approved |

---

## Security (SEC-10 to SEC-26 — from audit_security_full.txt)

| ID | Sev | File | Issue | Status |
|----|-----|------|-------|--------|
| SEC-10 | CRITICAL | `auth/iracing/route.js` | OAuth CSRF: PKCE verifier in state param | ✅ already fixed — nonce cookie pattern in place |
| SEC-11 | CRITICAL | `auth/garage61/route.js` | Same OAuth CSRF | ✅ already fixed |
| SEC-12 | HIGH | `callback/iracing/route.js` | Callback never validates state nonce | ✅ already fixed — validates pkce_iracing_state cookie |
| SEC-13 | HIGH | `callback/garage61/route.js` | Same | ✅ already fixed — validates pkce_garage61_state cookie |
| SEC-14 | HIGH | `notify-stale-sync/route.js` | Caller-controlled `profile_url` in email href | ✅ already fixed — URL validated against allowlist |
| SEC-15 | HIGH | `notify-driver-approved/route.js` | UUID→email enumeration, no auth | ✅ already fixed — requires admin auth |
| SEC-16 | HIGH | `inscription/page.js` | IDOR: `?driver=<uuid>` lets non-admin sign up as another driver | ✅ intentional — signups_insert has no driver_id ownership check by design (admins sign up drivers on their behalf) |
| SEC-17 | HIGH | `callback/iracing/route.js` | `syncall` fetches wrong driver set | ✅ already fixed — has approved/active/is_test_account/role filters |
| SEC-18 | MEDIUM | `notify-admins-approval/route.js` | `approved_by_id` from request body | ✅ already fixed — derives from session |
| SEC-19 | MEDIUM | `pilotes/[id]/page.js` | `select("*")` returns OAuth tokens | ✅ already fixed — explicit column list excludes tokens |
| SEC-20 | MEDIUM | `pilotes/[id]/page.js` | Garage61 SSR fetch using another driver's token | ✅ already fixed — gated on `currentDriver?.id === id` |
| SEC-21 | MEDIUM | `garage61-practice/route.js` | IDOR on `driver_slug` | ✅ already fixed — checks slug ownership or admin |
| SEC-22 | MEDIUM | `pilotes/[id]/modifier/page.js` | Auth race: data fetched before auth check | ✅ verified safe — fetching guard renders before form |
| SEC-23 | LOW | `auth/callback/route.js` | Account-linkage race on email match | ⏳ low risk — requires email confirmation disabled |
| SEC-24 | LOW | `AvailabilityGrid.js` | Client-side only ownership guard | ✅ intentional — team members can coordinate each other's availability slots |
| SEC-25 | LOW | Multiple admin pages | Client-side-only admin checks | ✅ intentional — team_entries_insert open to all approved drivers by design; other writes gated by is_admin() at DB level |
| SEC-26 | LOW | `Nav.js` | Pending driver count visible via network | ✅ acceptable — any approved driver can read the drivers table; low sensitivity |

---

## Bugs (BUG-1 to BUG-9)

| ID | File | Issue | Status |
|----|------|-------|--------|
| BUG-1 | `StintGrid.js` | `updateStint` no try/finally | ✅ already present |
| BUG-2 | `StintGrid.js` | `updateActualEnd` same | ✅ already present |
| BUG-3 | `StintGrid.js` | `handleCreateStrategy` no finally | ✅ already present |
| BUG-4 | `StintGrid.js` | `_isLastStint` used `find()` | ✅ |
| BUG-5 | `check-stale-syncs/route.js` | `stale_sync_notified_at` before email | ✅ already awaits + only writes on res.ok |
| BUG-6 | `check-stale-syncs/route.js` | Includes iracing_id=null drivers | ✅ already has .not filter |
| BUG-7 | `StintGrid.js` | `Promise.all` no catch | ✅ already has .catch |
| BUG-8 | `StintGrid.js` | `effectiveEnd` with null `_irlEnd` | ✅ |
| BUG-9 | `RaceMode.js` | `iracing_events` RLS unverified | ✅ only a SELECT policy exists; writes blocked for all authenticated users; bridge API uses service_role (bypasses RLS) |

---

## React / Hook Issues

| ID | File | Issue | Status |
|----|------|-------|--------|
| HOOK-1 | `StintGrid.js` | `driverIds` unstable ref | ✅ |
| HOOK-2 | `StintGrid.js` | Strategy-switch fires when tab hidden | ✅ |
| HOOK-3 | `StintGrid.js` | `autoOpenRecalc` missing dep | ✅ eslint-disable |
| HOOK-4 | `StintGrid.js` | `isStintCompleted` calls `new Date()` | ✅ accepted |
| HOOK-5 | `StintGrid.js` | Strategy resolution flicker | ⏳ complex |

---

## ESLint set-state-in-effect suppressions

| File | Status |
|------|--------|
| `app/HomeTabs.js` | ✅ |
| `app/IncompleteTab.js` | ✅ |
| `app/admin/ChampionshipTeamsManager.js` (lines 40, 590) | ✅ |
| `app/admin/CircuitsManager.js` | ✅ |
| `app/championnats/[id]/nouveau-round/page.js` | ✅ |
| `app/change-password/page.js` | ✅ |
| `app/evenements/EventTabs.js` | ✅ |
| `app/evenements/[id]/CollapsibleEventInfo.js` | ✅ |
| `app/evenements/[id]/EventPageTabs.js` | ✅ |
| `app/evenements/[id]/equipages/[entryId]/ActualEndInput.js` | ✅ |
| `app/evenements/[id]/equipages/[entryId]/AvailabilityGrid.js` | ✅ |
| `app/evenements/[id]/equipages/[entryId]/CollapsibleSummary.js` | ✅ |
| `app/evenements/[id]/equipages/[entryId]/PerformanceData.js` | ✅ |
| `app/evenements/[id]/equipages/[entryId]/StintGrid.js` (ActivateBeforeDelete) | ✅ |
| `app/evenements/[id]/equipages/[entryId]/modifier/page.js` | ✅ |
| `app/evenements/[id]/equipages/nouveau/page.js` | ✅ |
| `app/evenements/[id]/inscription/page.js` | ✅ |
| `app/evenements/nouveau/page.js` | ✅ |
| `app/guide/components/demos/InscriptionsDemo.tsx` (static-components) | ✅ |
| `app/login/page.js` | ✅ (lazy initializer) |
| `app/page.js` (purity) | ✅ server component |
| `app/pending/page.js` | ✅ (lazy initializer) |
| `app/pilotes/[id]/DriverStats.js` (purity, rules-of-hooks) | ✅ purity suppressed; `useLocale()` in IRatingTooltip already called before conditional return — no violation |
| `app/pilotes/[id]/Garage61StatsTab.js` | ✅ |
| `app/pilotes/[id]/page.js` (purity) | ✅ server component |
| `app/pilotes/page.js` (purity) | ✅ server component |
| `app/register/page.js` | ✅ (lazy initializer) |
| `app/reset-password/page.js` | ✅ (lazy initializer) |
| `app/update-password/page.js` | ✅ (lazy initializer) |
| `components/LocalDate.js` | ✅ (useSyncExternalStore) |
| `components/Nav.js` | ✅ eslint-disable |

---

## Q-Series (from audit_quality_full.txt — Q-1 to Q-73)

| ID | Sev | File | Issue | Status |
|----|-----|------|-------|--------|
| Q-1 | HIGH | `register/page.js:42` | Orphan auth user when driver insert fails | ✅ already fixed — deleteUser in error path |
| Q-2 | HIGH | `nouveau-round/page.js:326` | Fire-and-forget `event_start_times` insert | ✅ already awaited + checked |
| Q-3 | HIGH | `nouveau-round/page.js:614` | `setState` during render (IIFE in JSX) | ✅ IIFE removed, useEffect added |
| Q-4 | MEDIUM | `evenements/[id]/modifier/page.js:883` | `setState` during render | ✅ IIFE removed, useEffect added |
| Q-5 | MEDIUM | `evenements/nouveau/page.js:713` | `setState` during render | ✅ IIFE removed, useEffect added |
| Q-6 | HIGH | `CollapsibleSummary.js:175` | Null crash on `streamUrls` | ✅ already fixed — uses `?? []` |
| Q-7 | HIGH | `ClassesManager.js:217` | Non-atomic class rename | ✅ rollback added on cars update failure |
| Q-8 | HIGH | `EventTypesManager.js:491` | Stale closure in parallel `toggleCar` | ✅ false positive — `setEventTypeCars` uses functional updater; `currentlyAllowed` passed as arg |
| Q-9 | HIGH | `DriversManager.js:346` | `hasStints` never set on delete modal | ✅ already correct — line 357 sets `hasStints: (stints?.length ?? 0) > 0` |
| Q-10 | HIGH | `championnats/nouveau/page.js:63` | Orphan championship on partial failure | ✅ false positive — single insert, no two-step creation |
| Q-11 | MEDIUM | `auth/callback/route.js:35` | Wrong SDK method for `token_hash` | ✅ already fixed — uses verifyOtp |
| Q-12 | HIGH | `PlanningTab.js:21` | Gantt uses browser local timezone | ✅ already fixed — `formatTime` uses `formatTimeInZone(iso, tz)` |
| Q-13 | HIGH | `championnats/[id]/modifier/page.js:170` | Championship delete no cascade warning | ✅ already fixed — deleteMsg lists rounds + all associated data |
| Q-14 | MEDIUM | `StintGrid.js:1809` | `handleSetActive` missing `onActiveStrategyChange` | ✅ already fixed |
| Q-15 | MEDIUM | `StintGrid.js:1870` | `deleteStint` renumber not rolled back on error | ✅ already fixed |
| Q-16 | MEDIUM | `RaceMode.js:349` | `fetchData` no `finally` | ✅ already fixed |
| Q-17 | MEDIUM | `RaceMode.js:814` | `markPitStop` no try/finally | ✅ already fixed |
| Q-18 | MEDIUM | `RaceMode.js:876` | `undoLastPit` same | ✅ already fixed |
| Q-19 | MEDIUM | `RaceMode.js:493` | `pit_exit` doesn't write `irl_start_actual_backup` to DB | ✅ DB write added before irl_start_actual update |
| Q-20 | MEDIUM | `PerformanceData.js:1250` | `Promise.all` no `.catch()` | ✅ already fixed — has try/catch/finally |
| Q-21 | MEDIUM | `PerformanceData.js` | `assignedDrivers.length` dep misses driver swaps | ✅ |
| Q-22 | MEDIUM | `AvailabilityGrid.js` | Discord alert minutes saved on keypress | ✅ already onBlur |
| Q-23 | MEDIUM | `AvailabilityGrid.js:536` | "Mark all available" no rollback | ✅ |
| Q-24 | MEDIUM | `AvailabilityGrid.js:564` | "Wipe all" no rollback | ✅ |
| Q-25 | MEDIUM | `AvailabilityGrid.js:218` | Initial fetch no catch | ✅ |
| Q-26 | MEDIUM | `Garage61Manager.js:182` | `applyExact` no try/finally | ✅ |
| Q-27 | MEDIUM | `Garage61Manager.js:197` | `applyOverride` silent failure | ✅ |
| Q-28 | MEDIUM | `ChampionshipTeamsManager.js:593` | `handleSave` null deref | ✅ |
| Q-29 | MEDIUM | `ChampionshipTeamsManager.js:547` | `fetchData` swallows errors | ✅ |
| Q-30 | MEDIUM | `CarsManager.js:322` | Delete modal missing `affectedEvents` | ✅ |
| Q-31 | MEDIUM | `EventTypesManager.js:284` | `"undefined"` as section header | ✅ already fixed |
| Q-32 | MEDIUM | `DriversManager.js:939` | Discord ID edit not gated | ✅ already gated |
| Q-33 | MEDIUM | `pilotes/[id]/page.js:39` | Garage61 SSR fetch no timeout | ✅ already has AbortSignal.timeout |
| Q-34 | MEDIUM | `pilotes/[id]/modifier/page.js` | Auth race | ✅ safe |
| Q-35 | MEDIUM | `championnats/[id]/modifier/page.js:192` | Same auth race | ✅ safe |
| Q-36 | MEDIUM | `nouveau-round/page.js:303` | TOCTOU on `round_number` | ✅ DB unique index |
| Q-37 | MEDIUM | `nouveau-round/page.js:233` | Invalid start time accepted | ✅ already has isValidTime() |
| Q-38 | MEDIUM | `update-password/page.js`, `change-password/page.js` | setTimeout no cleanup | ✅ |
| Q-39 | MEDIUM | `InventoryMatrix.js:204` | `iracingTracksFreeRes.error` unchecked | ✅ already checked |
| Q-40 | MEDIUM | `EventTabs.js:205` | Fragile translation string-slicing | ✅ |
| Q-41 | MEDIUM | `ActualEndInput.js:23` | Timezone bug in pre-fill | ✅ |
| Q-42 | MEDIUM | `DeleteEventButton.js:67` | No error feedback | ✅ already implemented |
| Q-43 | MEDIUM | `evenements/nouveau/page.js:32` | `generateLabel` hardcodes French | ✅ already passes locale |
| Q-44 | MEDIUM | `notify-admins/route.js` | Env var name mismatch | ✅ false positive |
| Q-45 | LOW | `StintGrid.js:1437` | Strategy-switch missing `teamEntryId` dep | ✅ |
| Q-46 | LOW | `RaceMode.js:499,534` | Stale `t()` in handleIracingEvent | ✅ |
| Q-47 | LOW | `PlanningTab.js:73` | Realtime missing `channelSuffix` dep | ✅ |
| Q-48 | LOW | `EventPageTabs.js:166` | Tab-restoration missing `isExternal` dep | ✅ |
| Q-49 | LOW | `PlanningTab.js:75` | Variable shadowing `t` as updater param | ✅ |
| Q-50 | LOW | `InventoryMatrix.js:277` | Variable shadowing `t` as map param | ✅ |
| Q-51 | LOW | `CircuitsManager.js` | Hardcoded French errors | ✅ |
| Q-52 | LOW | `ClassesManager.js` | Hardcoded French errors | ✅ |
| Q-53 | LOW | `CrewNamesManager.js` | Hardcoded French errors | ✅ |
| Q-54 | LOW | `EventTypesManager.js` | Hardcoded French errors | ✅ |
| Q-55 | LOW | `SettingsManager.js` | Hardcoded French errors | ✅ |
| Q-56 | LOW | `PerformanceData.js:1043` | `t("colLapTime")` as count noun | ✅ |
| Q-57 | LOW | `SettingsManager.js:278` | Edit path missing minutes range check | ✅ added `m < 0 || m > 59` guard |
| Q-58 | LOW | `SettingsManager.js:239` | `parseInt` fallback hides invalid input | ✅ removed `|| 0` fallback; explicit isNaN check |
| Q-59 | LOW | `CrewNamesManager.js:207` | Archived events in delete warning | ✅ filters `te.events?.archived` |
| Q-60 | LOW | `equipages/[entryId]/page.js:104` | Extra arg to `formatTimeInZone` | ✅ removed spurious third arg |
| Q-61 | LOW | `pilotes/[id]/page.js:179` | Unreachable `\|\| 0` fallback | ✅ replaced with explicit ternary + `.getTime()` |
| Q-62 | LOW | `callback/iracing/route.js:360` | Redundant `!existing` check | ✅ kept — useful short-circuit to avoid extra DB query |
| Q-63 | LOW | `ClassesManager.js:128` | Stale keys in `refuelRates` on delete | ✅ `delete next[id]` added in handleDelete |
| Q-64 | LOW | `championnats/nouveau/page.js`, `modifier/page.js` | Redundant `router.refresh()` after push | ❌ harmless — keeps router cache hot; deferred |
| Q-65 | LOW | `admin/page.js:189` | Dead props passed to `AdminTabs` | ✅ removed dead props + dead DB queries + dead computation |
| Q-66 | LOW | `EventPageTabs.js:504` | `filterIrMax` passes null-iRating drivers | ✅ null-iRating now excluded from max filter |
| Q-67 | LOW | `register/page.js:149` | Password input missing `required` | ✅ added |
| Q-68 | LOW | `login/page.js:157` | `<Suspense>` missing `fallback` | ✅ `fallback={null}` added |
| Q-69 | LOW | `InventoryDemo.tsx` | Local re-impl of KBadge/FreeBadge | ✅ imports from `InventoryBadges.js` |
| Q-70 | LOW | `AdminEventTypesDemo.tsx:66` | Hardcoded French string | ✅ `eventTypesNoRestriction` key added to both locales |
| Q-71 | LOW | `ProfilDemo.tsx` | Missing Profil and Inventaire tabs | ✅ false positive — real `DriverPageTabs.js` also has only 2 tabs |
| Q-72 | LOW | `CourseDemo.tsx:47` | Fragile `split("—")` | ✅ replaced with `t("stintNumber", { number })` (new key in both locales) |
| Q-73 | LOW | `AdminAccueilDemo.tsx:46` | Manual `#` replacement in translation | ✅ ICU plural key `pendingWarning` with `{count}` — updated fr/en.json + page.js + demo |

---

## Minor / Lower Priority

| ID | Issue | Status |
|----|-------|--------|
| MINOR-1 | `garage61.js:69` — 401 retry drops request options | ✅ |
| MINOR-2 | `RaceMode.js:822` — `markPitStop` uses flat refuel time | ✅ accepted — intentional approximation |
| MINOR-3 | `RaceMode.js:410` — magic numbers in `fetchLiveFuel` | ✅ extracted as named constants |
| MINOR-4 | `RaceMode.js:868` — `undoLastPit` stale fallback | ✅ |
| MINOR-5 | `supabase-browser.js:17` — module-level singleton | ✅ accepted |
| MINOR-6 | `StintGrid.js:1529` — `JSON.stringify` in dep array | ✅ accepted |
| MINOR-7 | `garage61-laps/route.js` — `driver_slug` not validated | ✅ |

---

## Dead Code

| Item | Status |
|------|--------|
| `lib/supabase.js` | ✅ deleted |
| `lib/manufacturers.js` | ✅ deleted |
| `lib/auth.js → isSuperAdmin` | ✅ deleted |
| `lib/timezone.js → getTZAbbr` | ✅ deleted |
| `lib/supabase-browser.js → createBrowser` export | ✅ unexported |
| `lib/garage61.js → tryRefreshToken` export | ✅ unexported |

---

## i18n (Section 5 — 333 candidates)

Not yet addressed. Run `node audit_i18n_ast.js` to get current candidate list.
