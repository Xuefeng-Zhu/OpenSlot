export interface MockEventType {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  locationKind: "online" | "phone" | "in_person" | "custom";
  locationType: string;
  locationValue: string;
  slug: string;
  isActive: boolean;
  bookingUrl: string;
}

export const MOCK_HOST_NAME = "Sarah Chen";
export const MOCK_HOST_USERNAME = "sarah-chen";

export const mockEventTypes: MockEventType[] = [
  {
    id: "1",
    title: "30 min intro call",
    description: "A quick call to connect and learn more.",
    durationMinutes: 30,
    locationKind: "online",
    locationType: "Online meeting",
    locationValue: "https://zoom.us/j/123456",
    slug: "intro-call",
    isActive: true,
    bookingUrl: "https://openslot.app/sarah-chen/intro-call",
  },
  {
    id: "2",
    title: "Strategy session",
    description: "A deeper session to discuss goals and next steps.",
    durationMinutes: 60,
    locationKind: "online",
    locationType: "Online meeting",
    locationValue: "https://zoom.us/j/987654",
    slug: "strategy-session",
    isActive: true,
    bookingUrl: "https://openslot.app/sarah-chen/strategy-session",
  },
  {
    id: "3",
    title: "Office hours",
    description: "Open time for questions, feedback, or support.",
    durationMinutes: 45,
    locationKind: "custom",
    locationType: "Custom location",
    locationValue: "Share details after booking",
    slug: "office-hours",
    isActive: false,
    bookingUrl: "https://openslot.app/sarah-chen/office-hours",
  },
];

export function getMockEventType(id: string | undefined) {
  return mockEventTypes.find((eventType) => eventType.id === id);
}
