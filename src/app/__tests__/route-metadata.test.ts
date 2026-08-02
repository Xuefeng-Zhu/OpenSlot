import { rootMetadata, routeMetadata } from "../route-metadata";

describe("route metadata", () => {
  it("uses a branded title template with the marketing title as its default", () => {
    expect(rootMetadata.title).toEqual({
      default: "OpenSlot - Share availability. Book time. Stay in sync.",
      template: "%s | OpenSlot",
    });
  });

  it("defines distinct, privacy-safe titles for application routes", () => {
    const titles = Object.fromEntries(
      Object.entries(routeMetadata).map(([route, metadata]) => [
        route,
        metadata.title,
      ])
    );

    expect(titles).toEqual({
      account: {
        default: "Account | OpenSlot",
        template: "%s | OpenSlot",
      },
      login: "Log in",
      signup: "Create account",
      forgotPassword: "Reset password",
      resetPassword: "Choose a new password",
      dashboard: {
        default: "Dashboard | OpenSlot",
        template: "%s | OpenSlot",
      },
      onboarding: "Set up OpenSlot",
      availability: "Availability",
      bookings: "Bookings",
      contacts: "Contacts",
      contactDetails: "Contact details",
      eventTypes: "Event types",
      createEventType: "Create event type",
      editEventType: "Edit event type",
      profile: "Profile",
      settings: "Settings",
      booking: {
        default: "Booking | OpenSlot",
        template: "%s | OpenSlot",
      },
      bookingProfile: "Booking profile",
      bookTime: "Book a time",
      manageBooking: {
        default: "Manage booking | OpenSlot",
        template: "%s | OpenSlot",
      },
      cancelBooking: "Cancel booking",
      rescheduleBooking: "Reschedule booking",
      privacy: "Privacy Policy",
      terms: "Terms of Service",
    });
  });
});
