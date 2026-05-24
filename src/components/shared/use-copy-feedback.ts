"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_COPY_FEEDBACK_MS = 2000;

export function useCopyFeedback(resetDelayMs = DEFAULT_COPY_FEEDBACK_MS) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearResetTimer = useCallback(() => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  const resetCopied = useCallback(() => {
    clearResetTimer();
    setCopied(false);
  }, [clearResetTimer]);

  const showCopied = useCallback(() => {
    clearResetTimer();
    setCopied(true);
    resetTimerRef.current = setTimeout(() => {
      setCopied(false);
      resetTimerRef.current = null;
    }, resetDelayMs);
  }, [clearResetTimer, resetDelayMs]);

  useEffect(() => clearResetTimer, [clearResetTimer]);

  return {
    copied,
    resetCopied,
    showCopied,
  };
}
