# Implementation Plan: OpenSlot Scheduling Platform

## Overview

This plan implements an MVP scheduling platform using Next.js 14+ (App Router), TypeScript (strict mode), Supabase (Auth, Postgres, RLS), Tailwind CSS, and shadcn/ui. The implementation follows a bottom-up approach: project scaffolding → database → auth → core features → public pages → booking engine → dashboard → tests → seed data → documentation.

## Tasks

- [x] 1. Set up Next.js app structure and dependencies
  - [x] 1.1 Initialize Next.js 14+ project with TypeScript strict mode, Tailwind CSS, and App Router
    - Create `package.json` with all dependencies: next, react, @supabase/ssr, @supabase/supabase-js, react-hook-form, zod, @hookform/resolvers, date-fns, date-fns-tz, uuid
    - Create `tsconfig.json` with strict mode enabled and path aliases (`@/` → `src/`)
    - Create `tailwind.config.ts` with shadcn/ui configuration
    - Create `.env.example` with: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_APP_URL
    - Set up `src/app/layout.tsx` root layout with Tailwind and font configuration
    - _Requirements: 21.1, 21.2, 21.4_

  - [x] 1.2 Set up directory structure and shadcn/ui components
    - Create directory structure matching the design: `src/app/(auth)`, `src/app/(dashboard)`, `src/app/(public)`, `src/app/api`, `src/components/ui`, `src/lib`
    - Install and configure shadcn/ui with Button, Input, Label, Card, Dialog, Select, Calendar, Toast, Dropdown, Badge components
    - _Requirements: 21.1_

- [x] 2. Set up Supabase client/server helpers
  - [x] 2.1 Create Supabase client utilities
    - Create `src/lib/supabase/client.ts` — browser client using `createBrowserClient` with Database type
    - Create `src/lib/supabase/server.ts` — server component client using `createServerClient` with cookie handling
    - Create `src/lib/supabase/admin.ts` — service role client for server-side operations (never exposed to client)
    - Create `src/lib/types/database.ts` — TypeScript types matching the database schema
    - _Requirements: 22.2, 22.4_

- [x] 3. Create database migrations
  - [x] 3.1 Create SQL migration files
    - Create `supabase/migrations/001_enable_extensions.sql` — enable uuid-ossp and btree_gist extensions
    - Create `supabase/migrations/002_create_profiles.sql` — profiles table with username uniqueness, valid_username check constraint
    - Create `supabase/migrations/003_create_event_types.sql` — event_types table with duration/buffer constraints, unique slug per user
    - Create `supabase/migrations/004_create_availability_rules.sql` — availability_rules table with weekday and time range constraints
    - Create `supabase/migrations/005_create_availability_overrides.sql` — availability_overrides table with conditional time validation
    - Create `supabase/migrations/006_create_slot_holds.sql` — slot_holds table with hold_token uniqueness, status check
    - Create `supabase/migrations/007_create_bookings.sql` — bookings table with exclusion constraint (`no_overlapping_bookings`) using btree_gist for anti-double-booking
    - Create `supabase/migrations/008_create_rls_policies.sql` — all RLS policies as defined in design
    - Create `supabase/migrations/009_create_indexes.sql` — performance indexes for profiles, event_types, availability, bookings, holds
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 12.1_

- [x] 4. Add RLS policies
  - [x] 4.1 Implement Row-Level Security policies in migration 008
    - Profiles: owners read/write own; public read profiles with username set
    - Event types: owners full CRUD; public read active event types
    - Availability rules: owners only (all operations)
    - Availability overrides: owners only (all operations)
    - Slot holds: service role manages all (RLS bypassed by service role)
    - Bookings: owners can read own; service role manages inserts/updates
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

- [x] 5. Add auth pages and middleware
  - [x] 5.1 Create authentication middleware
    - Create `src/middleware.ts` that protects `/dashboard/*` routes, redirects unauthenticated users to `/login?returnUrl=...`, refreshes Supabase auth session, and allows public routes
    - _Requirements: 2.3, 2.4, 19.5_

  - [x] 5.2 Create auth pages
    - Create `src/app/(auth)/layout.tsx` — centered layout for auth pages
    - Create `src/app/(auth)/login/page.tsx` — login form with email/password, error handling, redirect to dashboard on success
    - Create `src/app/(auth)/signup/page.tsx` — signup form with email/password, password validation, redirect to dashboard on success
    - Handle auth errors with descriptive messages (without revealing account existence)
    - _Requirements: 1.1, 1.3, 1.4, 2.1, 2.2, 19.4_

- [x] 6. Add profile creation flow
  - [x] 6.1 Implement profile auto-creation and management
    - Create `src/lib/validations/profile.ts` — Zod schema for profile (name, username, default_timezone) with IANA timezone validation
    - Create a database trigger or post-signup hook that auto-creates a profile record when a new user signs up
    - Create `src/app/(dashboard)/profile/page.tsx` — profile edit form with username, name, timezone fields
    - Enforce username uniqueness and URL-safe character validation (lowercase letters, numbers, hyphens)
    - _Requirements: 1.2, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 6.2 Write property test for username and timezone validation (Property 2)
    - **Property 2: Username and timezone validation correctness**
    - Test that username validator accepts strings matching `^[a-z0-9-]+$` with length 3-30, rejects all others
    - Test that timezone validator accepts valid IANA identifiers and rejects invalid ones
    - Use fast-check with 100 iterations
    - **Validates: Requirements 3.4, 3.5**

- [x] 7. Add dashboard layout
  - [x] 7.1 Create dashboard layout and navigation
    - Create `src/app/(dashboard)/layout.tsx` — sidebar/nav layout with links to Dashboard, Event Types, Availability, Bookings, Profile
    - Create `src/app/(dashboard)/dashboard/page.tsx` — overview page showing upcoming bookings summary
    - Include logout functionality in the navigation
    - _Requirements: 2.2, 14.1_

- [x] 8. Add event type CRUD
  - [x] 8.1 Implement event type validation and utilities
    - Create `src/lib/validations/event-type.ts` — Zod schema for event types (title, duration, buffers, location, etc.)
    - Create `src/lib/utils/slug.ts` — slug generation function that produces URL-safe slugs from titles
    - _Requirements: 4.1, 4.2, 4.5, 4.6, 4.7, 4.8_

  - [x] 8.2 Write property tests for slug generation and event type validation (Properties 1, 3)
    - **Property 1: Slug generation produces URL-safe output**
    - Test that for any non-empty string, the generated slug contains only lowercase letters, numbers, and hyphens, and is non-empty
    - **Property 3: Event type numeric constraint validation**
    - Test that duration validator accepts only positive integers, buffer validators accept only non-negative integers, and time range validator accepts only start < end
    - Use fast-check with 100 iterations
    - **Validates: Requirements 4.2, 4.6, 4.7, 5.2**

  - [x] 8.3 Create event type CRUD pages
    - Create `src/app/(dashboard)/event-types/page.tsx` — list all event types with edit/delete actions
    - Create `src/app/(dashboard)/event-types/new/page.tsx` — create event type form
    - Create `src/app/(dashboard)/event-types/[id]/edit/page.tsx` — edit event type form
    - Implement delete functionality with confirmation dialog
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 9. Add availability CRUD
  - [x] 9.1 Implement availability management
    - Create `src/lib/validations/availability.ts` — Zod schemas for availability rules and overrides
    - Create `src/app/(dashboard)/availability/page.tsx` — weekly availability grid with per-weekday time windows
    - Support adding multiple availability windows per weekday
    - Support toggling rules active/inactive
    - Support date-specific overrides (mark day unavailable or set custom hours)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4_

- [x] 10. Checkpoint - Ensure core host features work
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Add public profile page
  - [x] 11.1 Implement public host profile page
    - Create `src/app/(public)/layout.tsx` — minimal public layout
    - Create `src/app/(public)/[username]/page.tsx` — display host name, avatar, and list of active event types
    - Handle 404 for non-existent usernames
    - Display "no availability" message if host has no active event types
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 11.2 Write property test for active event type filtering (Property 9)
    - **Property 9: Public listing shows only active event types**
    - Test that for any set of event types with mixed is_active values, the filter returns exactly those where is_active is true
    - Use fast-check with 100 iterations
    - **Validates: Requirements 8.3**

- [x] 12. Add public event booking page
  - [x] 12.1 Implement public event type booking page
    - Create `src/app/(public)/[username]/[eventSlug]/page.tsx` — date picker + available time slots display
    - Fetch event type details and host profile via server component
    - Handle 404 for non-existent event slugs
    - Implement date selection that triggers slot fetching
    - Display available slots in guest's timezone with timezone selector
    - _Requirements: 9.1, 9.2, 9.5, 17.3, 17.5_

- [x] 13. Implement availability calculation
  - [x] 13.1 Implement the slot computation engine
    - Create `src/lib/availability/types.ts` — TypeScript interfaces for AvailabilityRule, AvailabilityOverride, TimeSlot, ComputeSlotsInput
    - Create `src/lib/availability/compute-slots.ts` — implement the `computeAvailableSlots` function following the design algorithm:
      1. Convert requested date to host timezone to determine weekday
      2. Check for date-specific overrides (unavailable → return []; custom hours → use those)
      3. Get applicable weekly rules for that weekday
      4. Generate candidate slots by stepping through availability windows
      5. Filter out slots conflicting with bookings/holds (including buffers)
      6. Filter out slots within min_notice_minutes or beyond max_booking_days_ahead
    - Create `src/lib/utils/timezone.ts` — timezone conversion utilities
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 17.1, 17.2, 17.6_

  - [x] 13.2 Write property tests for slot computation (Properties 4, 5, 6)
    - **Property 4: Slot computation respects availability windows**
    - Test that all returned slots fall entirely within declared available windows; if override marks day unavailable, zero slots returned
    - **Property 5: Slot computation excludes conflicting bookings and holds**
    - Test that no returned slot's buffered range overlaps any confirmed booking or active hold; cancelled bookings don't block
    - **Property 6: Slot computation enforces time boundaries**
    - Test that all returned slots have start time at least min_notice_minutes in future and at most max_booking_days_ahead days ahead
    - Use fast-check with 100 iterations for each property
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 5.5, 6.2, 6.3, 6.4, 10.3, 13.4**

  - [x] 13.3 Write property test for timezone round-trip (Property 7)
    - **Property 7: Timezone conversion round-trip**
    - Test that for any valid UTC timestamp and IANA timezone, converting to target timezone and back produces the original timestamp
    - Use fast-check with 100 iterations
    - **Validates: Requirements 7.8, 17.3, 17.4**

  - [x] 13.4 Create the slots API route
    - Create `src/app/api/slots/route.ts` — GET endpoint accepting hostUserId, eventTypeId, date, timezone query params
    - Fetch availability rules, overrides, confirmed bookings, and active holds from database
    - Call `computeAvailableSlots` and return the result
    - _Requirements: 7.1, 7.8, 9.2_

- [x] 14. Implement slot holds
  - [x] 14.1 Create the holds API route
    - Create `src/lib/validations/booking.ts` — Zod schemas for createHoldSchema and confirmBookingSchema
    - Create `src/app/api/holds/route.ts` — POST endpoint using service role client
    - Validate input with Zod, create hold with 5-minute expiration, return hold_token
    - Handle conflict if slot already held/booked (return appropriate error)
    - _Requirements: 9.3, 9.4, 10.1, 10.2, 10.3, 10.6, 22.1, 22.3, 22.4_

  - [x] 14.2 Write property test for booking form validation (Property 8)
    - **Property 8: Booking form validation correctness**
    - Test that booking schema accepts input iff guest_name is non-empty and guest_email is valid email format, and hold_token is valid UUID
    - Use fast-check with 100 iterations
    - **Validates: Requirements 11.7, 3.2**

- [x] 15. Implement booking confirmation
  - [x] 15.1 Create the booking confirmation engine and API route
    - Create `src/lib/booking/types.ts` — TypeScript interfaces for CreateHoldInput/Result, ConfirmBookingInput/Result, CancelBookingInput/Result
    - Create `src/lib/booking/confirm.ts` — `confirmBooking` function: validate hold → check expiration → insert booking (exclusion constraint guards) → update hold status → trigger emails
    - Create `src/app/api/bookings/route.ts` — POST endpoint using service role client, validates with Zod, calls confirmBooking
    - Handle exclusion constraint violation (PostgreSQL error 23P01) → return "slot taken" error
    - Handle expired hold → return "hold expired" error with lazy status update
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.7, 11.8, 12.1, 12.2, 12.3, 12.4, 22.1, 22.3_

  - [x] 15.2 Create booking confirmation UI
    - Create booking form component shown after slot selection: guest name, email, timezone, notes fields
    - Display hold expiration countdown timer
    - On successful confirmation, show confirmation page with booking details and cancellation link
    - Handle errors: hold expired (prompt re-selection), slot taken (refresh slots)
    - _Requirements: 11.6, 19.2, 19.3_

- [x] 16. Implement email notifications
  - [x] 16.1 Create email service abstraction
    - Create `src/lib/email/provider.ts` — EmailProvider interface and EmailPayload type
    - Create `src/lib/email/templates.ts` — HTML/text templates for booking confirmation (guest), booking notification (host), and cancellation emails
    - Create `src/lib/email/send.ts` — send functions that use console logging in dev mode, real provider in production
    - Ensure email failures are logged but never block booking operations
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_

- [x] 17. Implement cancellation
  - [x] 17.1 Create cancellation engine and API route
    - Create `src/lib/booking/cancel.ts` — `cancelBooking` function: validate token → update status to 'cancelled' → store cancel_reason → trigger cancellation emails
    - Create `src/app/api/bookings/[id]/cancel/route.ts` — POST endpoint using service role client
    - _Requirements: 13.2, 13.3, 22.1_

  - [x] 17.2 Create cancellation pages
    - Create `src/app/booking/cancel/[token]/page.tsx` — display booking details and cancellation confirmation prompt
    - Handle invalid token (show "invalid token" error page)
    - Handle already-cancelled booking (show "already cancelled" message)
    - On successful cancellation, show confirmation message
    - _Requirements: 13.1, 13.5, 13.6, 19.1_

- [x] 18. Checkpoint - Ensure booking flow works end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [x] 19. Add booking management dashboard
  - [x] 19.1 Implement bookings dashboard page
    - Create `src/app/(dashboard)/bookings/page.tsx` — list upcoming confirmed bookings sorted by start time
    - Display booking details: guest name, email, event type, start/end time, status
    - Display times in host's default timezone
    - Add status filter (confirmed, cancelled)
    - Add cancel action for individual bookings
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 17.4_

- [x] 20. Add landing page
  - [x] 20.1 Create landing page
    - Create `src/app/page.tsx` — landing page with OpenSlot branding, value proposition, tagline "Share availability. Book time. Stay in sync."
    - Include navigation links to sign up and log in
    - _Requirements: 23.1, 23.2, 23.3_

- [x] 21. Add seed data
  - [x] 21.1 Create seed script
    - Create `supabase/seed.sql` — SQL seed script that creates:
      - A demo user with complete profile (name, username, timezone)
      - At least one event type (e.g., "30 Minute Meeting")
      - Weekday availability rules (Monday-Friday, 9:00-17:00)
      - At least one sample confirmed booking
    - _Requirements: 20.1, 20.2, 20.3, 20.4_

- [x] 22. Add tests
  - [x] 22.1 Set up testing framework
    - Install and configure Vitest with TypeScript support
    - Install fast-check for property-based testing
    - Add test scripts to package.json (test, test:watch)
    - Create vitest.config.ts with path aliases matching tsconfig
    - _Requirements: 21.1_

  - [x] 22.2 Write unit tests for core modules
    - Write unit tests for slug generation (example-based edge cases)
    - Write unit tests for availability computation (specific scenarios)
    - Write unit tests for booking confirmation logic (mock-based)
    - Write unit tests for email service (mock-based verification)
    - Write unit tests for validation schemas (boundary cases)
    - _Requirements: 4.2, 7.1, 11.1, 16.1_

  - [x] 22.3 Write integration tests for API routes
    - Write integration tests for `/api/slots` — verify correct slot computation with real data
    - Write integration tests for `/api/holds` — verify hold creation and conflict handling
    - Write integration tests for `/api/bookings` — verify full booking flow (hold → confirm → verify)
    - Write integration tests for anti-double-booking — concurrent requests, exclusion constraint
    - Write integration tests for cancellation — verify status update and slot re-availability
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 13.4_

- [x] 23. Add README and documentation
  - [x] 23.1 Create README.md
    - Write README with: project overview, tech stack, prerequisites (Node.js, Supabase CLI)
    - Include setup instructions: clone, install deps, create Supabase project, configure .env, run migrations, start dev server
    - Document available npm scripts: dev, build, start, lint, typecheck, test
    - Include architecture overview and directory structure reference
    - _Requirements: 21.1, 21.2, 21.3_

- [x] 24. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation of working features
- Property tests validate universal correctness properties from the design document (Properties 1-9)
- Unit tests validate specific examples and edge cases
- The exclusion constraint (`no_overlapping_bookings`) is the critical anti-double-booking mechanism — it must be tested under concurrency
- All booking write operations use the Supabase service role client (never exposed to browser)
- Email sending is fire-and-forget to avoid blocking booking operations
