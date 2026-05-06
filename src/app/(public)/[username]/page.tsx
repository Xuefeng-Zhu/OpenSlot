"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock, MapPin, Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
}

// Mock data for the UI shell
const mockProfile = {
  name: "John Doe",
  username: "johndoe",
  bio: "Product designer and consultant. I help startups build better products through design thinking and user research.",
  avatarUrl: null as string | null,
  timezone: "America/New_York",
};

const mockEventTypes: EventType[] = [
  {
    id: "1",
    title: "30-min Discovery Call",
    description:
      "A quick introductory call to discuss your needs and see if we're a good fit for working together.",
    durationMinutes: 30,
    locationType: "Online",
    slug: "discovery-call",
  },
  {
    id: "2",
    title: "60-min Consultation",
    description:
      "An in-depth consultation session to dive deep into your project requirements and provide actionable advice.",
    durationMinutes: 60,
    locationType: "Online",
    slug: "consultation",
  },
  {
    id: "3",
    title: "15-min Quick Chat",
    description: "A brief check-in for quick questions or follow-ups.",
    durationMinutes: 15,
    locationType: "Phone",
    slug: "quick-chat",
  },
];

export default function PublicProfilePage() {
  const [profile] = useState(mockProfile);
  const [eventTypes] = useState<EventType[]>(mockEventTypes);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 md:px-0">
      {/* Host profile card */}
      <div className="flex flex-col items-center text-center mb-8">
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
        <h1 className="mt-4 text-2xl font-bold text-foreground">
          {profile.name}
        </h1>
        {profile.bio && (
          <p className="mt-2 text-sm text-muted-foreground max-w-md">
            {profile.bio}
          </p>
        )}
        <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
          <Globe className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{profile.timezone}</span>
        </div>
      </div>

      {/* Event types list */}
      {eventTypes.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No available event types</p>
        </div>
      ) : (
        <div className="space-y-4">
          {eventTypes.map((eventType) => (
            <Card
              key={eventType.id}
              className="w-full hover:border-primary/50 transition-colors"
            >
              <CardContent className="p-4 md:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold text-foreground">
                      {eventType.title}
                    </h2>
                    {eventType.description && (
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                        {eventType.description}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        {eventType.durationMinutes} min
                      </Badge>
                      <Badge variant="outline" className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" aria-hidden="true" />
                        {eventType.locationType}
                      </Badge>
                    </div>
                  </div>
                  <Button asChild className="shrink-0">
                    <Link href={`/${profile.username}/${eventType.slug}`}>
                      Book
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
