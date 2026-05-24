"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, Clock3, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type {
  BookingAgentDraft,
  BookingAgentMessage,
} from "@/lib/booking-agent/types";
import { cn } from "@/lib/utils";

interface TimeSlot {
  start: string;
  end: string;
  label?: string;
  slotToken?: string;
}

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
  const conversationContextRef = useRef(conversationContextKey);

  useEffect(() => {
    requestRef.current += 1;
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

    try {
      const response = await fetch("/api/booking-agent/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    } catch {
      if (isLatestRequest()) {
        setError("The assistant is unavailable right now.");
      }
    } finally {
      if (isLatestRequest()) {
        setLoading(false);
      }
    }
  }

  return (
    <div className="mt-6 flex justify-end lg:fixed lg:bottom-6 lg:right-6 lg:z-50 lg:mt-0">
      {!open && (
        <Button
          type="button"
          className="h-12 rounded-full px-4 shadow-lg"
          aria-controls="booking-agent-panel"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
          AI assistant
        </Button>
      )}

      {open && (
        <Card
          id="booking-agent-panel"
          className="w-[calc(100vw-2rem)] max-w-sm shadow-2xl"
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="rounded-md bg-primary/10 p-2 text-primary">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <CardTitle className="text-lg">Booking assistant</CardTitle>
                  <CardDescription>
                    Ask for a day, time window, or timezone help.
                  </CardDescription>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                aria-label="Close booking assistant"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="max-h-[min(70vh,620px)] space-y-4 overflow-y-auto">
            <div
              className="max-h-[280px] space-y-3 overflow-y-auto pr-1"
              aria-live="polite"
            >
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm",
                    message.role === "assistant"
                      ? "bg-muted text-foreground"
                      : "ml-6 bg-primary text-primary-foreground"
                  )}
                >
                  {message.role === "assistant" && (
                    <Bot
                      className="mr-1.5 inline h-3.5 w-3.5 align-[-2px]"
                      aria-hidden="true"
                    />
                  )}
                  {message.content}
                </div>
              ))}
              {loading && (
                <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                  Checking availability...
                </div>
              )}
            </div>

            {suggestedSlots.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Suggested times
                </p>
                <div className="space-y-2">
                  {suggestedSlots.map((slot) => (
                    <Button
                      key={slot.start}
                      type="button"
                      variant="outline"
                      className="w-full justify-start gap-2"
                      disabled={holdDisabled}
                      title={holdDisabled ? holdDisabledReason : undefined}
                      onClick={() => onSelectSlot(slot)}
                    >
                      <Clock3 className="h-4 w-4" aria-hidden="true" />
                      {slot.label ??
                        formatFallbackSlotLabel(slot.start, timezone)}
                    </Button>
                  ))}
                </div>
                {holdDisabled && (
                  <p className="text-xs text-muted-foreground">
                    {holdDisabledReason}
                  </p>
                )}
              </div>
            )}

            {error && (
              <div
                className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
                role="alert"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-2">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Example: next Tuesday afternoon"
                className="min-h-20"
                aria-label="Message the booking assistant"
              />
              <Button type="submit" className="w-full gap-2" disabled={loading}>
                <Send className="h-4 w-4" aria-hidden="true" />
                Send
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function formatFallbackSlotLabel(isoString: string, timezone: string) {
  return new Intl.DateTimeFormat([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone || undefined,
  }).format(new Date(isoString));
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
