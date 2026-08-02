import type { Metadata } from "next";

export const rootMetadata: Metadata = {
  title: {
    default: "OpenSlot - Share availability. Book time. Stay in sync.",
    template: "%s | OpenSlot",
  },
  description:
    "A scheduling platform that lets you share your availability, let guests book time slots, and stay in sync.",
};

export const routeMetadata = {
  account: {
    title: { default: "Account | OpenSlot", template: "%s | OpenSlot" },
  },
  login: { title: "Log in" },
  signup: { title: "Create account" },
  forgotPassword: { title: "Reset password" },
  resetPassword: { title: "Choose a new password" },
  dashboard: {
    title: { default: "Dashboard", template: "%s | OpenSlot" },
  },
  onboarding: { title: "Set up OpenSlot" },
  availability: { title: "Availability" },
  bookings: { title: "Bookings" },
  contacts: { title: "Contacts" },
  contactDetails: { title: "Contact details" },
  eventTypes: { title: "Event types" },
  createEventType: { title: "Create event type" },
  editEventType: { title: "Edit event type" },
  profile: { title: "Profile" },
  settings: { title: "Settings" },
  booking: {
    title: { default: "Booking | OpenSlot", template: "%s | OpenSlot" },
  },
  bookingProfile: { title: "Booking profile" },
  bookTime: { title: "Book a time" },
  manageBooking: {
    title: { default: "Manage booking | OpenSlot", template: "%s | OpenSlot" },
  },
  cancelBooking: { title: "Cancel booking" },
  rescheduleBooking: { title: "Reschedule booking" },
  privacy: {
    title: "Privacy Policy",
    description: "Privacy information for OpenSlot accounts and booking flows.",
  },
  terms: {
    title: "Terms of Service",
    description: "Terms for using OpenSlot scheduling pages and booking flows.",
  },
} satisfies Record<string, Metadata>;
