import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCopyFeedback } from "../use-copy-feedback";

describe("useCopyFeedback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("resets copied state after the configured delay", () => {
    const { result } = renderHook(() => useCopyFeedback(2000));

    act(() => {
      result.current.showCopied();
    });

    expect(result.current.copied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1999);
    });

    expect(result.current.copied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current.copied).toBe(false);
  });

  it("restarts the reset timer when copied feedback is shown again", () => {
    const { result } = renderHook(() => useCopyFeedback(2000));

    act(() => {
      result.current.showCopied();
      vi.advanceTimersByTime(1000);
      result.current.showCopied();
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.copied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.copied).toBe(false);
  });

  it("clears pending reset timers on unmount", () => {
    const { result, unmount } = renderHook(() => useCopyFeedback(2000));

    act(() => {
      result.current.showCopied();
    });

    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
