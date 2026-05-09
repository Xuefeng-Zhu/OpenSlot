import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | OpenSlot",
  description: "Terms for using OpenSlot scheduling pages and booking flows.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-12 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <span
            className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground"
            aria-hidden="true"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 28 28"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M8 14.5L12 18.5L20 10.5"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          Back to OpenSlot
        </Link>

        <section className="space-y-4">
          <p className="text-sm font-medium uppercase tracking-wide text-primary">
            Terms
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Terms of Service
          </h1>
          <p className="text-base leading-7 text-muted-foreground">
            OpenSlot helps hosts share availability and guests request meeting
            times. By using OpenSlot, you agree to use the service responsibly
            and only submit information you are allowed to share.
          </p>
        </section>

        <div className="space-y-8 text-sm leading-7 text-muted-foreground">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">
              Account Responsibilities
            </h2>
            <p>
              Hosts are responsible for keeping account credentials secure,
              maintaining accurate availability, and honoring confirmed
              bookings or cancelling them promptly when plans change.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">
              Booking Information
            </h2>
            <p>
              Guests should provide accurate contact details and avoid adding
              sensitive information to booking notes unless it is necessary for
              the meeting.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">
              Acceptable Use
            </h2>
            <p>
              Do not use OpenSlot to spam, impersonate others, interfere with
              the service, or collect information from booking pages in a way
              that violates another person&apos;s rights.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">
              Service Availability
            </h2>
            <p>
              OpenSlot is an MVP scheduling product. Features may change as the
              product improves, and integrations can depend on third-party
              providers such as calendar, email, and hosting services.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Contact</h2>
            <p>
              For questions about these terms, contact the OpenSlot team through
              the support channel provided with your deployment.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
