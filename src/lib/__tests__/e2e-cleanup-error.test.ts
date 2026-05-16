import { describe, expect, it } from "vitest";
import {
  E2ECleanupError,
  formatCleanupFailure,
  type CleanupFailure,
} from "../../../e2e/support/db/cleanup";

describe("E2E cleanup failure reporting", () => {
  const failure: CleanupFailure = {
    action: "delete",
    table: "contacts",
    filter: "host_user_id=profile-id and email_hash in (hash)",
    message: "permission denied for table contacts",
    code: "42501",
    details: "RLS blocked the delete",
    hint: "use a service role client",
  };

  it("formats failures with action, table, filter, and Supabase metadata", () => {
    expect(formatCleanupFailure(failure)).toBe(
      "[delete contacts] host_user_id=profile-id and email_hash in (hash): permission denied for table contacts (code=42501; details=RLS blocked the delete; hint=use a service role client)"
    );
  });

  it("keeps structured failure context on thrown cleanup errors", () => {
    const error = new E2ECleanupError("Could not clean up fixture", [failure]);

    expect(error.name).toBe("E2ECleanupError");
    expect(error.failures).toEqual([failure]);
    expect(error.message).toContain("Could not clean up fixture");
    expect(error.message).toContain("[delete contacts]");
  });
});
