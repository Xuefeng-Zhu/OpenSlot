"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  BookingAgentPanelView,
  type TimeSlot,
} from "@/components/booking/booking-agent-panel-view";
import type {
  BookingAgentDraft,
  BookingAgentMessage,
} from "@/lib/booking-agent/types";

interface BookingAgentPanelProps {
  mode: "booking" | "reschedule";
  eventTypeId: string;
  hostUserId: string;
  timezone: string;
  selectedDate?: string;
  selectedSlot?: { start: string; end: string; slotToken?: string } | null;
  rescheduleToken?: string;
  holdDisabled?: boolean;
  holdDisabledReason?: string;
  onSelectSlot: (slot: { start: string; end: string; slotToken?: string }) => void;
  onDraftChange: (draft: BookingAgentDraft) => void;
}

interface AgentResponse {
  success: boolean;
  reply?: string;
  error?: string;
  suggestedSlots?: TimeSlot[];
  draft?: BookingAgentDraft;
  nextAction?: string;
}

const BOOKING_AGENT_REQUEST_TIMEOUT_MS = 20_000;

export function BookingAgentPanel({
  mode,
  eventTypeId,
  hostUserId,
  timezone,
  selectedDate,
  selectedSlot,
  rescheduleToken,
  holdDisabled = false,
  holdDisabledReason = "Complete the verification challenge before holding a time.",
  onSelectSlot,
  onDraftChange,
}: BookingAgentPanelProps) {
  const conversationContextKey = bookingAgentConversationContextKey({
    eventTypeId,
    hostUserId,
    mode,
    rescheduleToken,
    selectedDate,
    timezone,
  });
  const [messages, setMessages] = useState<BookingAgentMessage[]>(() => [
    initialAssistantMessage(mode),
  ]);
  const [input, setInput] = useState("");
  const [suggestedSlots, setSuggestedSlots] = useState<TimeSlot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const requestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const conversationContextRef = useRef(conversationContextKey);

  useEffect(() => {
    requestRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setError(null);
    setSuggestedSlots([]);

    if (conversationContextRef.current !== conversationContextKey) {
      conversationContextRef.current = conversationContextKey;
      setMessages([initialAssistantMessage(mode)]);
      setInput("");
    }
  }, [
    conversationContextKey,
    mode,
    selectedSlot?.end,
    selectedSlot?.slotToken,
    selectedSlot?.start,
  ]);

  useEffect(() => {
    return () => {
      requestRef.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    const isLatestRequest = () => requestRef.current === requestId;

    const nextMessages: BookingAgentMessage[] = [
      ...messages,
      { role: "user" as const, content: trimmed },
    ].slice(-10);

    setMessages(nextMessages);
    setInput("");
    setError(null);
    setLoading(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = setTimeout(
      () => controller.abort(),
      BOOKING_AGENT_REQUEST_TIMEOUT_MS
    );

    try {
      const response = await fetch("/api/booking-agent/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          mode,
          eventTypeId,
          hostUserId,
          rescheduleToken,
          timezone,
          messages: nextMessages,
          clientState: {
            selectedDate,
            selectedSlot: selectedSlot ?? undefined,
          },
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | AgentResponse
        | null;

      if (!isLatestRequest()) return;

      if (!response.ok || !data?.success) {
        setError(data?.error ?? "The assistant is unavailable right now.");
        return;
      }

      if (data.draft) {
        onDraftChange(data.draft);
      }

      setSuggestedSlots(data.suggestedSlots ?? []);
      setMessages((current) =>
        [
          ...current,
          {
            role: "assistant" as const,
            content: data.reply ?? "I found a few options.",
          },
        ].slice(-10)
      );
    } catch (fetchError) {
      if (isLatestRequest()) {
        setError(
          isAbortError(fetchError)
            ? "The assistant took too long to respond. Please try again or choose a time below."
            : "The assistant is unavailable right now."
        );
      }
    } finally {
      clearTimeout(timeout);
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      if (isLatestRequest()) {
        setLoading(false);
      }
    }
  }

  return (
    <BookingAgentPanelView
      error={error}
      holdDisabled={holdDisabled}
      holdDisabledReason={holdDisabledReason}
      input={input}
      loading={loading}
      messages={messages}
      open={open}
      suggestedSlots={suggestedSlots}
      timezone={timezone}
      onInputChange={setInput}
      onOpenChange={setOpen}
      onSelectSlot={onSelectSlot}
      onSubmit={handleSubmit}
    />
  );
}

function isAbortError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

function initialAssistantMessage(mode: BookingAgentPanelProps["mode"]) {
  return {
    role: "assistant" as const,
    content:
      mode === "reschedule"
        ? "Tell me when you would like to move this meeting, and I can look for open times."
        : "Tell me what day or time works for you, and I can help find an opening.",
  };
}

function bookingAgentConversationContextKey({
  eventTypeId,
  hostUserId,
  mode,
  rescheduleToken,
  selectedDate,
  timezone,
}: Pick<
  BookingAgentPanelProps,
  | "eventTypeId"
  | "hostUserId"
  | "mode"
  | "rescheduleToken"
  | "selectedDate"
  | "timezone"
>) {
  return [
    mode,
    eventTypeId,
    hostUserId,
    rescheduleToken ?? "",
    selectedDate ?? "",
    timezone,
  ].join("|");
}
