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

interface BookingPageEventHeaderProps {
  eventType: BookingPageEventHeaderEvent;
  hostProfile: BookingPageEventHeaderHost;
}

export function BookingPageEventHeader({
  eventType,
  hostProfile,
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
      <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
        {eventType.title}
      </h1>
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
