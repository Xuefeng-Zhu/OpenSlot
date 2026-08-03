import { redirect } from "next/navigation";
import { createServerBackendClient } from "@/lib/backend/server";
import {
  optionalPageRow,
  pageCollection,
  pageUserOrNull,
} from "@/lib/backend/page-data";
import type { Tables } from "@/lib/types/database";
import { formatEventLocationLabel } from "@/lib/location-labels";
import {
  EventTypesClient,
  type DashboardEventType,
} from "./event-types-client";
import { routeMetadata } from "@/app/route-metadata";

export const metadata = routeMetadata.eventTypes;

function buildBookingUrl(username: string, slug: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  return `${appUrl}/${username}/${slug}`;
}

export default async function EventTypesPage() {
  const backendClient = await createServerBackendClient();

  const user = pageUserOrNull(await backendClient.auth.getUser());

  if (!user) {
    redirect("/login");
  }

  const profile = optionalPageRow(
    await backendClient
      .from("profiles")
      .select("id, username")
      .eq("auth_user_id", user.id)
      .single(),
    "dashboard profile"
  ) as Pick<Tables<"profiles">, "id" | "username"> | null;

  if (!profile?.username) {
    redirect("/onboarding");
  }

  const username = profile.username;

  const eventTypesData = pageCollection(
    await backendClient
      .from("event_types")
      .select(
        "id, title, slug, description, duration_minutes, location_type, video_provider, is_active, created_at"
      )
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false }),
    "event types"
  ) as Array<Pick<
    Tables<"event_types">,
    | "id"
    | "title"
    | "slug"
    | "description"
    | "duration_minutes"
    | "location_type"
    | "video_provider"
    | "is_active"
  >>;

  const eventTypes = eventTypesData.map<DashboardEventType>((eventType) => ({
    id: eventType.id,
    title: eventType.title,
    description: eventType.description,
    durationMinutes: eventType.duration_minutes,
    locationType: formatEventLocationLabel(eventType, { style: "dashboard" }),
    slug: eventType.slug,
    isActive: eventType.is_active,
    bookingUrl: buildBookingUrl(username, eventType.slug),
  }));

  return <EventTypesClient initialEventTypes={eventTypes} />;
}
