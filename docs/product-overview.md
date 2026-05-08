# Product Overview

OpenSlot is an MVP scheduling product for hosts who want a public booking page and guests who need to book an available time.

## Current Product Capabilities

- Public landing page at `/`.
- Email/password authentication through Supabase.
- Onboarding setup that persists public profile basics, initial weekly availability, and a first active event type.
- Profile settings with public username and default timezone.
- Public host profile page at `/<username>`.
- Public event booking page at `/<username>/<eventSlug>`.
- Guest slot selection with timezone display.
- Five-minute slot holds before confirmation.
- Confirmed bookings with database-level anti-double-booking.
- Idempotent booking confirmation, cancellation, and rescheduling retries when clients provide an idempotency key.
- Public cancellation links for guests to review booking details and cancel with an optional reason.
- Public rescheduling links for guests to choose a replacement slot.
- Host bookings page with upcoming, past, and cancelled groupings.
- Host availability editor for weekly rules and date overrides.
- Host settings persistence for profile basics, display preferences, notification preferences, password update, and account deletion.
- Server-only calendar connection storage with safe settings/API summaries.
- Tenant webhook endpoint management, signed deliveries, and retry processing.
- Console-based booking lifecycle email notifications.

## Important Implementation Boundaries

These areas have important implementation notes:

| Area | Current state |
| --- | --- |
| `/onboarding` | Persists profile name/username/timezone, replaces initial weekly availability rules, and creates or updates the first active event type. |
| Email delivery | Console provider only by default; no production email provider is configured. |
| Calendar integrations | Provider connection/watch/cache tables and safe summaries exist; OAuth callbacks and provider API synchronization are not implemented yet. |

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
5. Guest submits booking form to `/api/bookings`.
6. Booking is inserted with status `confirmed`; outbox processing logs/sends emails and queues tenant webhook deliveries.
7. Guest can use `/booking/cancel/[token]` from the confirmation email or success screen to cancel the booking.
8. Guest can use `/booking/reschedule/[token]` to select a new slot; the old booking is marked `rescheduled` and a new confirmed booking is created.

### Host Booking Management

1. Host opens `/bookings`.
2. Server page fetches host bookings from Supabase.
3. Client view categorizes bookings locally.
4. Host can cancel upcoming bookings through `/api/bookings/[id]/cancel`.

## Related Docs

- [Architecture](architecture.md)
- [Development](development.md)
- [Security](security.md)
