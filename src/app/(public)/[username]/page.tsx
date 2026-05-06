import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Tables } from "@/lib/types/database";

interface HostProfilePageProps {
  params: Promise<{ username: string }>;
}

type Profile = Pick<Tables<"profiles">, "id" | "name" | "username" | "avatar_url">;
type EventType = Pick<
  Tables<"event_types">,
  "id" | "title" | "slug" | "description" | "duration_minutes" | "location_type" | "is_active"
>;

export default async function HostProfilePage({ params }: HostProfilePageProps) {
  const { username } = await params;
  const supabase = await createServerSupabaseClient();

  // Fetch the profile by username
  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, name, username, avatar_url")
    .eq("username", username)
    .single();

  const profile = profileData as Profile | null;

  if (!profile) {
    notFound();
  }

  // Fetch active event types for this host
  const { data: eventTypesData } = await supabase
    .from("event_types")
    .select("id, title, slug, description, duration_minutes, location_type, is_active")
    .eq("user_id", profile.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  const activeEventTypes = (eventTypesData as EventType[] | null) ?? [];

  return (
    <div className="max-w-2xl mx-auto">
      {/* Host profile header */}
      <div className="flex flex-col items-center text-center mb-8">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={`${profile.name}'s avatar`}
            className="w-20 h-20 rounded-full object-cover mb-4"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
            <span className="text-2xl font-semibold text-muted-foreground">
              {profile.name?.charAt(0)?.toUpperCase() || "?"}
            </span>
          </div>
        )}
        <h1 className="text-2xl font-bold">{profile.name}</h1>
        <p className="text-muted-foreground">@{profile.username}</p>
      </div>

      {/* Event types list */}
      {activeEventTypes.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            This user has no available event types.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {activeEventTypes.map((eventType) => (
            <Link
              key={eventType.id}
              href={`/${profile.username}/${eventType.slug}`}
              className="block"
            >
              <Card className="hover:border-primary/50 transition-colors">
                <CardHeader>
                  <CardTitle className="text-lg">{eventType.title}</CardTitle>
                  {eventType.description && (
                    <CardDescription>{eventType.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">
                      {eventType.duration_minutes} min
                    </Badge>
                    <Badge variant="outline">
                      {formatLocationType(eventType.location_type)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function formatLocationType(locationType: string): string {
  switch (locationType) {
    case "online":
      return "Online";
    case "phone":
      return "Phone";
    case "in_person":
      return "In Person";
    case "custom":
      return "Custom";
    default:
      return locationType;
  }
}
