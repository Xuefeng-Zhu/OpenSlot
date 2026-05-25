import { describe, expect, it } from "vitest";
import {
  computeRemainingSeconds,
  formatRemainingSeconds,
} from "../hold-timer";

describe("computeRemainingSeconds", () => {
  it("returns positive seconds for a future timestamp", () => {
    const now = new Date("2024-01-01T12:00:00Z");
    const expiresAt = "2024-01-01T12:05:00Z"; // 5 minutes later
    expect(computeRemainingSeconds(expiresAt, now)).toBe(300);
  });

  it("returns 0 for a past timestamp", () => {
    const now = new Date("2024-01-01T12:05:00Z");
    const expiresAt = "2024-01-01T12:00:00Z"; // 5 minutes earlier
    expect(computeRemainingSeconds(expiresAt, now)).toBe(0);
  });

  it("returns 0 for the exact same timestamp", () => {
    const now = new Date("2024-01-01T12:00:00Z");
    const expiresAt = "2024-01-01T12:00:00Z";
    expect(computeRemainingSeconds(expiresAt, now)).toBe(0);
  });

  it("floors fractional seconds", () => {
    const now = new Date("2024-01-01T12:00:00.500Z");
    const expiresAt = "2024-01-01T12:00:02Z"; // 1.5 seconds later
    expect(computeRemainingSeconds(expiresAt, now)).toBe(1);
  });
});

describe("formatRemainingSeconds", () => {
  it("formats full minutes and padded seconds", () => {
    expect(formatRemainingSeconds(125)).toBe("2:05");
  });

  it("formats less than a minute as 0:SS", () => {
    expect(formatRemainingSeconds(42)).toBe("0:42");
  });
});
