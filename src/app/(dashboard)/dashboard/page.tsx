import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/types/database";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();

  // Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch profile (username, name) using auth_user_id
  const { data: profileData } = await supabase
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
  const { data: bookingsData } = await supabase
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
  const { count: activeEventTypeCount } = await supabase
    .from("event_types")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .eq("is_active", true);

  // Build booking link from profile username
  const bookingLink = `/${profile.username}`;

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
