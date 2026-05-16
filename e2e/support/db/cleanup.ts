import { getDemoProfile } from "./demo-profile";
import { hashContactEmail } from "./ids";
import type { DemoProfile, E2EAdminClient } from "./types";

type CleanupAction = "cleanup" | "delete" | "select";

interface SupabaseFailure {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

interface SupabaseResult {
  error: SupabaseFailure | null;
}

export interface CleanupFailure {
  action: CleanupAction;
  table: string;
  filter: string;
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

export class E2ECleanupError extends Error {
  readonly failures: CleanupFailure[];

  constructor(subject: string, failures: CleanupFailure[]) {
    super(
      `${subject}: ${failures.length} database operation(s) failed.\n${formatCleanupFailures(failures)}`
    );
    this.name = "E2ECleanupError";
    this.failures = failures;
  }
}

export function formatCleanupFailure(failure: CleanupFailure): string {
  const metadata = [
    failure.code ? `code=${failure.code}` : null,
    failure.details ? `details=${failure.details}` : null,
    failure.hint ? `hint=${failure.hint}` : null,
  ].filter(Boolean);
  const suffix = metadata.length > 0 ? ` (${metadata.join("; ")})` : "";

  return `[${failure.action} ${failure.table}] ${failure.filter}: ${failure.message}${suffix}`;
}

export function formatCleanupFailures(failures: CleanupFailure[]): string {
  return failures
    .map((failure, index) => `${index + 1}. ${formatCleanupFailure(failure)}`)
    .join("\n");
}

export async function cleanupEventType(
  adminClient: E2EAdminClient,
  eventTypeId: string
) {
  const failures: CleanupFailure[] = [];
  const bookingsResult = await adminClient
    .from("bookings")
    .select("id, guest_email")
    .eq("event_type_id", eventTypeId);

  recordCleanupResult(
    failures,
    {
      action: "select",
      table: "bookings",
      filter: `event_type_id=${eventTypeId}`,
    },
    bookingsResult
  );

  const bookingRows = bookingsResult.error ? [] : bookingsResult.data ?? [];
  const bookingIds = bookingRows.map((booking) => booking.id);
  const guestEmailHashes = [
    ...new Set(
      bookingRows.map((booking) => hashContactEmail(booking.guest_email))
    ),
  ];

  const holdsResult = await adminClient
    .from("slot_holds")
    .select("id")
    .eq("event_type_id", eventTypeId);

  recordCleanupResult(
    failures,
    {
      action: "select",
      table: "slot_holds",
      filter: `event_type_id=${eventTypeId}`,
    },
    holdsResult
  );

  const holdRows = holdsResult.error ? [] : holdsResult.data ?? [];
  const holdIds = holdRows.map((hold) => hold.id);

  if (bookingIds.length > 0) {
    recordCleanupResult(
      failures,
      {
        action: "delete",
        table: "host_reservations",
        filter: `source=booking and ${inFilter("source_id", bookingIds)}`,
      },
      await adminClient
        .from("host_reservations")
        .delete()
        .eq("source", "booking")
        .in("source_id", bookingIds)
    );

    recordCleanupResult(
      failures,
      {
        action: "delete",
        table: "outbox_events",
        filter: `aggregate_type=booking and ${inFilter("aggregate_id", bookingIds)}`,
      },
      await adminClient
        .from("outbox_events")
        .delete()
        .eq("aggregate_type", "booking")
        .in("aggregate_id", bookingIds)
    );

    recordCleanupResult(
      failures,
      {
        action: "delete",
        table: "booking_events",
        filter: inFilter("booking_id", bookingIds),
      },
      await adminClient
        .from("booking_events")
        .delete()
        .in("booking_id", bookingIds)
    );
  }

  if (holdIds.length > 0) {
    recordCleanupResult(
      failures,
      {
        action: "delete",
        table: "host_reservations",
        filter: `source=hold and ${inFilter("source_id", holdIds)}`,
      },
      await adminClient
        .from("host_reservations")
        .delete()
        .eq("source", "hold")
        .in("source_id", holdIds)
    );
  }

  recordCleanupResult(
    failures,
    {
      action: "delete",
      table: "event_types",
      filter: `id=${eventTypeId}`,
    },
    await adminClient.from("event_types").delete().eq("id", eventTypeId)
  );

  if (guestEmailHashes.length > 0) {
    const profile = await getDemoProfileForCleanup(adminClient, failures);

    if (profile) {
      recordCleanupResult(
        failures,
        {
          action: "delete",
          table: "contacts",
          filter: `host_user_id=${profile.id} and ${inFilter("email_hash", guestEmailHashes)}`,
        },
        await adminClient
          .from("contacts")
          .delete()
          .eq("host_user_id", profile.id)
          .in("email_hash", guestEmailHashes)
      );
    }
  }

  throwIfCleanupFailed(
    `Could not clean up E2E event type ${eventTypeId}`,
    failures
  );
}

export async function cleanupEventTypesBySlug(
  adminClient: E2EAdminClient,
  slugs: string[]
) {
  const failures: CleanupFailure[] = [];
  const subject = `Could not clean up E2E event types for slugs ${slugs.join(", ")}`;
  const profile = await getDemoProfileForCleanup(adminClient, failures);

  if (!profile) {
    throwIfCleanupFailed(subject, failures);
    return;
  }

  const eventTypesResult = await adminClient
    .from("event_types")
    .select("id")
    .eq("user_id", profile.id)
    .in("slug", slugs);

  recordCleanupResult(
    failures,
    {
      action: "select",
      table: "event_types",
      filter: `user_id=${profile.id} and ${inFilter("slug", slugs)}`,
    },
    eventTypesResult
  );

  if (!eventTypesResult.error) {
    for (const eventType of eventTypesResult.data ?? []) {
      try {
        await cleanupEventType(adminClient, eventType.id);
      } catch (error) {
        if (error instanceof E2ECleanupError) {
          failures.push(...error.failures);
        } else {
          recordCleanupException(
            failures,
            {
              action: "cleanup",
              table: "event_types",
              filter: `id=${eventType.id}`,
            },
            error
          );
        }
      }
    }
  }

  throwIfCleanupFailed(subject, failures);
}

export async function cleanupWebhookEndpointByUrl(
  adminClient: E2EAdminClient,
  url: string
) {
  const failures: CleanupFailure[] = [];
  const subject = `Could not clean up E2E webhook endpoint ${url}`;
  const profile = await getDemoProfileForCleanup(adminClient, failures);

  if (!profile) {
    throwIfCleanupFailed(subject, failures);
    return;
  }

  recordCleanupResult(
    failures,
    {
      action: "delete",
      table: "webhook_endpoints",
      filter: `profile_id=${profile.id} and url=${url}`,
    },
    await adminClient
      .from("webhook_endpoints")
      .delete()
      .eq("profile_id", profile.id)
      .eq("url", url)
  );

  throwIfCleanupFailed(subject, failures);
}

async function getDemoProfileForCleanup(
  adminClient: E2EAdminClient,
  failures: CleanupFailure[]
): Promise<DemoProfile | null> {
  try {
    return await getDemoProfile(adminClient);
  } catch (error) {
    recordCleanupException(
      failures,
      {
        action: "select",
        table: "profiles",
        filter: "seeded demo profile",
      },
      error
    );
    return null;
  }
}

function recordCleanupResult(
  failures: CleanupFailure[],
  context: Omit<CleanupFailure, "message" | "code" | "details" | "hint">,
  result: SupabaseResult
) {
  if (!result.error) return;

  failures.push({
    ...context,
    message: result.error.message,
    code: result.error.code,
    details: result.error.details,
    hint: result.error.hint,
  });
}

function recordCleanupException(
  failures: CleanupFailure[],
  context: Omit<CleanupFailure, "message" | "code" | "details" | "hint">,
  error: unknown
) {
  failures.push({
    ...context,
    message: error instanceof Error ? error.message : String(error),
  });
}

function throwIfCleanupFailed(subject: string, failures: CleanupFailure[]) {
  if (failures.length > 0) {
    throw new E2ECleanupError(subject, failures);
  }
}

function inFilter(field: string, values: string[]): string {
  return `${field} in (${values.join(", ")})`;
}
