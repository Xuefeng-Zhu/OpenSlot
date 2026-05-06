# Requirements Document

## Introduction

This feature connects the OpenSlot scheduling platform's UI pages to the real Supabase backend, replacing all mock/hardcoded data with live database queries. The affected pages include the public profile page, public booking page, dashboard page, bookings management page, and availability settings page. The existing API routes (`/api/slots`, `/api/holds`, `/api/bookings`) and the `SlotPicker` component are already wired to the backend and serve as the foundation for the booking flow integration.

## Glossary

- **Profile_Page**: The public-facing page at `/(public)/[username]` that displays a host's profile and their active event types
- **Booking_Page**: The public-facing page at `/(public)/[username]/[eventSlug]` that allows guests to select a time slot and book an appointment
- **Dashboard_Page**: The authenticated page at `/(dashboard)/dashboard` that shows the host's upcoming bookings and key metrics
- **Bookings_Page**: The authenticated page at `/(dashboard)/bookings` that lists all bookings with filtering and status tabs
- **Availability_Page**: The authenticated page at `/(dashboard)/availability` that manages weekly availability rules and date overrides
- **Supabase_Client**: The server-side Supabase client created via `createServerSupabaseClient()` that respects RLS policies
- **Admin_Client**: The service-role Supabase client created via `createAdminClient()` that bypasses RLS
- **SlotPicker_Component**: The existing `SlotPicker` component that fetches slots from `/api/slots`, creates holds via `/api/holds`, and confirms bookings via `/api/bookings`
- **Host**: An authenticated user who creates event types and receives bookings
- **Guest**: An unauthenticated visitor who books time with a host
- **Event_Type**: A bookable meeting type with duration, buffer, and scheduling constraints
- **Availability_Rule**: A recurring weekly time window when a host is available
- **Availability_Override**: A date-specific exception to the weekly availability rules

## Requirements

### Requirement 1: Public Profile Page Data Fetching

**User Story:** As a guest, I want to view a host's real profile and event types when I visit their public page, so that I can see accurate information and choose an event to book.

#### Acceptance Criteria

1. WHEN a guest navigates to `/{username}`, THE Profile_Page SHALL fetch the host's profile from the `profiles` table using the `username` parameter
2. WHEN a guest navigates to `/{username}`, THE Profile_Page SHALL fetch all active event types from the `event_types` table where `user_id` matches the profile and `is_active` is true
3. IF the username does not match any profile in the database, THEN THE Profile_Page SHALL display a 404 not-found state
4. THE Profile_Page SHALL display the host's name, avatar URL, and default timezone from the fetched profile data
5. THE Profile_Page SHALL display each active event type's title, description, duration, location type, and slug
6. WHEN the profile or event types are loading, THE Profile_Page SHALL display a loading indicator

### Requirement 2: Public Booking Page Integration with SlotPicker

**User Story:** As a guest, I want the booking page to use the real slot-picking flow, so that I can see actual available times and complete a real booking.

#### Acceptance Criteria

1. WHEN a guest navigates to `/{username}/{eventSlug}`, THE Booking_Page SHALL fetch the host's profile from the `profiles` table using the `username` parameter
2. WHEN a guest navigates to `/{username}/{eventSlug}`, THE Booking_Page SHALL fetch the event type from the `event_types` table using the `eventSlug` and the host's `user_id`
3. THE Booking_Page SHALL render the SlotPicker_Component with the fetched `eventType` and `hostProfile` props instead of the current inline mock implementation
4. IF the username does not match any profile, THEN THE Booking_Page SHALL display a 404 not-found state
5. IF the event slug does not match any active event type for the host, THEN THE Booking_Page SHALL display a 404 not-found state
6. WHEN the profile or event type data is loading, THE Booking_Page SHALL display a loading indicator

### Requirement 3: Dashboard Page Real Data

**User Story:** As a host, I want my dashboard to show real upcoming bookings and accurate metrics, so that I can see my actual schedule at a glance.

#### Acceptance Criteria

1. WHEN the authenticated host visits the dashboard, THE Dashboard_Page SHALL fetch upcoming confirmed bookings from the `bookings` table where `host_user_id` matches the current user and `status` is `confirmed` and `start_at` is in the future
2. THE Dashboard_Page SHALL display the count of upcoming confirmed bookings in the "Upcoming bookings" metric card
3. THE Dashboard_Page SHALL fetch the count of active event types from the `event_types` table where `user_id` matches the current user and `is_active` is true
4. THE Dashboard_Page SHALL display the host's booking link using the authenticated user's username from the `profiles` table
5. THE Dashboard_Page SHALL display the list of upcoming bookings with each booking's guest name, event type title, start date, start time, and duration
6. THE Dashboard_Page SHALL order upcoming bookings by `start_at` ascending
7. IF the user is not authenticated, THEN THE Dashboard_Page SHALL redirect to the login page

### Requirement 4: Bookings Page Real Data with Filtering

**User Story:** As a host, I want to view and manage all my real bookings with filtering by status, so that I can track my schedule history.

#### Acceptance Criteria

1. WHEN the authenticated host visits the bookings page, THE Bookings_Page SHALL fetch all bookings from the `bookings` table where `host_user_id` matches the current user
2. THE Bookings_Page SHALL categorize bookings into "upcoming" (status is `confirmed` and `start_at` is in the future), "past" (status is `confirmed` and `start_at` is in the past), and "cancelled" (status is `cancelled`) tabs
3. THE Bookings_Page SHALL display each booking's guest name, guest email, event type title, start date/time, end date/time, timezone, and notes
4. WHEN the host filters by event type, THE Bookings_Page SHALL display only bookings matching the filter text
5. WHEN the host clicks "Cancel booking" on an upcoming booking, THE Bookings_Page SHALL call the `POST /api/bookings/[id]/cancel` endpoint with the booking's cancellation token
6. WHEN a booking is successfully cancelled, THE Bookings_Page SHALL move the booking to the "cancelled" tab and display a success notification
7. IF the user is not authenticated, THEN THE Bookings_Page SHALL redirect to the login page
8. THE Bookings_Page SHALL join with the `event_types` table to display the event type title for each booking

### Requirement 5: Availability Page Real Data with Persistence

**User Story:** As a host, I want to view and edit my real availability rules and date overrides, so that my booking availability reflects my actual schedule.

#### Acceptance Criteria

1. WHEN the authenticated host visits the availability page, THE Availability_Page SHALL fetch all availability rules from the `availability_rules` table where `user_id` matches the current user
2. WHEN the authenticated host visits the availability page, THE Availability_Page SHALL fetch all availability overrides from the `availability_overrides` table where `user_id` matches the current user
3. THE Availability_Page SHALL display the fetched availability rules grouped by weekday with their start and end times
4. THE Availability_Page SHALL display the fetched date overrides with their date, availability status, and time intervals
5. WHEN the host clicks "Save availability", THE Availability_Page SHALL persist the modified availability rules to the `availability_rules` table
6. WHEN the host clicks "Save availability", THE Availability_Page SHALL persist the modified date overrides to the `availability_overrides` table
7. WHEN the host adds a new date override, THE Availability_Page SHALL insert a new row into the `availability_overrides` table upon save
8. WHEN the host removes a date override, THE Availability_Page SHALL delete the corresponding row from the `availability_overrides` table upon save
9. IF the save operation fails, THEN THE Availability_Page SHALL display an error notification and retain the unsaved changes in the UI
10. IF the user is not authenticated, THEN THE Availability_Page SHALL redirect to the login page
11. THE Availability_Page SHALL use the host's `default_timezone` from the `profiles` table as the initial timezone value
