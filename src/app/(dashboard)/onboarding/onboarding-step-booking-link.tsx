"use client";

import Link from "next/link";
import { Check, Copy, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function StepBookingLink({
  bookingLink,
  displayLink,
  copied,
  copyError,
  onCopy,
}: {
  bookingLink: string;
  displayLink: string;
  copied: boolean;
  copyError: string;
  onCopy: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Share your booking link
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          You&apos;re all set! Share this link so people can book time with you.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <div className="flex items-center justify-center gap-2">
          <Link2 className="h-5 w-5 text-primary" aria-hidden="true" />
          <span className="text-lg font-medium text-foreground break-all">
            {displayLink}
          </span>
        </div>

        <Button
          onClick={onCopy}
          variant={copied ? "secondary" : "default"}
          className="mt-4"
        >
          {copied ? (
            <>
              <Check className="mr-2 h-4 w-4" aria-hidden="true" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
              Copy link
            </>
          )}
        </Button>
        {copyError ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {copyError}
          </p>
        ) : null}
      </div>

      <div className="flex justify-center">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="outline" size="lg">
            <Link href={bookingLink}>View booking page</Link>
          </Button>
          <Button asChild size="lg">
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
