# oneday

A three-sided marketplace (students / instructors / admins) for booking one-day hobby classes. Built with Next.js 14 App Router, Supabase (Postgres + Auth + Storage + RLS), Stripe Connect, and Resend.

## Quick start

Prereqs: Node 20+, Docker (for local Supabase), and the Supabase CLI.

```bash
cd hobby-marketplace
npm install

# Start local Supabase (Postgres + Auth + Storage on Docker)
npx supabase start

# Apply migrations and seed demo data
npx supabase db reset

# Copy env and fill in the values printed by `supabase start`
cp .env.example .env.local
# Set NEXT_PUBLIC_SUPABASE_URL and keys from `supabase status`

npm run dev
```

App boots at http://localhost:3000. Locale is inferred; `/pt`, `/en`, `/es` all work.

## Seed accounts

`supabase/seed.sql` creates demo users and activities. All passwords are `password123`.

| Role                        | Email                   |
| --------------------------- | ----------------------- |
| Student                     | `ana@example.com`       |
| Student                     | `carlos@example.com`    |
| Approved instructor         | `mariana@example.com`   |
| Approved instructor         | `rafael@example.com`    |
| Approved instructor         | `julia@example.com`     |
| Approved instructor         | `bruno@example.com`     |
| Pending instructor applicant| `beatriz@example.com`   |
| Admin                       | `admin@example.com`     |

## Environment variables

See `.env.example`. The essentials:

| Variable                          | Purpose                                           |
| --------------------------------- | ------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`        | Supabase project URL                              |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | Public anon key (RLS enforced)                    |
| `SUPABASE_SERVICE_ROLE_KEY`       | Server-only; bypasses RLS for admin writes        |
| `STRIPE_SECRET_KEY`               | Stripe Connect Checkout + refunds (optional)      |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Client-side Stripe (optional)                  |
| `STRIPE_WEBHOOK_SECRET`           | Signature secret for `/api/stripe/webhook`         |
| `RESEND_API_KEY`                  | Notification emails (optional; logs to console if absent) |
| `NEXT_PUBLIC_APP_URL`             | Used in emails and Stripe redirect URLs           |
| `CRON_SECRET`                     | Bearer token for `/api/cron/daily`                |

Stripe and Resend are both optional for local dev. Without `STRIPE_SECRET_KEY`, checkout falls back to a mocked confirmation flow. Without `RESEND_API_KEY`, notification emails are logged to the server console instead of delivered.

## Architecture

### Routing

```
src/app/[locale]/
├── (public)              home, activities, categories, instructors
├── bookings, favorites, settings    student-side
├── instructor/           instructor dashboard (apply, activities CRUD, bookings, payouts)
└── admin/                admin dashboard (applications, users, activities, audit)
```

All user-facing routes are wrapped in `[locale]` with `next-intl` middleware. Locale-aware links go through `@/i18n/navigation`.

### Data access

- **Read path**: `src/lib/queries/*` — server-only helpers that run under RLS with the user's session.
- **Write path**: `src/lib/actions/*` — Next server actions. Most write with the session client; admin operations and cross-user writes use the service-role client (`src/lib/supabase/admin.ts`) after an `assertAdmin()` check.
- **Atomic multi-row ops**: SECURITY DEFINER SQL functions (`book_activity`, `book_activity_from_webhook`, `cancel_activity_with_refunds`, `admin_cancel_activity_with_refunds`).
- **Instructors are also users**: approved instructors can book, favorite, and review other instructors' activities. Self-booking is blocked at the SQL RPC, the server action, and the UI. The user menu shows a "switch to instructor dashboard" link for approved instructors.

### Pure modules

Validation, refund math, commission math, and rate limiting live in `src/lib/*.ts` as pure functions with no server-only imports — so they stay in the client bundle when imported from client components and are trivially unit-testable.

- `activity-validation.ts` — input validation + publish/delete/cancel/self-booking guards
- `refund-policy.ts` — flexible / moderate / strict refund tiers
- `commission.ts` — application fee for Stripe Connect transfers
- `instructor-earnings.ts` — earnings breakdown (upcoming / this-month / all-time) net of commission and refunds
- `rate-limit.ts` — fixed-window in-memory limiter
- `stripe-config.ts` — checkout line item builder
- `stripe-webhook.ts` — pure parser for `checkout.session.completed` events
- `pagination.ts` — page number windowing with ellipsis gaps
- `booking-calendar.ts` — month grid generation + booking-per-day grouping
- `saved-search-validation.ts` — name + filters shape validation for saved searches

### Notifications

Postgres triggers (migration `00006`) fan out `notifications` rows on booking insert/cancel and instructor approval changes. A scheduled job (`/api/cron/daily`) queues follow-ups (reminders, review prompts, saved search matches) and invokes `dispatchEmailsForUsers` which renders a branded React Email template and hands it to Resend. `notification_email_sent_at` prevents double sends.

### Saved searches

Users can save a set of filters (category, neighborhood, price range, search text) from the `/activities` page. The daily cron runs `queue_saved_search_matches`, which finds activities published since the last check that match each saved search's filters and inserts `saved_search_matched` notifications. Management UI at `/settings/saved-searches` lists saved searches with filter chips and delete buttons. Max 10 per user.

### Discovery views

The `/activities` browse page offers three views via a Lista/Mapa/Calendário toggle (URL param `?view=`):

- **List** (default) — paginated card grid, 12 per page
- **Map** — Leaflet/OpenStreetMap with pins at each activity's coordinates. Clicking a pin shows a popup with cover image, title (linked), instructor, date, and price. Dynamically imported (`ssr: false`) to avoid Leaflet's window dependency.
- **Calendar** — month grid with activity count badges per day. Clicking a day filters the list to that date. Month navigation via `?calMonth=YYYY-MM`.

All three views share the same filter bar (category, neighborhood, price range, date range, search) and the same `fetchActivities` call. Map and calendar modes fetch up to 200 results without pagination.

### Notification preferences

Users toggle per-type email notifications at `/settings/notifications`. The `notification_preferences` table stores `(user_id, notification_type, email_enabled)` with upsert on toggle. The email dispatcher (`dispatch-emails.ts`) reads these and skips opted-out types. In-app notifications are always delivered regardless.

### Search

Migration `00017` adds a `search_vector` generated tsvector column across all three locale titles + descriptions + neighborhood + city, with `unaccent` for accent-insensitive matching and Portuguese stemming. A `search_activities_rank` RPC returns `(id, rank)` pairs using `ts_rank` with A/B/C weights (title > description > location). The activities page defaults to relevance sort when a search term is present and falls back to rating sort otherwise. Pagination controls appear below the grid when results exceed 12 per page.

### Stripe Connect

Instructors onboard via `startInstructorOnboardingAction` (Express accounts). Checkout uses `transfer_data.destination` + `application_fee_amount` so the platform collects commission on every booking. Refunds issued during cancellation pass `reverse_transfer: true` and `refund_application_fee: true` so the connected account is debited too.

## Migrations

Applied in order by `supabase db reset`.

| #     | Summary                                                          |
| ----- | ---------------------------------------------------------------- |
| 00001 | Initial schema: users, activities, bookings, reviews, favorites  |
| 00002 | RLS: booked users can read otherwise-hidden activity details     |
| 00003 | `book_activity` SECURITY DEFINER function                        |
| 00004 | Instructor side: rejection_reason, activity-images bucket, DELETE policy |
| 00005 | `cancel_activity_with_refunds` RPC                               |
| 00006 | Notification fanout triggers                                     |
| 00007 | `notifications.email_sent_at` for dedup                          |
| 00008 | `bookings.stripe_session_id`                                     |
| 00009 | Scheduled jobs: auto-complete, reminders, review prompts         |
| 00010 | `admin_cancel_activity_with_refunds` RPC                         |
| 00011 | `review-photos` storage bucket + RLS                             |
| 00012 | `id-documents` storage bucket + instructor-only RLS              |
| 00013 | `cancellation_refund_amount` column on bookings                  |
| 00014 | `admin_actions` audit log table                                  |
| 00015 | `book_activity_from_webhook` service-role RPC                    |
| 00016 | Self-booking guard in both `book_activity` RPCs                  |
| 00017 | `search_vector` tsvector column + `unaccent` + `search_activities_rank` RPC |
| 00018 | `saved_searches` table + `queue_saved_search_matches` RPC        |

After editing `supabase/seed.sql` or any migration, re-run `npx supabase db reset` — it's destructive but idempotent.

## Dev-only endpoints

- `GET /api/dev/email-preview?type=booking_confirmed` — renders a notification email template in the browser. Types: `booking_confirmed`, `booking_cancelled`, `activity_reminder`, `review_prompt`, `instructor_approved`, `instructor_rejected`, `payout_received`, `booking_new`, `activity_auto_completed`, `activity_force_cancelled`.
- `GET /api/cron/daily` (Authorization: `Bearer $CRON_SECRET`) — runs auto-complete, queues reminders, queues review prompts, dispatches pending emails. Wire this to Vercel Cron / GitHub Actions / etc. on a daily schedule.
- `POST /api/stripe/webhook` — Stripe Checkout webhook. Verifies `stripe-signature` against `STRIPE_WEBHOOK_SECRET`, then materializes a booking via `book_activity_from_webhook` (idempotent, refunds on seat race loss). Locally: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

## Testing

```bash
npm test           # jest, ~220 tests
npm run test:watch # interactive
```

Tests live under `__tests__/` and mirror `src/`. They cover the pure modules (validation, refund math, commission, earnings, rate limit, Stripe config, webhook parser, pagination, search normalization, booking calendar) and the query helpers. Integration tests in `__tests__/integration/` hit the local Supabase instance directly — `booking-rpc` tests the webhook booking path (create, idempotent retry, self-booking guard, seats exhaustion) and `cancel-activity-rpc` tests both instructor and admin cancellation flows (state transitions, notifications, auth rejection). The shared helpers (`authenticatedClient`, `seedActivity`, `cleanup`) make it easy to add more.

### TDD discipline

New pure helpers and bug fixes get a failing test first. The test lives in `__tests__/lib/*` and runs under `jest-environment-jsdom` (see `__tests__/setup.ts` for the TextEncoder polyfill). Red → green → refactor.

## Deployment

The app is a standard Next 14 application and deploys cleanly to Vercel:

1. Provision a Supabase project. Run `supabase db push` to apply migrations, then upload `supabase/seed.sql` if you want the demo data.
2. Create the three storage buckets referenced by the migrations (`activity-images`, `review-photos`, `id-documents`). The migrations create them, but verify RLS is active.
3. Set all env vars from `.env.example` in the Vercel project.
4. Add a Vercel Cron entry (or equivalent) that hits `/api/cron/daily` once per day with the `Authorization: Bearer $CRON_SECRET` header.
5. Configure a Stripe Connect platform account; set the webhook endpoint to `https://yourdomain.com/api/stripe/webhook` in the Stripe dashboard and copy the signing secret to `STRIPE_WEBHOOK_SECRET`.
6. Verify your Resend domain so email delivery works; otherwise emails will silently fall back to console logging.

## Troubleshooting

| Symptom                                          | Fix                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------- |
| `Cannot find module 'react-dom/server'` in build | Keep the `eval('require')('react-dom/server')` shim in `src/lib/email-templates/render.ts` — it dodges Next's static bundler. |
| Tests error on `TextEncoder is not defined`      | `__tests__/setup.ts` polyfills from `node:util`. Rerun.             |
| Pending-instructor redirect loop                 | Route-group guards live inside each dashboard page, not a shared `layout.tsx`. Don't move them. |
| `booking_status` enum errors                     | The enum only has `confirmed` / `cancelled` / `completed`. Never `pending`. |
| Admin action silently no-ops                     | Confirm the user row has `role = 'admin'` and is signed in. `assertAdmin()` returns the admin id for the audit log. |

## i18n

Three locales: `pt` (default), `en`, `es`. Messages live in `src/messages/*.json`. Always add keys to all three files; `next-intl` throws at runtime on missing keys in strict mode. Date/number formatting goes through `formatDate` / `formatCurrency` in `src/lib/utils.ts` so locales stay consistent.

## Project history

This codebase was built in phases:

1. **Foundation** — routing, auth, types, design system
2. **Public pages** — home, activity listing, instructor profiles, category browse
3. **User account** — bookings, favorites, settings
4. **Booking flow** — mocked checkout + review submission
5. **Instructor side** — apply, CRUD activities, manage bookings
6. **Polish & ops** — notifications, emails, scheduled jobs, admin dashboard, Stripe Connect, cancellation policy, map picker, audit log, docs
7. **Search & UX** — tsvector search with relevance ranking, pagination, earnings summary, instructors-as-users, photo lightbox, carousel, booking calendar, saved searches with cron matching, SEO metadata, integration tests, notification preferences, map + calendar discovery views

See `docs/superpowers/specs/` for the original design specs and `git log` for the commit-by-commit breakdown.
