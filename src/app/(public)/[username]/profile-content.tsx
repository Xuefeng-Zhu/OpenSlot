import Link from "next/link";
import { CalendarX, Clock, MapPin, Globe, Shield } from "lucide-react";
import { AppIcon } from "@/components/shared/app-icon";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { videoProviderLabel } from "@/lib/calendar/video-providers";

export interface ProfileData {
  name: string;
  username: string;
  avatar_url: string | null;
  default_timezone: string;
}

export interface EventTypeData {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  duration_minutes: number;
  location_type: string;
  video_provider?: string | null;
}

interface PublicProfileContentProps {
  profile: ProfileData;
  activeEventTypes: EventTypeData[];
}

export function PublicProfileContent({ profile, activeEventTypes }: PublicProfileContentProps) {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-5 md:gap-8">
        {/* Left column - Profile card */}
        <div className="md:col-span-2">
          <Card className="md:sticky md:top-24">
            <CardContent className="p-6 flex flex-col items-center text-center">
              <Avatar
                src={profile.avatar_url}
                alt={`${profile.name}'s avatar`}
                fallback={profile.name
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
                size="lg"
              />
              <h1 className="mt-4 text-xl font-bold text-foreground">
                {profile.name}
              </h1>

              <div className="mt-5 w-full space-y-3 text-left">
                <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                  <Globe className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <div>
                    <span className="font-medium text-foreground">Timezone</span>
                    <br />
                    <span>{profile.default_timezone}</span>
                  </div>
                </div>
              </div>

              {/* CTA card */}
              <div className="mt-6 w-full rounded-lg border border-border bg-accent/60 p-4 text-left">
                <div className="flex items-center gap-2 mb-1">
                  <svg className="h-5 w-5 text-primary" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path d="M10 9a3 3 0 100-6 3 3 0 000 6zM6 8a2 2 0 11-4 0 2 2 0 014 0zM1.49 15.326a.78.78 0 01-.358-.442 3 3 0 014.308-3.516 6.484 6.484 0 00-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 01-2.07-.655zM16.44 15.98a4.97 4.97 0 002.07-.654.78.78 0 00.357-.442 3 3 0 00-4.308-3.517 6.484 6.484 0 011.907 3.96 2.32 2.32 0 01-.026.654zM18 8a2 2 0 11-4 0 2 2 0 014 0zM5.304 16.19a.844.844 0 01-.277-.71 5 5 0 019.947 0 .843.843 0 01-.277.71A6.975 6.975 0 0110 18a6.974 6.974 0 01-4.696-1.81z" />
                  </svg>
                  <span className="text-sm font-medium text-foreground">Let&apos;s connect</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Choose a time that works for you. I look forward to our conversation!
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column - Event types */}
        <div className="md:col-span-3">
          <div className="mb-6">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Book time with {profile.name.split(" ")[0]}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Choose an event type to get started.
            </p>
          </div>

          {activeEventTypes.length === 0 ? (
            <EmptyState
              icon={<CalendarX className="h-6 w-6" aria-hidden="true" />}
              heading="No event types available"
              description="This host does not have any active booking options right now. Check back later or contact them directly."
            />
          ) : (
            <div className="space-y-4">
              {activeEventTypes.map((eventType) => (
                <Card
                  key={eventType.id}
                  className="transition-colors hover:border-primary/40"
                >
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                      {/* Icon */}
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                        <Clock className="h-5 w-5" aria-hidden="true" />
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h3 className="text-base font-semibold text-foreground">
                              {eventType.title}
                            </h3>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>{eventType.duration_minutes} min</span>
                              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>
                                {eventLocationLabel(eventType)}
                                <span className="sr-only">
                                  {" "}
                                  {eventType.location_type}
                                </span>
                              </span>
                            </div>
                          </div>
                          <div className="shrink-0">
                            <Button asChild size="sm">
                              <Link href={`/${profile.username}/${eventType.slug}`}>
                                Book time
                              </Link>
                            </Button>
                          </div>
                        </div>
                        {eventType.description && (
                          <p className="mt-1.5 text-sm text-muted-foreground">
                            {eventType.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Trust badge */}
          <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="h-4 w-4 text-success" aria-hidden="true" />
            <span>
              <span className="font-medium text-foreground">Your time is respected</span>
              {" "}— No double-booking. Times are shown in your local timezone.
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-border text-center">
        <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5">
          <AppIcon className="h-4 w-4" />
          Scheduling that stays <span className="text-primary font-medium">open.</span>
        </p>
      </div>
    </div>
  );
}

function eventLocationLabel(eventType: EventTypeData): string {
  const generatedVideoLabel = videoProviderLabel(eventType.video_provider);
  if (generatedVideoLabel) return generatedVideoLabel;

  switch (eventType.location_type) {
    case "online":
      return "Online";
    case "phone":
      return "Phone";
    case "in_person":
      return "In person";
    case "custom":
      return "Custom";
    case "video_provider":
      return "Video";
    default:
      return eventType.location_type;
  }
}
