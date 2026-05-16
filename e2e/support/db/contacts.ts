import { hashContactEmail } from "./ids";
import type { E2EAdminClient } from "./types";

export async function upsertContactForBooking(
  adminClient: E2EAdminClient,
  {
    bookingId,
    hostUserId,
    guestName,
    guestEmail,
  }: {
    bookingId: string;
    hostUserId: string;
    guestName: string;
    guestEmail: string;
  }
) {
  const now = new Date().toISOString();

  const { error } = await adminClient.from("contacts").upsert(
    {
      host_user_id: hostUserId,
      email_hash: hashContactEmail(guestEmail),
      display_name: guestName,
      last_guest_timezone: "America/New_York",
      first_seen_at: now,
      last_seen_at: now,
      last_booking_id: bookingId,
      deleted_at: null,
    },
    { onConflict: "host_user_id,email_hash" }
  );

  if (error) {
    throw new Error(`Could not mirror E2E contact: ${error.message}`);
  }
}
