import Link from "next/link";
import { Clock, MapPin, Globe, Shield } from "lucide-react";
import { AppIcon } from "@/components/shared/app-icon";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";

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
}

interface PublicProfileContentProps {
  profile: ProfileData;
  activeEventTypes: EventTypeData[];
}

export function PublicProfileContent({ profile, activeEventTypes }: PublicProfileContentProps) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
        {/* Left column - Profile card */}
        <div className="md:col-span-2">
          <Card>
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

              <div className="mt-4 space-y-2 w-full text-left">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Globe className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <div>
                    <span className="font-medium text-foreground">Timezone</span>
                    <br />
                    <span>{profile.default_timezone}</span>
                  </div>
                </div>
              </div>

              {/* CTA card */}
              <div className="mt-6 w-full rounded-lg bg-accent p-4 text-left">
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
            <h2 className="text-2xl font-bold text-foreground">
              Book time with {profile.name.split(" ")[0]}
            </h2>
            <p className="mt-1 text-muted-foreground">
              Choose an event type to get started.
            </p>
          </div>

          {activeEventTypes.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No available event types</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeEventTypes.map((eventType) => (
                <Card
                  key={eventType.id}
                  className="hover:border-primary/50 transition-colors"
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl shrink-0 bg-accent text-primary">
                        <Clock className="h-5 w-5" aria-hidden="true" />
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-base font-semibold text-foreground">
                              {eventType.title}
                            </h3>
                            <div className="flex items-center gap-1 mt-0.5 text-sm text-muted-foreground">
                              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>{eventType.duration_minutes} min</span>
                              <span className="mx-1">·</span>
                              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>{eventType.location_type}</span>
                            </div>
                          </div>
                          <div className="shrink-0">
                            <Button asChild size="sm">
                              <Link href={`/${profile.username}/${eventType.slug}`}>
                                Book
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
