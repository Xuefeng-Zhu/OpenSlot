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
- Host bookings page with upcoming, past, and cancelled groupings.
- Host availability editor for weekly rules and date overrides.
- Console-based booking and cancellation email notifications.

## Important Implementation Boundaries

These areas are visible in the UI but are not fully production-backed yet:

| Area | Current state |
| --- | --- |
| `/event-types` | Uses `src/app/(dashboard)/event-types/mock-event-types.ts` for list/search/filter UI. |
| `/event-types/new` | Client-side UI and toast only; does not insert into Supabase. |
| `/event-types/[id]/edit` | Mock-backed edit UI and toast only. |
| `/settings` | Client-local settings UI; does not persist account, password, notification, or integration changes. |
| `/onboarding` | Persists profile name/username/timezone, replaces initial weekly availability rules, and creates or updates the first active event type. |
| `/booking/cancel/[token]` | Mock UI shell; real cancellation logic exists in `src/lib/booking/cancel.ts` and `/api/bookings/[id]/cancel`. |
| Email delivery | Console provider only by default; no production email provider is configured. |

Do not document these as complete without first wiring and validating persistence.

## Primary User Flows

### Host Setup

1. User signs up or logs in.
2. Supabase trigger creates a profile shell.
3. User completes `/onboarding`, which saves profile, availability, and an initial event type.
4. User can later update profile at `/profile` and availability at `/availability`.
5. Event type dashboard management is partially implemented; public pages read active event types from Supabase when present.

### Guest Booking

1. Guest opens `/<username>`.
2. Guest selects an active event type.
3. `SlotPicker` fetches slots from `/api/slots`.
4. Guest clicks a slot, creating a hold through `/api/holds`.
5. Guest submits booking form to `/api/bookings`.
6. Booking is inserted with status `confirmed`; emails are logged/sent through the email abstraction.

### Host Booking Management

1. Host opens `/bookings`.
2. Server page fetches host bookings from Supabase.
3. Client view categorizes bookings locally.
4. Host can cancel upcoming bookings through `/api/bookings/[id]/cancel`.

## Related Docs

- [Architecture](architecture.md)
- [Development](development.md)
- [Security](security.md)
