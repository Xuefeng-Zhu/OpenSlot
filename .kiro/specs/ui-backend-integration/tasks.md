# Implementation Plan: UI-Backend Integration

## Overview

Convert five pages from mock/hardcoded data to live Supabase queries. Public pages become server components for SEO; dashboard pages use server components for data fetching with client components for interactivity. A new `POST /api/availability` route handles batch save of rules and overrides.

## Tasks

- [x] 1. Convert public profile page to server component with Supabase data fetching
  - [x] 1.1 Rewrite `src/app/(public)/[username]/page.tsx` as a server component
    - Remove `"use client"` directive and all mock data
    - Fetch profile from `profiles` table using `username` param via `createServerSupabaseClient()`
    - Fetch active event types from `event_types` table where `user_id` matches profile and `is_active = true`
    - Call `notFound()` if username not found in database
    - Pass fetched data as props to presentational markup
    - Display host's name, avatar_url, default_timezone, and each event type's title, description, duration_minutes, location_type, slug
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 1.2 Write property test for profile page rendering (Property 1)
    - **Property 1: Profile page renders all required data fields**
    - Generate random profile data (name, avatar_url, default_timezone) and random arrays of active event types (title, description, duration_minutes, location_type, slug)
    - Verify rendered output contains every profile field and every event type field
    - Test file: `src/app/(public)/__tests__/profile-page-rendering.property.test.tsx`
    - **Validates: Requirements 1.4, 1.5**

- [x] 2. Convert public booking page to server component rendering SlotPicker
  - [x] 2.1 Rewrite `src/app/(public)/[username]/[eventSlug]/page.tsx` as a server component
    - Remove `"use client"` directive and all mock data/inline booking flow
    - Fetch profile from `profiles` table using `username` param
    - Fetch event type from `event_types` table using host's `user_id`, `slug = eventSlug`, and `is_active = true`
    - Call `notFound()` if username not found or event slug not found/inactive
    - Render `<SlotPicker eventType={...} hostProfile={...} />` with fetched data
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 3. Checkpoint - Ensure public pages compile and render correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Convert dashboard page to server component with real data
  - [x] 4.1 Rewrite `src/app/(dashboard)/dashboard/page.tsx` as a server component
    - Remove `"use client"` directive and all mock data
    - Fetch profile (username, name) via `createServerSupabaseClient()` using `auth_user_id`
    - Fetch upcoming confirmed bookings: `bookings` joined with `event_types` where `host_user_id = profile.id`, `status = 'confirmed'`, `start_at > now()`, ordered by `start_at` ascending
    - Fetch count of active event types where `user_id = profile.id` and `is_active = true`
    - Build booking link from profile username
    - Pass data to a client component (e.g., `DashboardClient`) for interactive elements (copy link, toast)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 4.2 Write property test for dashboard booking link (Property 2)
    - **Property 2: Dashboard booking link contains username**
    - Generate random valid username strings
    - Verify the rendered booking link contains the username as a path segment
    - Test file: `src/app/(dashboard)/__tests__/dashboard-booking-link.property.test.ts`
    - **Validates: Requirements 3.4**

  - [x] 4.3 Write property test for dashboard bookings ordering (Property 3)
    - **Property 3: Dashboard bookings are ordered by start time ascending**
    - Generate random arrays of bookings with distinct `start_at` timestamps
    - Verify they are rendered in ascending chronological order
    - Test file: `src/components/dashboard/__tests__/dashboard-bookings-order.property.test.ts`
    - **Validates: Requirements 3.6**

- [x] 5. Convert bookings page to server component with client interactivity
  - [x] 5.1 Create `BookingsClient` client component for tab/filter/cancel interactivity
    - Extract the interactive UI (tabs, filters, drawer, cancel dialog) into a new `src/components/dashboard/bookings-client.tsx` client component
    - Accept `bookings` prop with all booking data (including event type title from join)
    - Implement categorization: "upcoming" (confirmed + future), "past" (confirmed + past), "cancelled" (status = cancelled)
    - Implement event type filter (case-insensitive match on event type title)
    - Wire cancel button to call `POST /api/bookings/[id]/cancel` with the booking's cancellation token
    - On successful cancel, update local state and show success toast
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 5.2 Rewrite `src/app/(dashboard)/bookings/page.tsx` as a server component
    - Remove `"use client"` directive and all mock data
    - Fetch all bookings joined with `event_types` for the authenticated user via `createServerSupabaseClient()`
    - Pass fetched bookings to `<BookingsClient bookings={...} />`
    - _Requirements: 4.1, 4.7, 4.8_

  - [x] 5.3 Write property test for booking categorization (Property 4)
    - **Property 4: Booking categorization correctness**
    - Generate random bookings with various `status` values and `start_at` timestamps relative to now
    - Verify categorization: "upcoming" iff confirmed + future, "past" iff confirmed + past, "cancelled" iff status is cancelled
    - Test file: `src/lib/__tests__/booking-categorization.property.test.ts`
    - **Validates: Requirements 4.2**

  - [x] 5.4 Write property test for event type filter (Property 5)
    - **Property 5: Event type filter returns only matching bookings**
    - Generate random filter strings and booking arrays with event type titles
    - Verify filtered result contains only and all bookings whose event type title includes the filter string (case-insensitive)
    - Test file: `src/lib/__tests__/booking-filter.property.test.ts`
    - **Validates: Requirements 4.4**

- [x] 6. Checkpoint - Ensure dashboard and bookings pages work correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement availability page with real data and persistence
  - [x] 7.1 Create `POST /api/availability` route for batch save
    - Create `src/app/api/availability/route.ts`
    - Accept request body with `rules`, `overrides`, `deletedRuleIds`, `deletedOverrideIds`, `timezone`
    - Validate input with Zod schema
    - Use `createAdminClient()` to perform operations within a transaction-like flow:
      - Delete rules by IDs in `deletedRuleIds`
      - Delete overrides by IDs in `deletedOverrideIds`
      - Upsert rules (insert new, update existing based on presence of `id`)
      - Upsert overrides (insert new, update existing based on presence of `id`)
    - Return `{ success: true }` or `{ success: false, error: string }` with appropriate status codes
    - _Requirements: 5.5, 5.6, 5.7, 5.8, 5.9_

  - [x] 7.2 Create `AvailabilityClient` client component
    - Create `src/components/dashboard/availability-client.tsx`
    - Accept props: `initialRules`, `initialOverrides`, `timezone`, `userId`
    - Reuse existing `AvailabilityDayRow` component for weekly schedule editing
    - Track local state changes (added/modified/deleted rules and overrides)
    - On save, compute diff (new, updated, deleted) and POST to `/api/availability`
    - Show success toast on save, error toast on failure (preserving form state)
    - Show sticky save bar when changes exist
    - _Requirements: 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9_

  - [x] 7.3 Rewrite `src/app/(dashboard)/availability/page.tsx` as a server component
    - Remove `"use client"` directive and all mock data
    - Fetch availability rules from `availability_rules` table for the authenticated user
    - Fetch availability overrides from `availability_overrides` table for the authenticated user
    - Fetch profile's `default_timezone` from `profiles` table
    - Pass fetched data to `<AvailabilityClient initialRules={...} initialOverrides={...} timezone={...} userId={...} />`
    - _Requirements: 5.1, 5.2, 5.10, 5.11_

  - [x] 7.4 Write property test for availability save round-trip (Property 6)
    - **Property 6: Availability save round-trip preserves state**
    - Generate random valid availability rules (weekday, start_time, end_time) and overrides (date, start_time, end_time, is_available)
    - Verify that saving via the API and re-fetching produces an equivalent set of rules and overrides
    - Test file: `src/app/api/availability/__tests__/availability-roundtrip.property.test.ts`
    - **Validates: Requirements 5.5, 5.6, 5.7, 5.8**

- [x] 8. Final checkpoint - Ensure all pages compile and all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The existing `SlotPicker` component is already wired to the backend — the booking page just renders it with real props
- Auth is handled by the existing `(dashboard)/layout.tsx` — individual pages don't need auth checks
- Property tests validate universal correctness properties using `fast-check` with Vitest
- All server components use `createServerSupabaseClient()` which respects RLS policies
- The availability API route uses `createAdminClient()` for write operations
