"use client";

import type { FormEvent } from "react";
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
import type { BookingAgentMessage } from "@/lib/booking-agent/types";
import { cn } from "@/lib/utils";

export interface TimeSlot {
  start: string;
  end: string;
  label?: string;
  slotToken?: string;
}

interface BookingAgentPanelViewProps {
  error: string | null;
  holdDisabled: boolean;
  holdDisabledReason: string;
  input: string;
  loading: boolean;
  messages: BookingAgentMessage[];
  open: boolean;
  suggestedSlots: TimeSlot[];
  timezone: string;
  onInputChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onSelectSlot: (slot: TimeSlot) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function BookingAgentPanelView({
  error,
  holdDisabled,
  holdDisabledReason,
  input,
  loading,
  messages,
  open,
  suggestedSlots,
  timezone,
  onInputChange,
  onOpenChange,
  onSelectSlot,
  onSubmit,
}: BookingAgentPanelViewProps) {
  return (
    <div className="mt-6 flex justify-end lg:fixed lg:bottom-6 lg:right-6 lg:z-50 lg:mt-0">
      {!open && (
        <Button
          type="button"
          className="h-12 rounded-full px-4 shadow-lg"
          aria-controls="booking-agent-panel"
          aria-expanded={open}
          onClick={() => onOpenChange(true)}
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
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="max-h-[min(70vh,620px)] space-y-4 overflow-y-auto">
            <BookingAgentMessages messages={messages} loading={loading} />

            {suggestedSlots.length > 0 && (
              <BookingAgentSuggestedSlots
                holdDisabled={holdDisabled}
                holdDisabledReason={holdDisabledReason}
                suggestedSlots={suggestedSlots}
                timezone={timezone}
                onSelectSlot={onSelectSlot}
              />
            )}

            {error && (
              <div
                className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
                role="alert"
              >
                {error}
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-2">
              <Textarea
                value={input}
                onChange={(event) => onInputChange(event.target.value)}
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

function BookingAgentMessages({
  messages,
  loading,
}: {
  messages: BookingAgentMessage[];
  loading: boolean;
}) {
  return (
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
  );
}

function BookingAgentSuggestedSlots({
  holdDisabled,
  holdDisabledReason,
  suggestedSlots,
  timezone,
  onSelectSlot,
}: {
  holdDisabled: boolean;
  holdDisabledReason: string;
  suggestedSlots: TimeSlot[];
  timezone: string;
  onSelectSlot: (slot: TimeSlot) => void;
}) {
  return (
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
            {slot.label ?? formatFallbackSlotLabel(slot.start, timezone)}
          </Button>
        ))}
      </div>
      {holdDisabled && (
        <p className="text-xs text-muted-foreground">{holdDisabledReason}</p>
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
