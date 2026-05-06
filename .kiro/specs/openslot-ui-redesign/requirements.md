# Requirements Document

## Introduction

This document defines the requirements for a comprehensive UI redesign of OpenSlot, a SaaS scheduling platform. The redesign covers all user-facing screens — from the marketing landing page through authentication, onboarding, the dashboard experience, and the public booking flow. The goal is to establish a modern, accessible, and cohesive visual system using a defined brand palette, consistent component library, and responsive layouts that work across desktop and mobile devices.

The existing application is built with Next.js 14+ (App Router), TypeScript, Tailwind CSS, and shadcn/ui. This redesign enhances the existing implementation without changing the underlying data model or API layer.

## Glossary

- **Design_System**: The collection of design tokens (colors, typography, spacing, radii, shadows), reusable UI components, and layout patterns that define the visual language of OpenSlot
- **Landing_Page**: The public marketing page at the root URL that introduces OpenSlot to prospective users
- **Signup_Page**: The registration page where new users create an OpenSlot account
- **Login_Page**: The authentication page where existing users sign in with email and password
- **Onboarding_Flow**: The multi-step guided experience that new users complete after signup to configure their profile, availability, first event type, and booking link
- **Dashboard_Overview**: The authenticated home screen showing key metrics, upcoming bookings, and setup progress
- **Availability_Editor**: The page where hosts configure their weekly recurring schedule, timezone, and date overrides
- **Event_Types_List**: The page displaying all event types a host has created, with actions to manage them
- **Event_Type_Editor**: The form page for creating or editing an event type with a live booking preview
- **Bookings_Dashboard**: The page listing all bookings with tabs for upcoming, past, and cancelled states
- **Public_Profile_Page**: The public-facing page showing a host's profile and available event types
- **Public_Booking_Page**: The Calendly-style page where guests select a date, time slot, and submit their booking
- **Guest_Cancellation_Page**: The page where guests cancel a booking using a unique token link
- **Settings_Page**: The page for managing account preferences, notifications, and integration placeholders
- **Component_Library**: The set of reusable UI primitives (Button, Input, Card, Dialog, etc.) built on shadcn/ui with OpenSlot brand styling
- **Responsive_Layout**: A layout that adapts gracefully between desktop (1024px+), tablet (768px–1023px), and mobile (<768px) viewports
- **Brand_Palette**: The defined set of colors including Background (#F8FAFC), Surface (#FFFFFF), Border (#E2E8F0), Primary text (#0F172A), Secondary text (#475569), Muted text (#64748B), Brand blue (#2563EB), Brand soft (#EFF6FF), Success (#059669), Warning (#D97706), and Danger (#DC2626)
- **WCAG_AA**: Web Content Accessibility Guidelines level AA, requiring a minimum contrast ratio of 4.5:1 for normal text and 3:1 for large text
- **Sidebar_Navigation**: The persistent left-side navigation panel in the authenticated dashboard layout
- **Hold_Timer**: A countdown indicator shown during the booking flow that displays remaining time before a held slot expires
- **Empty_State**: A placeholder UI shown when a list or section has no data, providing guidance on next steps

## Requirements

### Requirement 1: Design System Foundation

**User Story:** As a developer, I want a centralized design token system and Tailwind configuration, so that all screens render consistently with the OpenSlot brand.

#### Acceptance Criteria

1. THE Design_System SHALL define CSS custom properties for all Brand_Palette colors mapped to Tailwind's HSL variable convention in globals.css
2. THE Design_System SHALL configure the primary color token to map to Brand blue (#2563EB) with appropriate foreground contrast
3. THE Design_System SHALL set the default border radius to 0.75rem for cards and 0.5rem for inputs and buttons
4. THE Design_System SHALL use Inter as the primary font family loaded via next/font/google with the latin subset
5. THE Design_System SHALL define shadow tokens: shadow-sm (subtle card elevation), shadow-md (hover/focus elevation), and shadow-lg (modal/dialog elevation)
6. THE Design_System SHALL define spacing scale values that produce 8px-grid-aligned layouts (multiples of 0.5rem)
7. THE Design_System SHALL ensure all text color and background color pairings meet WCAG_AA contrast requirements

### Requirement 2: Reusable Component Library

**User Story:** As a developer, I want a library of styled, accessible UI components, so that I can compose screens quickly and consistently.

#### Acceptance Criteria

1. THE Component_Library SHALL provide a Button component with variants: default (Brand blue fill), secondary (slate outline), ghost (transparent), destructive (Danger fill), and link (underline)
2. THE Component_Library SHALL provide a Button component with sizes: sm (h-8), default (h-10), lg (h-12), and icon (square)
3. THE Component_Library SHALL provide Input, Textarea, and Select components styled with Border color, rounded-lg, and focus ring using Brand blue at 50% opacity
4. THE Component_Library SHALL provide a Switch component with an accessible label, Brand blue active state, and slate inactive state
5. THE Component_Library SHALL provide a Badge component with variants: default (Brand blue), success (Success green), warning (Warning amber), danger (Danger red), and outline (border only)
6. THE Component_Library SHALL provide Card, Dialog, Drawer, Dropdown, and Tabs container components with consistent border, radius, and shadow styling
7. THE Component_Library SHALL provide a Toast notification component with variants for success, error, warning, and info states
8. THE Component_Library SHALL provide an Avatar component that displays a user image or falls back to initials with a Brand soft background
9. THE Component_Library SHALL provide an Empty_State component displaying an icon, heading, description, and optional action button
10. THE Component_Library SHALL provide a DatePicker component wrapping react-day-picker with Brand blue selected-day styling
11. THE Component_Library SHALL provide a TimeSlotButton component displaying a time value with hover and selected states using Brand blue
12. THE Component_Library SHALL provide a TimezoneSelector component with a searchable dropdown of IANA timezone identifiers
13. THE Component_Library SHALL provide a BookingSummaryCard component displaying host name, event title, date, time, duration, and timezone
14. THE Component_Library SHALL provide an EventTypeCard component displaying title, duration badge, location, status indicator, and action buttons
15. THE Component_Library SHALL provide an AvailabilityDayRow component with a day toggle, time range inputs, and an add-interval button
16. WHEN a Component_Library component receives keyboard focus, THE Component_Library SHALL display a visible focus indicator ring

### Requirement 3: Landing Page

**User Story:** As a visitor, I want to see a compelling marketing page, so that I understand what OpenSlot does and can sign up.

#### Acceptance Criteria

1. THE Landing_Page SHALL display a navigation bar containing the OpenSlot logo, links to Features, Use Cases, and Pricing sections, a Log In link, and a "Create your OpenSlot" primary button
2. THE Landing_Page SHALL display a hero section with the headline "Scheduling that stays open.", the subheadline "OpenSlot helps anyone share availability, prevent double-booking, and let guests book time from any timezone.", and two CTA buttons: "Create your OpenSlot" (primary) and "View demo page" (secondary outline)
3. THE Landing_Page SHALL display a product preview image or component below the hero showing a mock booking page with a calendar and time slots
4. THE Landing_Page SHALL display a feature cards section with four cards: "Share availability", "Prevent double-booking", "Timezone aware", and "Built to grow", each with an icon, title, and short description
5. THE Landing_Page SHALL display a "How it works" section with numbered steps explaining the user flow
6. THE Landing_Page SHALL display a final CTA section with a heading, supporting text, and a "Create your OpenSlot" button
7. THE Landing_Page SHALL use the Brand_Palette background color (#F8FAFC) for the page body and Surface color (#FFFFFF) for card and section backgrounds
8. WHEN the viewport width is less than 768px, THE Landing_Page SHALL stack the navigation links into a mobile hamburger menu

### Requirement 4: Signup Page

**User Story:** As a new user, I want to create an account quickly, so that I can start setting up my scheduling page.

#### Acceptance Criteria

1. THE Signup_Page SHALL display a two-column layout with the signup form on the left and a brand panel on the right
2. THE Signup_Page SHALL display a form with fields for full name, email address, and password, each with visible labels
3. THE Signup_Page SHALL display a "Create account" primary button that submits the form
4. THE Signup_Page SHALL display a link to the Login_Page with the text "Already have an account? Log in"
5. THE Signup_Page SHALL display a brand panel containing the OpenSlot logo, a tagline, and a decorative booking preview illustration
6. WHEN the viewport width is less than 768px, THE Signup_Page SHALL hide the brand panel and display only the form in a single-column layout
7. IF the form submission fails due to validation errors, THEN THE Signup_Page SHALL display inline error messages below the relevant fields in Danger color

### Requirement 5: Login Page

**User Story:** As a returning user, I want to sign in to my account, so that I can manage my scheduling.

#### Acceptance Criteria

1. THE Login_Page SHALL display a centered card containing email and password fields with visible labels
2. THE Login_Page SHALL display a "Log in" primary button that submits the form
3. THE Login_Page SHALL display a "Forgot password?" link below the password field
4. THE Login_Page SHALL display a link to the Signup_Page with the text "Don't have an account? Sign up"
5. IF the login attempt fails, THEN THE Login_Page SHALL display an error message above the form in Danger color without revealing whether the email or password was incorrect

### Requirement 6: Onboarding Flow

**User Story:** As a new user, I want guided setup steps after signup, so that I can configure my profile and start receiving bookings quickly.

#### Acceptance Criteria

1. THE Onboarding_Flow SHALL display a progress indicator showing four steps: Create public profile, Set availability, Create first event type, and Share booking link
2. WHEN the user is on Step 1, THE Onboarding_Flow SHALL display a form for entering display name, username (URL slug), bio, and optional avatar upload
3. WHEN the user is on Step 2, THE Onboarding_Flow SHALL display the Availability_Editor component pre-filled with Monday–Friday 9:00–17:00 defaults
4. WHEN the user is on Step 3, THE Onboarding_Flow SHALL display a simplified event type creation form with title, duration selector, and location field
5. WHEN the user is on Step 4, THE Onboarding_Flow SHALL display the generated booking link with a copy-to-clipboard button and a "Go to dashboard" primary button
6. THE Onboarding_Flow SHALL allow the user to navigate back to previous steps without losing entered data
7. WHEN the viewport width is less than 768px, THE Onboarding_Flow SHALL display steps in a single-column stacked layout with a compact progress bar

### Requirement 7: Dashboard Overview

**User Story:** As a host, I want a dashboard home screen, so that I can see my key metrics and upcoming bookings at a glance.

#### Acceptance Criteria

1. THE Dashboard_Overview SHALL display a Sidebar_Navigation with links to Dashboard, Event Types, Availability, Bookings, and Settings, plus the OpenSlot logo and user profile section
2. THE Dashboard_Overview SHALL display a top bar with a page title, search input, and notification bell icon
3. THE Dashboard_Overview SHALL display metric cards for: Upcoming bookings count, Active event types count, Booking link (copyable), and Availability status (active/inactive)
4. THE Dashboard_Overview SHALL display a "Next bookings" list showing up to 5 upcoming confirmed bookings with guest name, event title, date, time, and a join/view action
5. THE Dashboard_Overview SHALL display a setup checklist showing completion status for profile, availability, event type, and first booking
6. THE Dashboard_Overview SHALL display a public profile preview card with the host's avatar, name, username, and a "View public page" link
7. WHEN the viewport width is less than 1024px, THE Dashboard_Overview SHALL collapse the Sidebar_Navigation into a hamburger-triggered drawer

### Requirement 8: Availability Editor

**User Story:** As a host, I want to configure my weekly schedule and overrides, so that guests only see times when I am actually available.

#### Acceptance Criteria

1. THE Availability_Editor SHALL display seven AvailabilityDayRow components, one for each day Monday through Sunday
2. THE Availability_Editor SHALL allow toggling each day on or off using a Switch component
3. THE Availability_Editor SHALL allow setting one or more time intervals per day with start and end time inputs
4. THE Availability_Editor SHALL display an "Add interval" button on each active day to add additional time ranges
5. THE Availability_Editor SHALL display a TimezoneSelector component showing the currently selected timezone
6. THE Availability_Editor SHALL display a "Date overrides" section where the host can add specific dates with custom availability or mark them as unavailable
7. THE Availability_Editor SHALL display a "Preview" panel showing the next 5 available time slots based on current settings
8. WHEN the user saves availability changes, THE Availability_Editor SHALL display a success Toast notification
9. IF a time interval has an end time earlier than or equal to its start time, THEN THE Availability_Editor SHALL display an inline validation error in Danger color

### Requirement 9: Event Types List

**User Story:** As a host, I want to see all my event types in one place, so that I can manage and share them.

#### Acceptance Criteria

1. THE Event_Types_List SHALL display EventTypeCard components in a responsive grid layout (1 column on mobile, 2 on tablet, 3 on desktop)
2. THE Event_Types_List SHALL display on each EventTypeCard: title, description (truncated to 2 lines), duration badge, location, active/draft status indicator, and URL slug
3. THE Event_Types_List SHALL provide action buttons on each card: Copy link, Preview, Edit, and a More dropdown with Delete option
4. THE Event_Types_List SHALL display a "Create event type" primary button in the page header
5. WHEN no event types exist, THE Event_Types_List SHALL display an Empty_State component with an illustration, heading "No event types yet", description, and a "Create your first event type" button
6. WHEN the user clicks "Copy link", THE Event_Types_List SHALL copy the booking URL to the clipboard and display a success Toast

### Requirement 10: Event Type Editor

**User Story:** As a host, I want to create and edit event types with a live preview, so that I can see how the booking page will look to guests.

#### Acceptance Criteria

1. THE Event_Type_Editor SHALL display a two-column layout with the form on the left and a live booking preview on the right
2. THE Event_Type_Editor SHALL organize the form into collapsible sections: Basics (title, slug, description, color), Duration and buffers (duration, buffer before/after), Location (in-person, phone, video link), Scheduling limits (minimum notice, max days ahead, max bookings per day), Invitee questions (custom fields), and Confirmation (redirect URL, confirmation message)
3. THE Event_Type_Editor SHALL update the live booking preview in real-time as the user modifies form fields
4. THE Event_Type_Editor SHALL display a sticky footer with "Cancel" and "Save" buttons that remains visible during scrolling
5. WHEN the viewport width is less than 1024px, THE Event_Type_Editor SHALL stack the form above the preview in a single-column layout with the preview accessible via a toggle button
6. IF required fields are empty on save, THEN THE Event_Type_Editor SHALL display inline validation errors and prevent submission

### Requirement 11: Bookings Dashboard

**User Story:** As a host, I want to view and manage all my bookings, so that I can track upcoming meetings and handle cancellations.

#### Acceptance Criteria

1. THE Bookings_Dashboard SHALL display Tabs for Upcoming, Past, and Cancelled bookings
2. THE Bookings_Dashboard SHALL display a filter bar with date range and event type filters
3. WHILE the viewport width is 1024px or greater, THE Bookings_Dashboard SHALL display bookings in a table with columns: Guest, Event type, Date and time, Status, and Actions
4. WHILE the viewport width is less than 1024px, THE Bookings_Dashboard SHALL display bookings as stacked cards with guest name, event title, date/time, and status badge
5. WHEN the user clicks a booking row or card, THE Bookings_Dashboard SHALL open a Drawer showing full booking details including guest name, email, event type, date, time, timezone, notes, and status
6. WHEN the user clicks "Cancel booking" in the detail Drawer, THE Bookings_Dashboard SHALL open a Dialog requesting a cancellation reason with "Confirm cancellation" (destructive) and "Keep booking" buttons
7. WHEN no bookings exist in the active tab, THE Bookings_Dashboard SHALL display an Empty_State component with contextual messaging

### Requirement 12: Public Profile Page

**User Story:** As a guest, I want to see a host's public profile and available event types, so that I can choose what to book.

#### Acceptance Criteria

1. THE Public_Profile_Page SHALL display a host profile card with avatar, display name, bio, and timezone
2. THE Public_Profile_Page SHALL display a list of active EventTypeCard components showing title, duration, description, and a "Book" button
3. THE Public_Profile_Page SHALL use a centered single-column layout with a maximum width of 640px
4. WHEN the viewport width is less than 768px, THE Public_Profile_Page SHALL display full-width cards with reduced padding
5. WHEN no active event types exist, THE Public_Profile_Page SHALL display a message "No available event types" to the guest

### Requirement 13: Public Booking Page

**User Story:** As a guest, I want to select a date and time slot and submit my booking, so that I can schedule time with the host.

#### Acceptance Criteria

1. THE Public_Booking_Page SHALL display a two-panel layout: left panel showing host avatar, name, event title, duration, and location; right panel showing the calendar and time slot selection
2. THE Public_Booking_Page SHALL display a DatePicker calendar highlighting dates that have available slots
3. WHEN the guest selects a date, THE Public_Booking_Page SHALL display available TimeSlotButton components for that date
4. THE Public_Booking_Page SHALL display a TimezoneSelector allowing the guest to change their viewing timezone
5. WHEN the guest selects a time slot, THE Public_Booking_Page SHALL display a BookingSummaryCard and a booking form with fields for name, email, and optional notes
6. WHEN a slot is held, THE Public_Booking_Page SHALL display a Hold_Timer countdown showing remaining seconds before the hold expires
7. WHEN the booking is confirmed, THE Public_Booking_Page SHALL display a confirmation screen with a success icon, booking details, and an "Add to calendar" link
8. WHEN the viewport width is less than 768px, THE Public_Booking_Page SHALL stack the left and right panels vertically with the host details collapsed into a compact header
9. IF the selected slot becomes unavailable during the booking process, THEN THE Public_Booking_Page SHALL display a warning message and prompt the guest to select a different slot

### Requirement 14: Guest Cancellation Page

**User Story:** As a guest, I want to cancel my booking using a link from my confirmation email, so that I can free up the host's time.

#### Acceptance Criteria

1. THE Guest_Cancellation_Page SHALL display booking details including event title, host name, date, time, and timezone
2. THE Guest_Cancellation_Page SHALL display an optional reason Textarea and a "Cancel booking" destructive button
3. WHEN the guest confirms cancellation, THE Guest_Cancellation_Page SHALL display a confirmation message with a success state
4. IF the booking has already been cancelled, THEN THE Guest_Cancellation_Page SHALL display an "Already cancelled" state with the cancellation date
5. IF the cancellation token is invalid or expired, THEN THE Guest_Cancellation_Page SHALL display an error state with a message "This cancellation link is no longer valid"

### Requirement 15: Settings Page

**User Story:** As a host, I want to manage my account settings and preferences, so that I can customize my OpenSlot experience.

#### Acceptance Criteria

1. THE Settings_Page SHALL display a tabbed interface with sections: Account, Preferences, Notifications, and Integrations
2. THE Settings_Page SHALL display Account settings including name, email, password change, and account deletion
3. THE Settings_Page SHALL display Preferences settings including default timezone, date format, and time format (12h/24h)
4. THE Settings_Page SHALL display Notifications settings with toggles for email notifications on new bookings, cancellations, and reminders
5. THE Settings_Page SHALL display an Integrations section with placeholder cards for Google Calendar, Microsoft Outlook, Zoom, and Stripe showing "Coming soon" badges
6. WHEN the user saves settings changes, THE Settings_Page SHALL display a success Toast notification

### Requirement 16: Responsive Layout System

**User Story:** As a user on any device, I want the interface to adapt to my screen size, so that I can use OpenSlot comfortably on desktop, tablet, and mobile.

#### Acceptance Criteria

1. THE Responsive_Layout SHALL define breakpoints at 768px (tablet) and 1024px (desktop) consistent with Tailwind's md and lg prefixes
2. WHILE the viewport width is less than 1024px, THE Responsive_Layout SHALL replace the persistent Sidebar_Navigation with a collapsible drawer triggered by a hamburger icon
3. WHILE the viewport width is less than 768px, THE Responsive_Layout SHALL stack multi-column layouts into single-column layouts
4. THE Responsive_Layout SHALL ensure all interactive targets (buttons, links, toggles) have a minimum touch target size of 44x44 pixels on viewports below 768px
5. THE Responsive_Layout SHALL ensure horizontal scrolling does not occur at any supported viewport width (320px minimum)

### Requirement 17: Accessibility Compliance

**User Story:** As a user with assistive technology, I want the interface to be fully navigable and understandable, so that I can use OpenSlot independently.

#### Acceptance Criteria

1. THE Design_System SHALL ensure all interactive elements are reachable and operable via keyboard navigation alone
2. THE Design_System SHALL provide visible focus indicators on all focusable elements using a 2px Brand blue ring with 2px offset
3. THE Design_System SHALL associate all form inputs with visible labels using the HTML label element or aria-label attribute
4. THE Design_System SHALL use semantic HTML landmarks (header, nav, main, aside, footer) to structure page regions
5. THE Design_System SHALL ensure all images and icons have appropriate alt text or aria-hidden="true" for decorative elements
6. THE Design_System SHALL ensure color is not the sole means of conveying information (status indicators include text or icons alongside color)
7. THE Design_System SHALL support reduced-motion preferences by disabling animations when prefers-reduced-motion is set to reduce
