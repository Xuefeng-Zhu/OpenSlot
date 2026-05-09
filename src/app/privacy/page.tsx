import type { Metadata } from "next";
import Link from "next/link";
import { AppIcon } from "@/components/shared/app-icon";

export const metadata: Metadata = {
  title: "Privacy Policy | OpenSlot",
  description: "Privacy information for OpenSlot accounts and booking flows.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-12 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <AppIcon className="h-7 w-7" />
          Back to OpenSlot
        </Link>

        <section className="space-y-4">
          <p className="text-sm font-medium uppercase tracking-wide text-primary">
            Privacy
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="text-base leading-7 text-muted-foreground">
            OpenSlot uses account, availability, and booking information to run
            scheduling workflows. This page explains the data the app expects
            and how it is used in the MVP.
          </p>
        </section>

        <div className="space-y-8 text-sm leading-7 text-muted-foreground">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">
              Information We Collect
            </h2>
            <p>
              OpenSlot stores host profile details, availability rules, event
              types, booking details, guest contact information, and settings
              needed to operate the scheduling experience.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">
              How We Use Information
            </h2>
            <p>
              The app uses this information to authenticate hosts, display
              public booking pages, compute available slots, create holds,
              confirm bookings, send notifications, and process cancellations
              or reschedules.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">
              Integrations
            </h2>
            <p>
              When enabled, calendar and email integrations may process the
              minimum data needed to sync events, refresh busy calendars, and
              deliver booking messages. Integration secrets and provider tokens
              are handled by server-side code.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">
              Your Choices
            </h2>
            <p>
              Hosts can update profile, availability, event type, notification,
              and integration settings from the dashboard. Guests can use
              booking tokens to cancel or reschedule supported bookings.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Contact</h2>
            <p>
              For privacy questions, contact the OpenSlot team through the
              support channel provided with your deployment.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
