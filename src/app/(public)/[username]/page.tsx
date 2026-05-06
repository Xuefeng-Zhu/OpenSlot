"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock, MapPin, Globe, ArrowRight, Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";

interface EventType {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  locationType: string;
  slug: string;
  price: string;
}

// Mock data for the UI shell
const mockProfile = {
  name: "Sarah Chen",
  username: "sarah-chen",
  bio: "I help teams design intuitive, impactful products users love. Book time to talk design, product, or anything in between.",
  avatarUrl: null as string | null,
  timezone: "Pacific Time (PT)",
  responseTime: "Within a few hours",
};

const mockEventTypes: EventType[] = [
  {
    id: "1",
    title: "30 min intro call",
    description:
      "A quick call to connect and learn more.",
    durationMinutes: 30,
    locationType: "Online meeting",
    slug: "intro-call",
    price: "Free",
  },
  {
    id: "2",
    title: "Strategy session",
    description:
      "A deeper session to discuss goals and next steps.",
    durationMinutes: 60,
    locationType: "Online meeting",
    slug: "strategy-session",
    price: "Free",
  },
  {
    id: "3",
    title: "Office hours",
    description: "Open time for questions, feedback, or support.",
    durationMinutes: 45,
    locationType: "Custom location",
    slug: "office-hours",
    price: "Free",
  },
];

export default function PublicProfilePage() {
  const [profile] = useState(mockProfile);
  const [eventTypes] = useState<EventType[]>(mockEventTypes);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
        {/* Left column - Profile card */}
        <div className="md:col-span-2">
          <Card>
            <CardContent className="p-6 flex flex-col items-center text-center">
              <Avatar
                src={profile.avatarUrl}
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
              <p className="text-sm text-muted-foreground">Product Designer</p>
              {profile.bio && (
                <p className="mt-3 text-sm text-muted-foreground">
                  {profile.bio}
                </p>
              )}

              <div className="mt-4 space-y-2 w-full text-left">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Globe className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <div>
                    <span className="font-medium text-foreground">Timezone</span>
                    <br />
                    <span>{profile.timezone}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <div>
                    <span className="font-medium text-foreground">Typically responds</span>
                    <br />
                    <span>{profile.responseTime}</span>
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

          {eventTypes.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No available event types</p>
            </div>
          ) : (
            <div className="space-y-4">
              {eventTypes.map((eventType, index) => (
                <Card
                  key={eventType.id}
                  className="hover:border-primary/50 transition-colors"
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl shrink-0 ${
                        index === 0 ? "bg-accent text-primary" :
                        index === 1 ? "bg-purple-50 text-purple-600" :
                        "bg-emerald-50 text-emerald-600"
                      }`}>
                        {index === 0 ? (
                          <Clock className="h-5 w-5" aria-hidden="true" />
                        ) : index === 1 ? (
                          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path d="M10 9a3 3 0 100-6 3 3 0 000 6zM6 8a2 2 0 11-4 0 2 2 0 014 0zM1.49 15.326a.78.78 0 01-.358-.442 3 3 0 014.308-3.516 6.484 6.484 0 00-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 01-2.07-.655zM16.44 15.98a4.97 4.97 0 002.07-.654.78.78 0 00.357-.442 3 3 0 00-4.308-3.517 6.484 6.484 0 011.907 3.96 2.32 2.32 0 01-.026.654zM18 8a2 2 0 11-4 0 2 2 0 014 0zM5.304 16.19a.844.844 0 01-.277-.71 5 5 0 019.947 0 .843.843 0 01-.277.71A6.975 6.975 0 0110 18a6.974 6.974 0 01-4.696-1.81z" />
                          </svg>
                        ) : (
                          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                          </svg>
                        )}
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
                              <span>{eventType.durationMinutes} min</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <Button asChild size="sm" variant={index < 2 ? "default" : "outline"}>
                              <Link href={`/${profile.username}/${eventType.slug}`}>
                                {index < 2 ? "Book" : <ArrowRight className="h-4 w-4" />}
                              </Link>
                            </Button>
                            <span className="text-sm text-muted-foreground">{eventType.price}</span>
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
          <svg className="h-4 w-4 text-primary" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <rect width="28" height="28" rx="6" className="fill-primary" />
            <path d="M8 14.5L12 18.5L20 10.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Scheduling that stays <span className="text-primary font-medium">open.</span>
        </p>
      </div>
    </div>
  );
}
