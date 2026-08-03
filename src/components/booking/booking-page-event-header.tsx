import type { HTMLAttributes } from "react";
import { Badge } from "@/components/ui/badge";
import { Avatar, getInitials } from "@/components/ui/avatar";
import { formatEventLocationLabel } from "@/components/booking/event-location-label";

export interface BookingPageEventHeaderEvent {
  title: string;
  description?: string | null;
  duration_minutes: number;
  location_type: string;
  video_provider?: string | null;
}

export interface BookingPageEventHeaderHost {
  name: string;
  avatar_url: string | null;
}

export type BookingHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
export type BookingPageEventHeadingLevel = 1 | 2 | 3;

interface BookingHeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  level: BookingHeadingLevel;
}

/** Renders a semantic heading at the level supplied by the booking context. */
export function BookingHeading({ level, ...props }: BookingHeadingProps) {
  const Heading =
    level === 1
      ? "h1"
      : level === 2
        ? "h2"
        : level === 3
          ? "h3"
          : level === 4
            ? "h4"
            : level === 5
              ? "h5"
              : "h6";

  return <Heading {...props} />;
}

/** Returns the next nested heading level without exceeding HTML's h6. */
export function nextBookingHeadingLevel(
  level: BookingHeadingLevel
): BookingHeadingLevel {
  return Math.min(level + 1, 6) as BookingHeadingLevel;
}

interface BookingPageEventHeaderProps {
  eventType: BookingPageEventHeaderEvent;
  hostProfile: BookingPageEventHeaderHost;
  headingLevel?: BookingPageEventHeadingLevel;
}

export function BookingPageEventHeader({
  eventType,
  hostProfile,
  headingLevel = 1,
}: BookingPageEventHeaderProps) {
  return (
    <div className="mb-8 flex flex-col items-center text-center">
      <Avatar
        src={hostProfile.avatar_url}
        alt={`${hostProfile.name}'s avatar`}
        fallback={getInitials(hostProfile.name) || "?"}
        size="lg"
        className="mb-3"
      />
      <p className="text-muted-foreground text-sm">{hostProfile.name}</p>
      <BookingHeading
        level={headingLevel}
        className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl"
      >
        {eventType.title}
      </BookingHeading>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        <Badge variant="secondary">{eventType.duration_minutes} min</Badge>
        <Badge variant="outline">{formatEventLocationLabel(eventType)}</Badge>
      </div>
      {eventType.description ? (
        <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
          {eventType.description}
        </p>
      ) : null}
    </div>
  );
}
