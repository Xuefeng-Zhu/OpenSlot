import { createHash, randomUUID } from "node:crypto";

export function uniqueE2EId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
}

export function hashContactEmail(email: string): string {
  return createHash("sha256")
    .update(email.trim().toLowerCase(), "utf8")
    .digest("hex");
}
