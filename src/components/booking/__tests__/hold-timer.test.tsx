import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { HoldTimer, computeRemainingSeconds } from "../hold-timer";

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

describe("HoldTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("displays formatted countdown", () => {
    const expiresAt = new Date(Date.now() + 125000).toISOString(); // 125 seconds
    const onExpired = vi.fn();

    render(<HoldTimer expiresAt={expiresAt} onExpired={onExpired} />);

    // 125 seconds = 2:05
    expect(screen.getByText("2:05")).toBeDefined();
  });

  it("displays seconds less than 60 as 0:SS format", () => {
    const expiresAt = new Date(Date.now() + 42000).toISOString(); // 42 seconds
    const onExpired = vi.fn();

    render(<HoldTimer expiresAt={expiresAt} onExpired={onExpired} />);

    expect(screen.getByText("0:42")).toBeDefined();
  });

  it("calls onExpired when countdown reaches 0", () => {
    const expiresAt = new Date(Date.now() + 3000).toISOString(); // 3 seconds
    const onExpired = vi.fn();

    render(<HoldTimer expiresAt={expiresAt} onExpired={onExpired} />);

    expect(onExpired).not.toHaveBeenCalled();

    // Advance 3 seconds
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it("calls onExpired immediately if already expired", () => {
    const expiresAt = new Date(Date.now() - 5000).toISOString(); // 5 seconds ago
    const onExpired = vi.fn();

    render(<HoldTimer expiresAt={expiresAt} onExpired={onExpired} />);

    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it("applies warning styling when remaining <= 30 seconds", () => {
    const expiresAt = new Date(Date.now() + 20000).toISOString(); // 20 seconds
    const onExpired = vi.fn();

    render(<HoldTimer expiresAt={expiresAt} onExpired={onExpired} />);

    const timer = screen.getByRole("timer");
    expect(timer.className).toContain("text-warning");
  });

  it("does not apply warning styling when remaining > 30 seconds", () => {
    const expiresAt = new Date(Date.now() + 60000).toISOString(); // 60 seconds
    const onExpired = vi.fn();

    render(<HoldTimer expiresAt={expiresAt} onExpired={onExpired} />);

    const timer = screen.getByRole("timer");
    expect(timer.className).toContain("text-muted-foreground");
    expect(timer.className).not.toContain("text-warning");
  });

  it("has role=timer and aria-live=polite for accessibility", () => {
    const expiresAt = new Date(Date.now() + 60000).toISOString();
    const onExpired = vi.fn();

    render(<HoldTimer expiresAt={expiresAt} onExpired={onExpired} />);

    const timer = screen.getByRole("timer");
    expect(timer.getAttribute("aria-live")).toBe("polite");
  });
});
