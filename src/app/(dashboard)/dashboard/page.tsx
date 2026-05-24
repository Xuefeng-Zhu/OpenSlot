import { redirect } from "next/navigation";
import { createServerBackendClient } from "@/lib/backend/server";
import type { Tables } from "@/lib/types/database";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const backendClient = await createServerBackendClient();

  // Get authenticated user
  const {
    data: { user },
  } = await backendClient.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch profile (username, name) using auth_user_id
  const { data: profileData } = await backendClient
    .from("profiles")
    .select("id, username, name")
    .eq("auth_user_id", user.id)
    .single();

  const profile = profileData as Pick<
    Tables<"profiles">,
    "id" | "username" | "name"
  > | null;

  if (!profile || !profile.username) {
    redirect("/onboarding");
  }

  // Fetch upcoming confirmed bookings joined with event_types
  const { data: bookingsData } = await backendClient
    .from("bookings")
    .select("id, guest_name, start_at, end_at, event_type_id, event_types(title)")
    .eq("host_user_id", profile.id)
    .eq("status", "confirmed")
    .gt("start_at", new Date().toISOString())
    .order("start_at", { ascending: true });

  const upcomingBookings = (
    (bookingsData as Array<{
      id: string;
      guest_name: string;
      start_at: string;
      end_at: string;
      event_type_id: string;
      event_types: { title: string } | null;
    }>) ?? []
  ).map((booking) => ({
    id: booking.id,
    guest_name: booking.guest_name,
    start_at: booking.start_at,
    end_at: booking.end_at,
    event_type_title: booking.event_types?.title ?? "Unknown",
  }));

  // Fetch count of active event types
  const { count: activeEventTypeCount } = await backendClient
    .from("event_types")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .eq("is_active", true);

  // Build a shareable booking link while keeping a relative fallback for local setup.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  const bookingLink = appUrl
    ? `${appUrl}/${profile.username}`
    : `/${profile.username}`;

  return (
    <DashboardClient
      profile={{
        username: profile.username,
        name: profile.name,
      }}
      upcomingBookings={upcomingBookings}
      activeEventTypeCount={activeEventTypeCount ?? 0}
      bookingLink={bookingLink}
    />
  );
}
