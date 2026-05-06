# Implementation Plan: OpenSlot UI Redesign

## Overview

This plan implements a comprehensive UI redesign for OpenSlot following a bottom-up approach: design tokens → UI primitives → domain components → layout components → page compositions → tests. Each task builds incrementally on previous work, ensuring no orphaned code. The implementation enhances existing shadcn/ui components and creates new domain-specific components without modifying the data model or API layer.

## Tasks

- [x] 1. Set up design token system and Tailwind configuration
  - [x] 1.1 Update CSS custom properties in `src/app/globals.css`
    - Replace existing `:root` block with the full Brand Palette HSL variables
    - Add `--radius-input`, `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--success`, `--success-foreground`, `--warning`, `--warning-foreground` tokens
    - Add `prefers-reduced-motion` media query to disable animations
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 17.7_

  - [x] 1.2 Update `tailwind.config.ts` with extended theme
    - Add `success` and `warning` color mappings
    - Update `borderRadius` to use `--radius` (0.75rem) and `--radius-input` (0.5rem)
    - Add `boxShadow` tokens referencing CSS variables
    - Add `fontFamily.sans` referencing `--font-inter`
    - Add `fade-in` and `slide-in-right` keyframes and animations
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 1.3 Write property test for WCAG AA contrast compliance
    - **Property 1: WCAG AA Contrast Compliance**
    - Create `src/lib/__tests__/design-tokens.property.test.ts`
    - Test all foreground/background color pairings meet 4.5:1 for normal text and 3:1 for large text
    - **Validates: Requirements 1.7**

- [x] 2. Enhance existing UI primitive components
  - [x] 2.1 Enhance `src/components/ui/button.tsx`
    - Update `secondary` variant to use slate outline style (`border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`)
    - Update `sm` size to `h-8 rounded-md px-3 text-xs`
    - Update `lg` size to `h-12 rounded-md px-6 text-base`
    - Ensure focus-visible ring classes are present
    - _Requirements: 2.1, 2.2, 2.16, 17.2_

  - [x] 2.2 Enhance `src/components/ui/badge.tsx`
    - Add `success`, `warning`, `danger`, and `secondary` variants
    - Update border-radius to `rounded-sm`
    - _Requirements: 2.5_

  - [x] 2.3 Enhance `src/components/ui/card.tsx`
    - Update border-radius to `rounded-lg`
    - Ensure `border-border` and `shadow-sm` classes are applied
    - _Requirements: 2.6_

  - [x] 2.4 Enhance `src/components/ui/input.tsx`
    - Update styling with `rounded-md` (using --radius-input), `border-border`, and focus ring using `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`
    - _Requirements: 2.3, 2.16_

  - [x] 2.5 Enhance `src/components/ui/calendar.tsx` (DatePicker)
    - Update selected-day styling to use Brand blue (`bg-primary text-primary-foreground`)
    - Ensure focus indicators are present on day cells
    - _Requirements: 2.10_

- [x] 3. Create new UI primitive components
  - [x] 3.1 Create `src/components/ui/avatar.tsx`
    - Implement Avatar component with `src`, `alt`, `fallback`, `size` props
    - Sizes: sm (32px), md (40px), lg (64px)
    - Display image when `src` is provided, otherwise show initials on `bg-accent` background
    - Generate initials from name (first + last initial, uppercase)
    - _Requirements: 2.8_

  - [x] 3.2 Write property test for Avatar initials generation
    - **Property 3: Avatar Initials Generation**
    - Create `src/components/ui/__tests__/avatar.property.test.ts`
    - Test that any non-empty name produces 1–2 uppercase alphabetic characters
    - **Validates: Requirements 2.8**

  - [x] 3.3 Create `src/components/ui/switch.tsx`
    - Implement accessible Switch component with label support
    - Brand blue active state, slate inactive state
    - Include `focus-visible:ring-2` styling
    - _Requirements: 2.4, 2.16_

  - [x] 3.4 Create `src/components/ui/tabs.tsx`
    - Implement Tabs component with consistent border, radius, and styling
    - Support keyboard navigation between tabs
    - _Requirements: 2.6_

  - [x] 3.5 Create `src/components/ui/drawer.tsx`
    - Implement Drawer component with slide-in animation
    - Include border, radius, and shadow styling consistent with design system
    - Support Escape key to close
    - _Requirements: 2.6_

  - [x] 3.6 Create `src/components/ui/textarea.tsx`
    - Implement Textarea with `border-border`, `rounded-md`, and focus ring styling
    - _Requirements: 2.3, 2.16_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Create booking domain components
  - [x] 5.1 Create `src/components/booking/time-slot-button.tsx`
    - Implement TimeSlotButton with `time`, `selected`, `disabled`, `loading`, `onClick` props
    - Selected state uses Brand blue background
    - Hover state uses accent background
    - Minimum touch target 44x44px on mobile
    - _Requirements: 2.11, 16.4_

  - [x] 5.2 Create `src/components/booking/timezone-selector.tsx`
    - Implement searchable dropdown of IANA timezone identifiers
    - Filter function returns timezones matching query as case-insensitive substring
    - _Requirements: 2.12_

  - [x] 5.3 Write property test for TimezoneSelector filter
    - **Property 4: Timezone Filter Correctness**
    - Create `src/components/booking/__tests__/timezone-selector.property.test.ts`
    - Test that all returned options contain the query as case-insensitive substring
    - **Validates: Requirements 2.12**

  - [x] 5.4 Create `src/components/booking/booking-summary-card.tsx`
    - Implement BookingSummaryCard displaying hostName, eventTitle, date, time, duration, timezone
    - All six values must appear as visible text
    - _Requirements: 2.13_

  - [x] 5.5 Write property test for BookingSummaryCard completeness
    - **Property 5: BookingSummaryCard Completeness**
    - Create `src/components/booking/__tests__/booking-summary-card.property.test.ts`
    - Test that all provided props appear in rendered output
    - **Validates: Requirements 2.13**

  - [x] 5.6 Create `src/components/booking/hold-timer.tsx`
    - Implement HoldTimer with `expiresAt` and `onExpired` props
    - Compute remaining seconds as `max(0, floor((expiresAt - now) / 1000))`
    - Invoke `onExpired` callback when countdown reaches 0
    - Display countdown in a visible format
    - _Requirements: 13.6_

  - [x] 5.7 Write property test for HoldTimer countdown computation
    - **Property 11: Hold Timer Countdown Computation**
    - Create `src/components/booking/__tests__/hold-timer.property.test.ts`
    - Test countdown computation formula for arbitrary future timestamps
    - **Validates: Requirements 13.6**

- [x] 6. Create dashboard domain components
  - [x] 6.1 Create `src/components/dashboard/metric-card.tsx`
    - Implement MetricCard with `title`, `value`, `icon`, optional `action` props
    - Use Card styling with consistent border, radius, shadow
    - _Requirements: 7.3_

  - [x] 6.2 Create `src/components/dashboard/event-type-card.tsx`
    - Implement EventTypeCard with title, description (truncated 2 lines), duration badge, location, active/draft status, slug
    - Include action buttons: Copy link, Preview, Edit, More dropdown with Delete
    - _Requirements: 2.14, 9.2, 9.3_

  - [x] 6.3 Write property test for EventTypeCard completeness
    - **Property 6: EventTypeCard Completeness**
    - Create `src/components/dashboard/__tests__/event-type-card.property.test.ts`
    - Test that title, duration, location, and status indicator are present in output
    - **Validates: Requirements 2.14**

  - [x] 6.4 Create `src/components/dashboard/availability-day-row.tsx`
    - Implement AvailabilityDayRow with day toggle (Switch), time interval inputs, add-interval button
    - Display validation error when end time ≤ start time
    - _Requirements: 2.15, 8.1, 8.2, 8.3, 8.4, 8.9_

  - [x] 6.5 Write property test for time interval validation
    - **Property 10: Time Interval Validation**
    - Create `src/components/dashboard/__tests__/availability-day-row.property.test.ts`
    - Test that invalid intervals (end ≤ start) always produce a validation error
    - **Validates: Requirements 8.9**

  - [x] 6.6 Create `src/components/dashboard/top-bar.tsx`
    - Implement TopBar with `title` and optional `onMenuToggle` props
    - Include search input and notification bell icon
    - _Requirements: 7.2_

  - [x] 6.7 Create `src/components/shared/empty-state.tsx`
    - Implement EmptyState with `icon`, `heading`, `description`, optional `action` props
    - _Requirements: 2.9_

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Create layout components and enhance navigation
  - [x] 8.1 Enhance `src/components/dashboard/sidebar-nav.tsx`
    - Add OpenSlot logo at top
    - Add navigation links: Dashboard, Event Types, Availability, Bookings, Settings
    - Add user profile section at bottom with avatar, name, email
    - Style with `w-64` fixed width, border-right, background
    - _Requirements: 7.1_

  - [x] 8.2 Create `src/components/shared/mobile-drawer.tsx`
    - Implement mobile navigation drawer triggered by hamburger icon
    - Contains same navigation items as sidebar
    - Closes on Escape key and outside click
    - _Requirements: 7.7, 16.2_

  - [x] 8.3 Update `src/app/(dashboard)/layout.tsx`
    - Integrate TopBar component
    - Add responsive behavior: persistent sidebar on desktop (≥1024px), hamburger drawer on mobile/tablet
    - Use semantic landmarks: `<aside>` for sidebar, `<main>` for content
    - _Requirements: 7.1, 7.2, 7.7, 16.2, 17.4_

  - [x] 8.4 Update `src/app/(auth)/layout.tsx`
    - Implement two-column layout for signup (form left, brand panel right)
    - Implement centered card layout for login
    - Hide brand panel on mobile (<768px)
    - _Requirements: 4.1, 4.5, 4.6, 5.1, 16.3_

  - [x] 8.5 Update `src/app/(public)/layout.tsx`
    - Set centered single-column layout with max-w-2xl (640px)
    - Use semantic `<main>` landmark
    - _Requirements: 12.3, 17.4_

- [x] 9. Create landing page components and page
  - [x] 9.1 Create `src/components/landing/navbar.tsx`
    - Implement navigation bar with logo, section links (Features, Use Cases, Pricing), Log In link, "Create your OpenSlot" CTA button
    - Mobile: collapse links into hamburger menu on <768px
    - _Requirements: 3.1, 3.8_

  - [x] 9.2 Create `src/components/landing/hero-section.tsx`
    - Implement hero with headline "Scheduling that stays open.", subheadline, two CTA buttons (primary + secondary outline)
    - Include product preview image/component below
    - _Requirements: 3.2, 3.3_

  - [x] 9.3 Create `src/components/landing/feature-cards.tsx`
    - Implement 4-card grid: "Share availability", "Prevent double-booking", "Timezone aware", "Built to grow"
    - Each card has icon, title, description
    - Responsive: 4-col → 2-col → 1-col
    - _Requirements: 3.4_

  - [x] 9.4 Create `src/components/landing/how-it-works.tsx`
    - Implement numbered steps section explaining user flow
    - _Requirements: 3.5_

  - [x] 9.5 Create `src/components/landing/cta-section.tsx`
    - Implement final CTA with heading, supporting text, and primary button
    - _Requirements: 3.6_

  - [x] 9.6 Update `src/app/page.tsx` (Landing Page)
    - Compose Navbar, HeroSection, FeatureCards, HowItWorks, CTASection
    - Apply Brand_Palette background (#F8FAFC) and Surface (#FFFFFF) for sections
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 10. Implement authentication pages
  - [x] 10.1 Update `src/app/(auth)/signup/page.tsx`
    - Implement form with full name, email, password fields with visible labels
    - "Create account" primary button
    - Link to login page
    - Inline validation errors in Danger color
    - Brand panel with logo, tagline, decorative illustration
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.7_

  - [x] 10.2 Update `src/app/(auth)/login/page.tsx`
    - Implement centered card with email and password fields
    - "Log in" primary button
    - "Forgot password?" link
    - Link to signup page
    - Generic error message on failure (never reveal which credential failed)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 11. Implement onboarding flow
  - [x] 11.1 Create `src/app/(dashboard)/onboarding/page.tsx`
    - Implement 4-step progress indicator
    - Step 1: Profile form (display name, username, bio, avatar upload)
    - Step 2: Availability editor with Mon–Fri 9:00–17:00 defaults
    - Step 3: Simplified event type creation (title, duration, location)
    - Step 4: Generated booking link with copy button + "Go to dashboard" button
    - Allow back navigation without data loss
    - Mobile: single-column stacked layout with compact progress bar
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [x] 12. Implement dashboard overview page
  - [x] 12.1 Update `src/app/(dashboard)/dashboard/page.tsx`
    - Display 4 MetricCards: upcoming bookings count, active event types count, booking link (copyable), availability status
    - Display "Next bookings" list (up to 5 items) with guest name, event title, date, time, action
    - Display setup checklist with completion status
    - Display public profile preview card
    - _Requirements: 7.3, 7.4, 7.5, 7.6_

  - [x] 12.2 Write property test for bounded booking list display
    - **Property 9: Bounded Booking List Display**
    - Create `src/components/dashboard/__tests__/dashboard-bookings.property.test.ts`
    - Test that the list displays exactly min(N, 5) items for any N ≥ 0
    - **Validates: Requirements 7.4**

- [x] 13. Implement availability editor page
  - [x] 13.1 Update `src/app/(dashboard)/availability/page.tsx`
    - Compose 7 AvailabilityDayRow components (Monday–Sunday)
    - Include TimezoneSelector showing current timezone
    - Add "Date overrides" section for custom dates
    - Add "Preview" panel showing next 5 available slots
    - Display success Toast on save
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

- [x] 14. Implement event types pages
  - [x] 14.1 Update `src/app/(dashboard)/event-types/page.tsx` (Event Types List)
    - Display EventTypeCards in responsive grid (1-col mobile, 2-col tablet, 3-col desktop)
    - "Create event type" button in page header
    - Copy link action with success Toast
    - Empty state when no event types exist
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x] 14.2 Update event type editor pages (`new/page.tsx` and `[id]/edit/page.tsx`)
    - Two-column layout: form (left) + live booking preview (right)
    - Collapsible form sections: Basics, Duration/buffers, Location, Scheduling limits, Invitee questions, Confirmation
    - Real-time preview updates
    - Sticky footer with Cancel and Save buttons
    - Mobile: single-column with preview toggle
    - Inline validation errors on required fields
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

- [x] 15. Implement bookings dashboard page
  - [x] 15.1 Update `src/app/(dashboard)/bookings/page.tsx`
    - Implement Tabs for Upcoming, Past, Cancelled
    - Filter bar with date range and event type filters
    - Desktop (≥1024px): table layout with Guest, Event type, Date/time, Status, Actions columns
    - Mobile (<1024px): stacked card layout
    - Click row/card opens Drawer with full booking details
    - Cancel booking Dialog with reason textarea and destructive confirm button
    - Empty states per tab
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

- [x] 16. Implement public-facing pages
  - [x] 16.1 Update `src/app/(public)/[username]/page.tsx` (Public Profile)
    - Display host profile card with avatar, name, bio, timezone
    - List active EventTypeCards with "Book" button
    - Centered single-column, max-w-2xl
    - Full-width cards with reduced padding on mobile
    - "No available event types" message when empty
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [x] 16.2 Update `src/app/(public)/[username]/[eventSlug]/page.tsx` (Public Booking)
    - Two-panel layout: host info (left) + calendar/slots (right)
    - DatePicker highlighting available dates
    - TimeSlotButtons for selected date
    - TimezoneSelector for guest timezone
    - BookingSummaryCard + booking form after slot selection
    - HoldTimer countdown during booking
    - Confirmation screen with success icon and "Add to calendar" link
    - Mobile: stack panels vertically, compact host header
    - Warning message if slot becomes unavailable
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9_

  - [x] 16.3 Update `src/app/booking/cancel/[token]/page.tsx` (Guest Cancellation)
    - Display booking details (event title, host, date, time, timezone)
    - Optional reason Textarea + "Cancel booking" destructive button
    - Confirmation message on success
    - "Already cancelled" state with cancellation date
    - Error state for invalid/expired token
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

- [x] 17. Implement settings page
  - [x] 17.1 Create `src/app/(dashboard)/settings/page.tsx`
    - Tabbed interface: Account, Preferences, Notifications, Integrations
    - Account: name, email, password change, account deletion
    - Preferences: default timezone, date format, time format (12h/24h)
    - Notifications: toggles for new bookings, cancellations, reminders
    - Integrations: placeholder cards (Google Calendar, Outlook, Zoom, Stripe) with "Coming soon" badges
    - Success Toast on save
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_

- [x] 18. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 19. Accessibility and responsive polish
  - [x] 19.1 Add semantic HTML landmarks across all layouts
    - Ensure `<header>`, `<nav aria-label>`, `<main>`, `<aside>`, `<footer>` are used in all layout files
    - _Requirements: 17.4_

  - [x] 19.2 Audit and fix form label associations
    - Ensure every `<input>`, `<textarea>`, `<select>` has a paired `<Label htmlFor>` or `aria-label`
    - _Requirements: 17.3_

  - [x] 19.3 Audit images and icons for accessibility
    - Add `alt` text to informative images
    - Add `aria-hidden="true"` to decorative SVG icons
    - _Requirements: 17.5_

  - [x] 19.4 Ensure color is not sole information conveyor
    - Verify status badges include text labels alongside color
    - Verify error states have text messages, not just red borders
    - _Requirements: 17.6_

  - [x] 19.5 Ensure minimum touch targets on mobile
    - Verify all interactive elements have `min-h-[44px] min-w-[44px]` on viewports <768px
    - _Requirements: 16.4_

  - [x] 19.6 Verify no horizontal scrolling at 320px minimum width
    - Test all pages at 320px viewport width
    - _Requirements: 16.5_

  - [x] 19.7 Write unit tests for focus indicator presence
    - Test that all interactive components include `focus-visible:ring-2 focus-visible:ring-ring` classes
    - **Validates Property 7: Focus Indicator Presence**
    - **Validates: Requirements 2.16, 17.2**

  - [x] 19.8 Write unit tests for form label associations
    - Use jest-axe to verify no label association violations
    - **Validates Property 12: Form Input Label Association**
    - **Validates: Requirements 17.3**

  - [x] 19.9 Write unit tests for image/icon accessibility
    - Use jest-axe to verify no image alt-text violations
    - **Validates Property 13: Image and Icon Accessibility**
    - **Validates: Requirements 17.5**

- [x] 20. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The implementation uses TypeScript throughout, consistent with the existing codebase
- All new components follow shadcn/ui patterns (forwardRef, cn utility, CVA for variants)
- Existing functionality is preserved — this redesign enhances visuals without changing data models or APIs
