# Requirements Document

## Introduction

OpenSlot is an MVP scheduling platform (similar to Calendly/Cal.com) that allows users to share their availability, let guests book time slots, and stay in sync. The platform enables users to create public scheduling profiles, configure weekly availability, define event types, and provide a seamless booking experience with anti-double-booking guarantees at the database level.

## Glossary

- **System**: The OpenSlot scheduling platform application as a whole
- **Auth_Module**: The authentication subsystem handling sign up, log in, log out, and session management via Supabase Auth
- **Profile_Service**: The subsystem managing user profiles including username, timezone, and avatar
- **Dashboard**: The protected area where authenticated users manage their scheduling configuration
- **Event_Type_Service**: The subsystem managing event type CRUD operations
- **Availability_Engine**: The subsystem responsible for computing available time slots based on rules, overrides, existing bookings, and holds
- **Booking_Engine**: The subsystem responsible for creating, confirming, and cancelling bookings with transactional guarantees
- **Hold_Service**: The subsystem managing temporary slot holds during the booking flow
- **Public_Page_Service**: The subsystem serving public-facing booking pages for guests
- **Email_Service**: The abstraction layer for sending booking-related email notifications
- **Database**: The PostgreSQL database with RLS policies, exclusion constraints, and migrations
- **Host**: An authenticated user who creates event types and receives bookings
- **Guest**: An unauthenticated visitor who books a time slot with a host
- **Slot**: A specific start/end time window available for booking
- **Hold**: A temporary reservation of a slot (5-minute TTL) to prevent race conditions during booking
- **Buffer**: Time before or after an event that must remain free
- **Exclusion_Constraint**: A PostgreSQL constraint using btree_gist that prevents overlapping confirmed bookings for the same host

## Requirements

### Requirement 1: User Registration

**User Story:** As a guest visitor, I want to sign up for an account, so that I can create a scheduling profile and receive bookings.

#### Acceptance Criteria

1. WHEN a visitor submits valid email and password, THE Auth_Module SHALL create a new authenticated user account and redirect to the dashboard
2. WHEN a new user account is created, THE Profile_Service SHALL auto-create a profile record linked to the authenticated user with default values
3. IF a visitor submits an email that is already registered, THEN THE Auth_Module SHALL display a descriptive error message without revealing account existence details
4. THE Auth_Module SHALL validate that passwords meet minimum security requirements before account creation

### Requirement 2: User Authentication

**User Story:** As a registered user, I want to log in and log out, so that I can securely access my scheduling dashboard.

#### Acceptance Criteria

1. WHEN a user submits valid credentials, THE Auth_Module SHALL authenticate the user and redirect to the dashboard
2. WHEN a user clicks log out, THE Auth_Module SHALL terminate the session and redirect to the landing page
3. WHILE a user is not authenticated, THE System SHALL redirect requests to protected routes to the login page
4. WHILE a user is authenticated, THE System SHALL maintain the session across page navigations without requiring re-authentication

### Requirement 3: Profile Management

**User Story:** As a host, I want to manage my public profile, so that guests can identify me on my booking page.

#### Acceptance Criteria

1. THE Profile_Service SHALL store profile fields: id, auth_user_id, email, name, username, avatar_url, default_timezone, created_at, updated_at
2. WHEN a host updates their profile, THE Profile_Service SHALL validate and persist the changes
3. THE Profile_Service SHALL enforce that usernames are unique across all profiles
4. THE Profile_Service SHALL enforce that usernames contain only URL-safe characters (lowercase letters, numbers, hyphens)
5. WHEN a host sets a default timezone, THE Profile_Service SHALL accept only valid IANA timezone identifiers

### Requirement 4: Event Type Management

**User Story:** As a host, I want to create and manage event types, so that I can offer different meeting options to guests.

#### Acceptance Criteria

1. THE Event_Type_Service SHALL store event type fields: id, user_id, title, slug, description, duration_minutes, buffer_before_minutes, buffer_after_minutes, min_notice_minutes, max_booking_days_ahead, location_type, location_value, is_active, created_at, updated_at
2. WHEN a host creates an event type, THE Event_Type_Service SHALL generate a URL-safe slug from the title
3. WHEN a host updates an event type, THE Event_Type_Service SHALL validate and persist the changes
4. WHEN a host deletes an event type, THE Event_Type_Service SHALL remove the event type from the system
5. THE Event_Type_Service SHALL support location types: online, phone, in_person, custom
6. THE Event_Type_Service SHALL enforce that duration_minutes is a positive integer
7. THE Event_Type_Service SHALL enforce that buffer_before_minutes and buffer_after_minutes are non-negative integers
8. THE Event_Type_Service SHALL enforce that slugs are unique per host

### Requirement 5: Weekly Availability Configuration

**User Story:** As a host, I want to configure my weekly availability, so that guests can only book during my preferred hours.

#### Acceptance Criteria

1. THE Availability_Engine SHALL store availability rules with fields: id, user_id, weekday (0-6), start_time, end_time, timezone, is_active
2. WHEN a host configures availability for a weekday, THE Availability_Engine SHALL validate that start_time is before end_time
3. WHEN a host saves availability rules, THE Availability_Engine SHALL persist the rules with the host's specified timezone
4. THE Availability_Engine SHALL allow multiple availability windows per weekday
5. WHEN a host deactivates an availability rule, THE Availability_Engine SHALL exclude that rule from slot generation

### Requirement 6: Date-Specific Availability Overrides

**User Story:** As a host, I want to override my availability for specific dates, so that I can handle holidays, special schedules, or days off.

#### Acceptance Criteria

1. THE Availability_Engine SHALL store override fields: id, user_id, date, start_time, end_time, timezone, is_available, reason
2. WHEN a host marks a date as unavailable, THE Availability_Engine SHALL exclude that entire date from slot generation regardless of weekly rules
3. WHEN a host adds custom hours for a specific date, THE Availability_Engine SHALL use the override hours instead of the weekly rules for that date
4. THE Availability_Engine SHALL give date-specific overrides priority over weekly availability rules

### Requirement 7: Available Slot Computation

**User Story:** As a guest, I want to see accurate available time slots, so that I can choose a time that works for both me and the host.

#### Acceptance Criteria

1. WHEN a guest requests available slots for a date, THE Availability_Engine SHALL compute slots based on the host's weekly availability rules and date-specific overrides
2. THE Availability_Engine SHALL exclude time windows that overlap with confirmed bookings for the host
3. THE Availability_Engine SHALL exclude time windows that overlap with active holds for the host
4. THE Availability_Engine SHALL exclude slots where the event duration plus buffers would overlap with existing bookings or holds
5. THE Availability_Engine SHALL exclude slots that fall within the min_notice_minutes window from the current time
6. THE Availability_Engine SHALL exclude slots that fall beyond the max_booking_days_ahead window from the current date
7. THE Availability_Engine SHALL account for buffer_before_minutes and buffer_after_minutes when determining slot availability
8. THE Availability_Engine SHALL return slots converted to the guest's specified timezone
9. WHEN no timezone is specified by the guest, THE Availability_Engine SHALL default to the browser-detected timezone

### Requirement 8: Public Booking Page - Host Profile

**User Story:** As a guest, I want to view a host's public profile and event types, so that I can choose what type of meeting to book.

#### Acceptance Criteria

1. WHEN a guest navigates to /[username], THE Public_Page_Service SHALL display the host's name, avatar, and list of active event types
2. IF a guest navigates to a username that does not exist, THEN THE Public_Page_Service SHALL display a "not found" page
3. THE Public_Page_Service SHALL display only event types where is_active is true
4. IF a host has no active event types, THEN THE Public_Page_Service SHALL display a message indicating no availability

### Requirement 9: Public Booking Page - Slot Selection

**User Story:** As a guest, I want to select an available time slot for a specific event type, so that I can proceed with booking.

#### Acceptance Criteria

1. WHEN a guest navigates to /[username]/[eventSlug], THE Public_Page_Service SHALL display a date picker and available time slots
2. WHEN a guest selects a date, THE Public_Page_Service SHALL fetch and display available slots for that date
3. WHEN a guest selects a time slot, THE Hold_Service SHALL create a temporary hold on that slot
4. IF the selected slot is no longer available, THEN THE System SHALL display a message indicating the slot has been taken and refresh available slots
5. IF the event type slug does not exist for the given username, THEN THE Public_Page_Service SHALL display a "not found" page

### Requirement 10: Slot Hold Management

**User Story:** As a guest, I want my selected slot to be temporarily reserved, so that another guest cannot book it while I complete the form.

#### Acceptance Criteria

1. WHEN a guest selects a slot, THE Hold_Service SHALL create a hold with status "active" and an expiration time of 5 minutes
2. THE Hold_Service SHALL store hold fields: id, event_type_id, host_user_id, start_at, end_at, guest_email, hold_token, expires_at, status, created_at
3. WHILE a hold is active and not expired, THE Availability_Engine SHALL treat the held slot as unavailable for other guests
4. WHEN a hold's expires_at time is reached without confirmation, THE Hold_Service SHALL transition the hold status to "expired"
5. WHEN a booking is confirmed from a hold, THE Hold_Service SHALL transition the hold status to "confirmed"
6. THE Hold_Service SHALL support statuses: active, confirmed, expired, cancelled

### Requirement 11: Booking Confirmation

**User Story:** As a guest, I want to confirm my booking by providing my details, so that the meeting is officially scheduled.

#### Acceptance Criteria

1. WHEN a guest submits the booking form with valid name, email, and optional notes, THE Booking_Engine SHALL confirm the booking within a database transaction
2. THE Booking_Engine SHALL store booking fields: id, event_type_id, host_user_id, guest_name, guest_email, guest_timezone, notes, start_at, end_at, status, cancel_reason, cancellation_token, reschedule_token, created_at, updated_at
3. WHEN a booking is confirmed, THE Booking_Engine SHALL generate unique cancellation_token and reschedule_token values
4. WHEN a booking is confirmed, THE Booking_Engine SHALL set the booking status to "confirmed"
5. WHEN a booking is confirmed, THE Booking_Engine SHALL transition the associated hold to "confirmed" status
6. WHEN a booking is successfully confirmed, THE System SHALL display a confirmation page with booking details
7. THE Booking_Engine SHALL validate guest_name and guest_email as non-empty and properly formatted before confirmation
8. THE Booking_Engine SHALL store start_at and end_at as timestamptz values in UTC

### Requirement 12: Anti-Double-Booking

**User Story:** As a host, I want the system to prevent double-bookings at the database level, so that I never have overlapping confirmed meetings.

#### Acceptance Criteria

1. THE Database SHALL enforce a PostgreSQL exclusion constraint using btree_gist that prevents overlapping time ranges for confirmed bookings with the same host_user_id
2. IF a booking confirmation would create an overlapping time range with an existing confirmed booking for the same host, THEN THE Database SHALL reject the insert and THE Booking_Engine SHALL return an error indicating the slot is no longer available
3. THE Database SHALL reject overlapping bookings even when concurrent requests arrive simultaneously
4. THE Booking_Engine SHALL perform booking confirmation as a single database transaction that validates the hold and inserts the booking atomically

### Requirement 13: Booking Cancellation

**User Story:** As a guest or host, I want to cancel a booking, so that the time slot becomes available again.

#### Acceptance Criteria

1. WHEN a guest navigates to /booking/cancel/[token] with a valid cancellation token, THE Booking_Engine SHALL display the booking details and a cancellation confirmation prompt
2. WHEN a guest confirms cancellation, THE Booking_Engine SHALL set the booking status to "cancelled" and optionally store a cancel_reason
3. WHEN a host cancels a booking from the dashboard, THE Booking_Engine SHALL set the booking status to "cancelled"
4. WHEN a booking is cancelled, THE Availability_Engine SHALL treat the time slot as available again for new bookings
5. IF a cancellation token is invalid or does not match any booking, THEN THE System SHALL display an "invalid token" error page
6. IF a booking is already cancelled, THEN THE System SHALL display an "already cancelled" message

### Requirement 14: Booking Management Dashboard

**User Story:** As a host, I want to view and manage my bookings, so that I can keep track of my schedule.

#### Acceptance Criteria

1. WHEN a host navigates to the bookings dashboard, THE Dashboard SHALL display a list of upcoming confirmed bookings sorted by start time
2. THE Dashboard SHALL display booking details including guest name, guest email, event type, start time, end time, and status
3. WHEN a host selects a booking, THE Dashboard SHALL provide an option to cancel the booking
4. THE Dashboard SHALL display bookings in the host's default timezone
5. THE Dashboard SHALL allow filtering bookings by status (confirmed, cancelled)

### Requirement 15: Row-Level Security

**User Story:** As a platform operator, I want data access controlled at the database level, so that users can only access their own data and guests can only access public information.

#### Acceptance Criteria

1. THE Database SHALL enforce RLS policies on all tables
2. WHILE a user is authenticated, THE Database SHALL allow read and write access only to that user's own profiles, event_types, availability_rules, availability_overrides, and bookings
3. WHILE a request is unauthenticated, THE Database SHALL allow read-only access to active profiles and active event types for public booking pages
4. THE Database SHALL restrict slot_holds and bookings insert operations to server-side service role only
5. THE Database SHALL prevent unauthenticated users from inserting confirmed bookings directly

### Requirement 16: Email Notifications

**User Story:** As a host and guest, I want to receive email notifications for booking events, so that I stay informed about my schedule.

#### Acceptance Criteria

1. WHEN a booking is confirmed, THE Email_Service SHALL send a confirmation email to the guest with booking details
2. WHEN a booking is confirmed, THE Email_Service SHALL send a notification email to the host with guest and booking details
3. WHEN a booking is cancelled, THE Email_Service SHALL send a cancellation email to both the guest and the host
4. IF email delivery fails, THEN THE Email_Service SHALL log the failure without blocking or rolling back the booking operation
5. THE Email_Service SHALL provide an abstraction layer compatible with providers such as Resend or Postmark
6. WHILE in development mode, THE Email_Service SHALL log email content to the console instead of sending

### Requirement 17: Timezone Handling

**User Story:** As a user operating across timezones, I want all times displayed correctly in my local timezone, so that I never miss or misinterpret a booking time.

#### Acceptance Criteria

1. THE Booking_Engine SHALL store all booking start_at and end_at values as UTC timestamptz
2. THE Availability_Engine SHALL store recurring availability rules with local time and an IANA timezone identifier
3. WHEN displaying times to a guest, THE Public_Page_Service SHALL convert times to the guest's selected timezone
4. WHEN displaying times to a host, THE Dashboard SHALL convert times to the host's default_timezone
5. WHEN a guest has not selected a timezone, THE System SHALL default to the browser-detected IANA timezone
6. THE Availability_Engine SHALL correctly handle Daylight Saving Time transitions when computing available slots

### Requirement 18: Database Schema and Migrations

**User Story:** As a developer, I want a well-structured database with migrations, so that the schema is version-controlled and reproducible.

#### Acceptance Criteria

1. THE Database SHALL use UUID primary keys for all tables
2. THE Database SHALL include created_at and updated_at timestamps on all tables
3. THE Database SHALL enforce foreign key constraints between related tables (event_types → profiles, bookings → event_types, availability_rules → profiles, slot_holds → event_types)
4. THE Database SHALL include appropriate indexes for query performance on frequently accessed columns
5. THE Database SHALL include check constraints for data integrity (positive durations, valid statuses, start before end)
6. THE System SHALL store all migrations in the supabase/migrations directory

### Requirement 19: Error Handling

**User Story:** As a user, I want clear and helpful error messages, so that I understand what went wrong and how to proceed.

#### Acceptance Criteria

1. IF a guest navigates to a non-existent username or event slug, THEN THE System SHALL display a styled "not found" page
2. IF a guest attempts to book a slot that has been taken, THEN THE System SHALL display a "slot taken" message and refresh available slots
3. IF a hold expires before booking confirmation, THEN THE System SHALL inform the guest that the hold has expired and prompt re-selection
4. IF form validation fails, THEN THE System SHALL display field-level error messages indicating the specific validation issue
5. WHILE a user is not authenticated and attempts to access a protected route, THE System SHALL redirect to the login page with a return URL

### Requirement 20: Seed Data

**User Story:** As a developer, I want seed data available, so that I can quickly test the application without manual setup.

#### Acceptance Criteria

1. THE System SHALL provide a seed script that creates a demo user with a complete profile
2. THE System SHALL provide seed data including at least one event type for the demo user
3. THE System SHALL provide seed data including weekday availability rules (Monday-Friday, 9:00-17:00) for the demo user
4. THE System SHALL provide seed data including at least one sample confirmed booking

### Requirement 21: Developer Experience

**User Story:** As a developer, I want clear documentation and scripts, so that I can set up and run the project efficiently.

#### Acceptance Criteria

1. THE System SHALL provide npm scripts for: dev, build, start, lint, typecheck, and test
2. THE System SHALL provide a .env.example file listing required environment variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_APP_URL
3. THE System SHALL provide a README with setup instructions including Supabase project creation, environment configuration, migration execution, and development server startup
4. THE System SHALL enforce strict TypeScript with no implicit any

### Requirement 22: Server-Side Booking Operations

**User Story:** As a platform operator, I want all critical booking operations performed server-side, so that the system maintains data integrity and security.

#### Acceptance Criteria

1. THE Booking_Engine SHALL perform createSlotHold, confirmBooking, and cancelBooking operations exclusively through server-side API routes or Edge Functions
2. THE System SHALL never expose the Supabase service role key to client-side code
3. THE Booking_Engine SHALL validate all inputs server-side using Zod schemas before processing
4. THE Booking_Engine SHALL use the service role for database writes to bookings and slot_holds tables

### Requirement 23: Landing Page

**User Story:** As a visitor, I want to see an informative landing page, so that I understand what OpenSlot offers before signing up.

#### Acceptance Criteria

1. WHEN a visitor navigates to the root URL, THE System SHALL display a landing page with OpenSlot branding and a value proposition
2. THE System SHALL provide navigation links to sign up and log in from the landing page
3. THE System SHALL display the tagline "Share availability. Book time. Stay in sync." on the landing page
