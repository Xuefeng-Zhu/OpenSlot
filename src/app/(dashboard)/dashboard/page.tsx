import { redirect } from "next/navigation";
import { createServerBackendClient } from "@/lib/backend/server";
import {
  optionalPageRow,
  pageCollection,
  pageUserOrNull,
} from "@/lib/backend/page-data";
import {
  deriveDashboardAvailabilityState,
  type DashboardAvailabilityState,
} from "@/lib/dashboard/availability-state";
import type { Tables } from "@/lib/types/database";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const backendClient = await createServerBackendClient();

  const user = pageUserOrNull(await backendClient.auth.getUser());

  if (!user) {
    redirect("/login");
  }

  const profile = optionalPageRow(
    await backendClient
      .from("profiles")
      .select("id, username, name")
      .eq("auth_user_id", user.id)
      .single(),
    "dashboard profile"
  ) as Pick<Tables<"profiles">, "id" | "username" | "name"> | null;

  if (!profile || !profile.username) {
    redirect("/onboarding");
  }

  const now = new Date();
  const [bookingsResult, activeEventTypesResult] = await Promise.all([
    backendClient
      .from("bookings")
      .select("id, guest_name, start_at, end_at, event_type_id, event_types(title)")
      .eq("host_user_id", profile.id)
      .eq("status", "confirmed")
      .gt("start_at", now.toISOString())
      .order("start_at", { ascending: true }),
    backendClient
      .from("event_types")
      .select("id, schedule_id")
      .eq("user_id", profile.id)
      .eq("is_active", true),
  ]);

  const bookingsData = pageCollection(
    bookingsResult,
    "dashboard bookings"
  ) as Array<{
    id: string;
    guest_name: string;
    start_at: string;
    end_at: string;
    event_type_id: string;
    event_types: { title: string } | null;
  }>;
  const activeEventTypes = pageCollection(
    activeEventTypesResult,
    "active event types"
  ) as Array<Pick<Tables<"event_types">, "id" | "schedule_id">>;

  const upcomingBookings = bookingsData.map((booking) => ({
    id: booking.id,
    guest_name: booking.guest_name,
    start_at: booking.start_at,
    end_at: booking.end_at,
    event_type_title: booking.event_types?.title ?? "Unknown",
  }));

  let availabilityState: DashboardAvailabilityState = "no_active_event_types";
  if (activeEventTypes.length > 0) {
    const scheduleIds = Array.from(
      new Set(activeEventTypes.map((eventType) => eventType.schedule_id))
    );
    const [schedulesResult, rulesResult, overridesResult] = await Promise.all([
      backendClient
        .from("schedules")
        .select("id, timezone")
        .eq("user_id", profile.id)
        .in("id", scheduleIds),
      backendClient
        .from("availability_rules")
        .select("schedule_id, is_active")
        .eq("user_id", profile.id)
        .in("schedule_id", scheduleIds)
        .eq("is_active", true),
      backendClient
        .from("availability_overrides")
        .select("schedule_id, date, start_time, end_time, is_available")
        .eq("user_id", profile.id)
        .in("schedule_id", scheduleIds)
        .eq("is_available", true),
    ]);

    availabilityState = deriveDashboardAvailabilityState({
      activeEventTypes,
      schedules: pageCollection(
        schedulesResult,
        "availability schedules"
      ) as Array<Pick<Tables<"schedules">, "id" | "timezone">>,
      rules: pageCollection(
        rulesResult,
        "availability rules"
      ) as Array<Pick<Tables<"availability_rules">, "schedule_id" | "is_active">>,
      overrides: pageCollection(
        overridesResult,
        "availability overrides"
      ) as Array<
        Pick<
          Tables<"availability_overrides">,
          "schedule_id" | "date" | "start_time" | "end_time" | "is_available"
        >
      >,
      now,
    });
  }

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
      activeEventTypeCount={activeEventTypes.length}
      availabilityState={availabilityState}
      bookingLink={bookingLink}
    />
  );
}
