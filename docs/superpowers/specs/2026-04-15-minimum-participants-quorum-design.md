# Minimum Participants (Quorum) — Design

**Status:** Approved, ready for implementation plan
**Date:** 2026-04-15

## Goal

Let instructors set a minimum number of participants per activity. If a session doesn't reach that minimum by 24h before it starts, the system prompts the instructor to confirm; if they don't confirm within 2 hours, the session is cancelled and all bookers are refunded in full.

## Principles

- **Opt-in.** `min_participants = 0` means no minimum. Existing activities are unaffected until an instructor chooses to set a value.
- **Trustworthy for participants.** The auto-cancel promise is explicit in the UI ("confirmed 24h before — full refund if not met"). They should feel safe booking sparse-looking sessions.
- **Agency for instructors.** They can override and run a session anyway during a 2-hour window after at-risk notification. No silent auto-cancel without their awareness.
- **Honest UI.** Show progress when it's motivating ("only 2 more needed") or informative (✓ Confirmada). Hide it when it would discourage booking ("0/5" on a new session). The goal is transparency without self-fulfilling prophecy.
- **One source of truth per concern.** `cancel_session_with_refunds` is the single place that knows how to cancel a session. Both instructor "cancel now" and the cron's expiration call it.

## Data Model

### `activities`

```sql
ALTER TABLE activities
  ADD COLUMN min_participants INTEGER NOT NULL DEFAULT 0
    CHECK (min_participants >= 0);

ALTER TABLE activities
  ADD CONSTRAINT min_participants_lte_max_seats
    CHECK (min_participants <= max_seats);
```

Default 0 means "no minimum". A CHECK ensures min ≤ max at the DB level — the form validates too but the DB is the guarantee.

### `activity_sessions`

```sql
ALTER TABLE activity_sessions
  ADD COLUMN quorum_state TEXT NOT NULL DEFAULT 'pending'
    CHECK (quorum_state IN ('pending', 'confirmed', 'at_risk', 'cancelled'));

ALTER TABLE activity_sessions
  ADD COLUMN quorum_evaluated_at TIMESTAMPTZ;

ALTER TABLE activity_sessions
  ADD COLUMN instructor_confirmed_at TIMESTAMPTZ;
```

`quorum_state` is a small state machine owned by the session:

| State | Meaning |
|---|---|
| `pending` | Default. Either min not yet set (min=0), too early to evaluate, or bookings still growing. |
| `confirmed` | `booked_seats ≥ min_participants`. Set on booking (by `book_session`) or by instructor confirmation. Once set, stays set. |
| `at_risk` | Cron ran at T-24h, quorum not met, instructor notified, awaiting their decision. |
| `cancelled` | Either auto-cancelled after the 2h confirmation window expired, or instructor dismissed it. |

`instructor_confirmed_at` records the override. Set when the instructor explicitly says "run it anyway". Once set, session moves to `confirmed` permanently — even if a participant cancels later, we don't un-confirm.

This is **orthogonal** to the existing `activity_sessions.status` (`published | draft | cancelled | completed`). When quorum auto-cancel fires, we flip BOTH `quorum_state = 'cancelled'` AND `status = 'cancelled'` so existing queries that filter on `status` keep working.

## Participant Flow

### Activity detail page

When `activity.min_participants > 0`, a single line appears above the "Agree to policy" checkbox in the booking sidebar:

> *Mínimo de 5 participantes — confirmada 24h antes da aula. Reembolso integral se não atingir.*

Translated across pt / en / es.

### Session picker time-slot cards

Each time-slot card already has a status line (for "Esgotado" / "Disponível" / "{N} vagas"). We extend it with quorum info, computed by a single helper:

```ts
// src/lib/quorum.ts
export type QuorumStatus =
  | { kind: 'none' }               // min=0, show nothing new
  | { kind: 'confirmed' }           // ✓ Confirmada (green)
  | { kind: 'close'; needed: number } // "Faltam N para confirmar" (primary-500)
  | { kind: 'silent' }              // booked far from min; fall back to existing status line
  | { kind: 'at_risk' };            // "Aguardando confirmação" (accent-600)

export function getQuorumStatus(
  min: number,
  booked: number,
  state: 'pending' | 'confirmed' | 'at_risk' | 'cancelled'
): QuorumStatus;
```

Thresholds:

| Condition | Badge |
|---|---|
| `min = 0` | `none` — nothing new shown |
| `state = 'confirmed'` OR `booked ≥ min` | `confirmed` — green ✓ Confirmada |
| `state = 'at_risk'` | `at_risk` — accent-600 "Aguardando confirmação" |
| `min - booked` is 1 or 2 | `close` — primary-500 "Faltam N para confirmar" |
| `min - booked` ≥ 3 | `silent` — fall back to existing Disponível / scarcity |
| `state = 'cancelled'` | existing "Esgotado"-equivalent path; not driven by this helper |

### Booking confirmation page

If the booked session is not yet `confirmed`, the confirmation page shows:

> *Aula confirmada 24h antes. Se o mínimo de 5 participantes não for atingido, sua reserva é cancelada e o reembolso acontece automaticamente.*

If already `confirmed`, no notice — normal confirmation UI.

### When quorum auto-cancels

The existing `booking_cancelled` notification type is reused, with a distinct body:

> *A sessão de "Aula de Culinária Italiana" em 24/abr foi cancelada porque não atingiu o mínimo de 5 participantes. Seu pagamento de R$ 180,00 foi reembolsado integralmente.*

Channel: in-app + email, via the existing `dispatchEmailsForUsers()` helper.

### `/bookings` (my bookings)

A quorum-cancelled booking shows the same "Cancelled" chip as any other cancelled booking. No new UI — the notification carries the reason, the list just shows cancelled + refund amount.

## Instructor Flow

### Activity create / edit form

A new optional field between "Máximo de participantes" and the cancellation policy section:

```
Mínimo de participantes (opcional)
[ 0 ]

A sessão é cancelada automaticamente 24h antes se não atingir este número.
Deixe em 0 para não definir um mínimo.
```

Number input, `min=0`, `max={activity.max_seats}`, default 0. Validated server-side and at the DB CHECK.

### At-risk notification

When a session hits T-24h below quorum, the cron inserts a new notification type `session_quorum_at_risk`:

> *A sessão de "Aula de Culinária Italiana" em 24/abr às 19:00 está abaixo do mínimo: 3/5 participantes. Você tem até 21:00 de hoje para confirmar que vai rodar mesmo assim. Caso contrário, será cancelada automaticamente e os participantes reembolsados.*
>
> `[ Confirmar — vou rodar ]`   `[ Cancelar agora ]`

Channel: in-app + email. Button deep-links go to `/instructor` with the session preselected.

### "Precisa de atenção" card on `/instructor`

A conditional card at the top of the instructor dashboard, above the activities list, surfaces sessions in `quorum_state = 'at_risk'`:

```
⚠ 1 sessão precisa de decisão
Aula de Culinária Italiana — 24/abr, 19:00 · 3/5 participantes
[ Confirmar — vou rodar ]   [ Cancelar ]
```

Not rendered when there's nothing at risk. Stacks when multiple sessions are at risk.

### Actions

- **`[ Confirmar — vou rodar ]`** → calls `confirm_session_quorum(session_id)` RPC. Sets `instructor_confirmed_at = now()`, `quorum_state = 'confirmed'`. Session proceeds normally. All booked participants get a `session_confirmed` notification (new type): *"Boa notícia! A sessão de 24/abr foi confirmada. Até lá!"* The same notification type is used by the auto-confirm-on-booking path — shared copy, shared template.

- **`[ Cancelar ]`** → calls `cancel_session_with_refunds(session_id, 'instructor_cancelled')`. Per-session analog of the existing `cancel_activity_with_refunds`.

### Activity row is not affected

If one session of a weekly class quorum-cancels, the activity stays `published` and other sessions proceed. Only `cancel_activity_with_refunds` flips the whole activity.

### Changing min_participants mid-flight

Allowed, but only affects evaluation going forward. A session already in `at_risk` or `confirmed` state is not re-evaluated. The simplest rule to reason about.

## Quorum Evaluation Mechanics

### Hourly cron endpoint

New route `/api/cron/hourly`, authenticated with the existing `CRON_SECRET` pattern. Runs two SQL functions in sequence, drains emails via `dispatchEmailsForUsers()`.

### Function 1: `evaluate_session_quorum()`

Catches `pending → at_risk` transitions.

```
For each session where:
  - activity.min_participants > 0
  - quorum_state = 'pending'
  - starts_at BETWEEN now() + 22h AND now() + 26h
      (the ±2h window around T-24h avoids missing sessions if a
       cron run is delayed; quorum_state guards against double-flipping)
  - (max_seats - seats_remaining) < min_participants

UPDATE activity_sessions
  SET quorum_state = 'at_risk',
      quorum_evaluated_at = now()

INSERT notification (type='session_quorum_at_risk', user_id=instructor)

RETURN set of instructor_user_ids for email dispatcher
```

### Function 2: `expire_at_risk_sessions()`

Catches `at_risk → cancelled` transitions.

```
For each session where:
  - quorum_state = 'at_risk'
  - quorum_evaluated_at + interval '2 hours' <= now()
  - instructor_confirmed_at IS NULL
      (belt-and-suspenders; the confirm RPC already flips state,
       but we check both in case of a race)

CALL cancel_session_with_refunds(session_id, 'quorum_not_met')

RETURN set of affected user_ids for email dispatcher
```

### Auto-confirm on booking — not in the cron

`book_session` RPC is amended: after applying a booking, if `(max_seats - seats_remaining) >= min_participants` and `quorum_state = 'pending'`, flip `quorum_state = 'confirmed'` in the same transaction, and insert `session_confirmed` notifications for every already-booked participant on this session (including the one who just tipped it over). Confirmation is instant — no waiting for the next cron run. Already-booked participants who booked on faith that quorum would be met deserve to know it was.

### Once confirmed, stays confirmed

If a session reaches `confirmed` and a participant then cancels dropping booked back below min, state stays `confirmed`. We promised the remaining participants the session would run; un-confirming would betray that. The instructor can still manually cancel via the existing UI if attendance drops catastrophically.

### Edge cases

- **Session starts in <22h when activity's min is first set.** The evaluate function's `22-26h` window skips it. Session stays `pending` forever and runs regardless of participant count. Instructor has the manual-cancel path if they want.
- **All sessions of an activity hit quorum auto-cancel.** Activity stays `published`; other/future sessions continue to be bookable.
- **Quorum met exactly at T-24h evaluation time.** `booked < min` filter excludes it; auto-confirm already fired.
- **Instructor clicks Confirm after the 2h window but before cron runs.** The confirm RPC guards with `WHERE instructor_confirmed_at IS NULL AND quorum_state = 'at_risk'`. If expire cron raced in first, confirm returns `already_cancelled` — instructor sees a toast. Rare enough that we don't need manual un-cancel.

## Cancel RPC & Refund Mechanics

### `cancel_session_with_refunds(p_session_id UUID, p_reason TEXT)`

Per-session analog of `cancel_activity_with_refunds`. Single place that knows how to cancel a session — called by instructor "Cancel now" and by the cron's expire function. Shared code path guarantees identical behavior regardless of trigger.

```
SECURITY DEFINER. Callable by:
  - instructor who owns the activity (RLS-equivalent check in function body)
  - admin client (cron)

Transaction:
  1. Guard: session exists, not already cancelled, starts in the future.
  2. UPDATE activity_sessions
       SET status = 'cancelled',
           quorum_state = 'cancelled',
           updated_at = now()
     WHERE id = p_session_id;
  3. FOR each non-cancelled booking on this session:
       UPDATE bookings
         SET status = 'cancelled',
             payment_status = 'refunded',
             refund_amount_cents = price_cents * seats,  -- always full
             cancelled_at = now();
       INSERT notifications (booking_cancelled, body varies by p_reason);
  4. RETURN count of affected bookings.
```

### `p_reason` values

- `'quorum_not_met'` — cron expire, or instructor dismisses an at-risk session.
- `'instructor_cancelled'` — manual instructor cancel outside the quorum flow.

Notification body branches on this: "não atingiu o mínimo" vs "cancelada pelo instrutor".

### Refund amount

Always 100%, regardless of the activity's cancellation policy. Cancellation policy (flexible / moderate / strict) covers participant-initiated cancellations; this is system-initiated and not the participant's fault. `refund_amount_cents = price_cents * seats` unconditionally.

### Mock vs. real Stripe

The RPC only records refund intent: `payment_status='refunded'`, `refund_amount_cents`. It does NOT call Stripe. This matches how `cancel_activity_with_refunds` already works. The real Stripe refund API call is a separate future worker that scans `bookings WHERE payment_status='refunded' AND stripe_refund_id IS NULL`.

## Out of Scope (YAGNI)

- Per-session minimum override (activity-level only).
- Configurable cutoff window (24h fixed; configurable later if data warrants).
- Waitlist for cancelled sessions.
- Partial-quorum flexibility (no "ask instructor at 80% of min" middle ground).
- Retroactive application to existing bookings (feature is opt-in per activity).
- Real Stripe refund API call (separate worker, separate feature).

## Testing

### DB layer

pgTAP-style unit tests for each new RPC:

- `confirm_session_quorum` — sets timestamps, flips state, inserts participant notifications, rejects non-at-risk sessions.
- `cancel_session_with_refunds` — flips session, flips all bookings, stamps refund amount = full, inserts cancellation notifications, varies body by reason.
- `evaluate_session_quorum` — flips only pending sessions in the 22-26h window below quorum, inserts instructor notifications.
- `expire_at_risk_sessions` — cancels only at-risk sessions past the 2h window with no instructor confirmation.

### Integration

One happy-path test: seed activity with min=5 and 3 bookings, session starting 23h from now. Run `evaluate_session_quorum` → assert `at_risk` + notification inserted. Advance simulated clock 2h. Run `expire_at_risk_sessions` → assert all bookings cancelled with full refund and `booking_cancelled` notifications inserted.

### UI

Component tests on the `getQuorumStatus` helper covering the 5 return shapes. No browser-level end-to-end tests — UI surface is small and logic is mostly in SQL.

## Rollout

1. Ship migrations (columns, constraints, RPCs). Backward-compatible via defaults.
2. Ship instructor form field + quorum UI on activity detail page. Invisible until someone sets min > 0.
3. Ship the hourly cron route. No-op when nothing has min set.
4. No feature flag needed — opt-in default handles rollout implicitly.
