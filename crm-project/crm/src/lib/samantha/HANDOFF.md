# Samantha / CRM Control-Tower Handoff

## What was built

We built the first real shared Samantha decision layer inside the CRM so calls and texts stop making independent choices.

## New shared Samantha brain files

Located in:

`src/lib/samantha/`

Files created:
- `contactGovernor.ts`
- `contactGovernor.test.ts`
- `applyGovernorDecision.ts`
- `markMeaningfulEngagement.ts`

## What each file does

### `contactGovernor.ts`
This is the main Samantha decision brain. It decides:
- call now
- text now
- wait
- none

It also calculates:
- heat status (`hot`, `warm`, `cold`)
- next contact time
- escalation flag
- reason codes for why it made the decision

It includes logic for:
- quiet hours / contact hours
- hot / warm / cold timing
- call caps
- text caps
- hot day-1 text handling
- cold nurture timing
- manual pause / override
- appointment stop
- do-not-contact stop
- re-engagement bump back to hot

### `contactGovernor.test.ts`
This is the test harness used to validate common scenarios like:
- new hot lead
- warm text-first lead
- cold lead not due
- re-engaged lead
- do-not-contact
- appointment already set
- manual pause
- hot lead with text fallback after call cap

### `applyGovernorDecision.ts`
This is the shared writeback helper. It updates:
- `lead_heat`
- `next_contact_at`
- `updated_at`
- `hot_until` when needed

It also logs escalations to:
- `escalation_logs`

### `markMeaningfulEngagement.ts`
This is the shared helper for marking real engagement events. It updates:
- `last_meaningful_engagement_at`
- `lead_heat = hot`
- `hot_until`
- `next_contact_at = null`
- best contact channel / hour / daypart
- channel-specific fields like:
  - `last_answered_call_at`
  - `last_replied_text_at`
  - `last_idx_activity_at`

---

## Routes and files now connected to the Samantha brain

### Governor decisioning is directly used in:
- `app/api/follow-up/route.ts`
- `app/api/start-call/route.ts`
- `_integrations/twilio/twilio/outbound/outbound-call/route.ts`
- `lib/sendText.ts`

### Governor writeback helper is directly used in:
- `app/api/follow-up/route.ts`
- `app/api/start-call/route.ts`
- `_integrations/twilio/twilio/outbound/outbound-call/route.ts`

### Meaningful engagement is already being captured in active routes
These are currently handling meaningful engagement updates directly and are good enough to leave for now:
- `app/api/incoming/route.ts`
- `_integrations/twilio/twilio/core/call-status/route.ts`
- `_integrations/twilio/twilio/inbound/sms/route.ts`

### Appointment routes were updated to keep lead state aligned
- `app/api/calendar/book/route.ts`
- `app/api/calendar/reschedule/route.ts`
- `app/api/calendar/cancel/route.ts`

These now update:
- `lead_heat`
- `last_meaningful_engagement_at`
- `next_contact_at`
- `hot_until`

---

## Supabase schema changes made

### Added to `leads`
- `last_meaningful_engagement_at timestamptz`
- `next_contact_at timestamptz`
- `texts_today_date date`

### Added to `follow_ups`
- `lead_id uuid`
- `created_at timestamptz default now()`

### Foreign key added
- `follow_ups.lead_id -> leads.id`

---

## Current state of important files

### Good and leave as-is for now
- `app/api/incoming/route.ts`
- `_integrations/twilio/twilio/core/call-status/route.ts`
- `_integrations/twilio/twilio/inbound/sms/route.ts`

These already do enough and should not be churned unless there is a specific reason.

### Governed and working
- `app/api/follow-up/route.ts`
- `app/api/start-call/route.ts`
- `_integrations/twilio/twilio/outbound/outbound-call/route.ts`
- `lib/sendText.ts`

These now compile and are using the new Samantha brain path.

---

## What was validated

Multiple `npx tsc --noEmit` runs completed clean after the changes.

The governor test harness also ran successfully and confirmed:
- hot leads call first
- hot leads fall back to text when call is blocked
- warm leads text first
- re-engaged leads return to hot
- stop conditions like appointment / DNC / manual pause behave correctly

---

## Important note about duplicate logic

The old duplicate file:

- `lib/followUpRules.ts`

was removed after confirming nothing live was importing it.

The remaining duplicate text-brain helpers inside `lib/sendText.ts` were also removed after confirming:
- TypeScript still compiled clean
- no remaining references to:
  - `getLeadHeat`
  - `canAttemptText`
  - `computeNextContactAt`
  - `resetTextCounter`
  - `isWithinAllowedHours`

`src/lib/samantha/contactGovernor.ts` is now the intended source of truth.

---

## What still remains

### 1) Centralize meaningful engagement updates further
Right now some routes still manually patch:
- `lead_heat`
- `hot_until`
- `last_meaningful_engagement_at`
- `next_contact_at`

They work, but they are still somewhat duplicated.

### 2) Add IDX-trigger logic
Still not built:
- trigger follow-up based on saved properties / views / sessions
- reheat logic from IDX activity
- org-configurable IDX thresholds

### 3) Best-contact-time learning is only partially present
You already store:
- `best_contact_hour`
- `best_contact_daypart`
- `best_contact_channel`
- `contact_pattern_confidence`

But there is not yet a real learning engine that uses them to rotate or optimize contact times.

### 4) More shared writeback standardization
The core outbound decision routes are governed now, but more routes can still be standardized over time.

### 5) Dashboard / UI visibility
The CRM UI may still need better display for:
- `next_contact_at`
- `lead_heat`
- escalation status
- reason trail / AI context
- meaningful engagement fields

---

## Short version

### Done
- built main Samantha governor
- built test harness
- built shared governor writeback helper
- built shared meaningful engagement helper
- wired governor into main SMS/call routes
- wired route writeback into shared helper
- updated appointment routes
- added required DB columns
- removed duplicate old follow-up logic
- removed duplicate old text helper logic
- all changes compile clean

### Not done
- centralize remaining manual meaningful-engagement patches
- build IDX-trigger engine
- build true best-contact-time learning
- finish full shared writeback cleanup everywhere
- improve UI visibility of Samantha state

---

## Main source of truth now

Use this as the Samantha brain:

`src/lib/samantha/contactGovernor.ts`

Not:
- scattered route-specific heat logic
- old one-off follow-up calculations

---

## Last known good checkpoints

The following all compiled clean with:

`npx tsc --noEmit`

Key files changed:
- `src/lib/samantha/applyGovernorDecision.ts`
- `src/lib/samantha/contactGovernor.ts`
- `src/lib/samantha/contactGovernor.test.ts`
- `src/lib/samantha/markMeaningfulEngagement.ts`
- `app/api/follow-up/route.ts`
- `app/api/start-call/route.ts`
- `app/api/incoming/route.ts`
- `app/api/calendar/book/route.ts`
- `app/api/calendar/reschedule/route.ts`
- `app/api/calendar/cancel/route.ts`
- `lib/sendText.ts`
- `_integrations/twilio/twilio/core/call-status/route.ts`
- `_integrations/twilio/twilio/inbound/sms/route.ts`
- `_integrations/twilio/twilio/outbound/outbound-call/route.ts`

---

## Best next move

Next recommended build order:
1. centralize remaining meaningful engagement updates into shared helper usage
2. build IDX trigger engine
3. build best-contact-time learning logic
4. improve dashboard visibility of Samantha control-tower state