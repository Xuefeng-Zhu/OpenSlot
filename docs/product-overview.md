# Product Overview

OpenSlot is an MVP scheduling product for hosts who want a public booking page and guests who need to book an available time.

## Current Product Capabilities

- Public landing page at `/`.
- Email/password authentication through Supabase.
- Onboarding setup that persists public profile basics, initial weekly availability, and a first active event type.
- Profile settings with public username and default timezone.
- Public host profile page at `/<username>`.
- Public event booking page at `/<username>/<eventSlug>`.
- Event-type-level invitee questions with required/optional text, dropdown, and checkbox answers.
- Guest slot selection with timezone display and connected-calendar conflict checks.
- Five-minute slot holds before confirmation.
- Confirmed bookings with database-level anti-double-booking.
- Idempotent booking confirmation, cancellation, and rescheduling retries when clients provide an idempotency key.
- Public cancellation links for guests to review booking details and cancel with an optional reason.
- Public rescheduling links for guests to choose a replacement slot.
- Host bookings page with upcoming, past, and cancelled groupings.
- Host contacts page with repeat-guest recognition, meeting history, search, and soft anonymization.
- Host availability editor for weekly rules and date overrides.
- Event type reminder controls for one configurable pre-meeting email reminder to guests and/or hosts.
- Host settings persistence for profile basics, display preferences, notification preferences, password update, and account deletion.
- Google/Microsoft calendar OAuth, provider calendar sync, busy-cache refresh, and safe settings/API summaries.
- Generated Google Meet and Microsoft Teams links for event types configured with a video provider.
- Tenant webhook endpoint dashboard management, signed deliveries, and retry processing.
- Console-based booking lifecycle and reminder email notifications by default, with Resend or Maileroo available when configured.

## Important Implementation Boundaries

These areas have important implementation notes:

| Area | Current state |
| --- | --- |
| `/onboarding` | Persists profile name/username/timezone, replaces initial weekly availability rules, and creates or updates the first active event type. |
| Email delivery | Console provider by default; `EMAIL_PROVIDER=resend` enables production sends through Resend, and `EMAIL_PROVIDER=maileroo` enables sends through Maileroo. |
| Reminders | Event types can schedule one pre-meeting reminder through the outbox worker. Cancelled/rescheduled bookings are rechecked and skipped before email send. |
| Calendar integrations | OAuth, provider metadata sync, busy-cache refresh, provider availability conflict checks, and provider event writes exist. Provider watch/subscription renewal and callback handlers are not implemented yet. |
| Video links | Google Meet and Microsoft Teams links are generated asynchronously by the calendar outbox worker after booking confirmation. Bookings remain confirmed if provider setup or provider calls fail, and the failure is surfaced for retry/repair. |
| Provider availability | Synced `external_busy_cache` rows are consumed by public slot computation for calendars marked `use_for_availability`. |

Keep these boundaries explicit when adding user-facing docs or release notes.

## Primary User Flows

### Host Setup

1. User signs up or logs in.
2. Supabase trigger creates a profile shell.
3. User completes `/onboarding`, which saves profile, availability, and an initial event type.
4. User can later update profile at `/profile` and availability at `/availability`.
5. Event type dashboard management reads and writes Supabase event types; public pages read active event types from Supabase.

### Guest Booking

1. Guest opens `/<username>`.
2. Guest selects an active event type.
3. `SlotPicker` fetches slots from `/api/slots`.
4. Guest clicks a slot, creating a hold through `/api/holds`.
5. Guest submits booking form and any configured structured answers to `/api/bookings`.
6. Booking is inserted with status `confirmed`; structured answers are snapshotted separately from notes, and generated video locations start as pending until the calendar outbox worker stores the join link.
7. Outbox processing creates provider calendar events, stores generated Meet/Teams links, sends emails after required links are ready, schedules configured reminders, and queues tenant webhook deliveries.
8. Guest can use `/booking/cancel/[token]` from the confirmation email or success screen to cancel the booking.
9. Guest can use `/booking/reschedule/[token]` to select a new slot; the old booking is marked `rescheduled` and a new confirmed booking is created.

### Host Booking Management

1. Host opens `/bookings`.
2. Server page fetches host bookings from Supabase.
3. Client view categorizes bookings locally.
4. Host can open booking details to review notes and structured answer summaries.
5. Host can cancel upcoming bookings through `/api/bookings/[id]/cancel`.

### Host Contact Management

1. Host opens `/contacts`.
2. Server page fetches host contacts and bookings from Supabase.
3. Client view searches contacts by name, email, timezone, and event type.
4. Host opens a contact profile to review confirmed, cancelled, and rescheduled booking history.
5. Host can anonymize a contact through `/api/contacts/[id]`, which scrubs matching booking guest display data while preserving meeting records.

## Related Docs

- [Architecture](architecture.md)
- [Development](development.md)
- [Security](security.md)
