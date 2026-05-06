import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function HeroSection() {
  return (
    <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-32">
      <div className="mx-auto max-w-3xl text-center">
        {/* Headline */}
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
          Scheduling that stays open.
        </h1>

        {/* Subheadline */}
        <p className="mt-6 text-lg leading-8 text-muted-foreground sm:text-xl">
          OpenSlot helps anyone share availability, prevent double-booking, and
          let guests book time from any timezone.
        </p>

        {/* CTA Buttons */}
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Button asChild size="lg">
            <Link href="/signup">Create your OpenSlot</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="#demo">View demo page</Link>
          </Button>
        </div>
      </div>

      {/* Product Preview */}
      <div className="mx-auto mt-16 max-w-4xl sm:mt-20">
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-lg">
          {/* Mock browser chrome */}
          <div className="flex items-center gap-2 border-b border-border bg-muted px-4 py-3">
            <div className="h-3 w-3 rounded-full bg-red-400" />
            <div className="h-3 w-3 rounded-full bg-yellow-400" />
            <div className="h-3 w-3 rounded-full bg-green-400" />
            <div className="ml-4 h-5 flex-1 rounded-sm bg-background" />
          </div>

          {/* Mock booking page content */}
          <div className="grid gap-6 p-6 sm:grid-cols-2 sm:p-8">
            {/* Left panel - Host info */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/20" />
                <div className="space-y-1">
                  <div className="h-4 w-24 rounded bg-muted" />
                  <div className="h-3 w-16 rounded bg-muted" />
                </div>
              </div>
              <div className="h-5 w-40 rounded bg-foreground/10" />
              <div className="h-4 w-32 rounded bg-muted" />
              <div className="h-4 w-28 rounded bg-muted" />
            </div>

            {/* Right panel - Calendar and slots */}
            <div className="space-y-4">
              {/* Mini calendar mock */}
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={`header-${i}`}
                    className="h-4 rounded bg-muted text-center text-[8px] text-muted-foreground"
                  />
                ))}
                {Array.from({ length: 28 }).map((_, i) => (
                  <div
                    key={`day-${i}`}
                    className={`h-6 rounded text-center text-[10px] ${
                      i === 14
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/50'
                    }`}
                  />
                ))}
              </div>

              {/* Time slots mock */}
              <div className="space-y-2">
                {['9:00 AM', '10:30 AM', '2:00 PM'].map((time) => (
                  <div
                    key={time}
                    className="flex h-9 items-center justify-center rounded-md border border-border text-xs font-medium text-muted-foreground"
                  >
                    {time}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
