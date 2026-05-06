import Link from 'next/link'
import { Play } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function HeroSection() {
  return (
    <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-32">
      <div className="mx-auto max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Left column - Text content */}
        <div>
          {/* Tagline */}
          <p className="text-sm font-medium text-primary flex items-center gap-1.5">
            <span aria-hidden="true">✨</span> The open way to schedule
          </p>

          {/* Headline */}
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Scheduling that stays{' '}
            <span className="text-primary">open.</span>
          </h1>

          {/* Subheadline */}
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            Share your availability. Prevent double-booking.
            Let others book time that works for everyone—
            automatically, across time zones.
          </p>

          {/* CTA Buttons */}
          <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/signup">Create your OpenSlot →</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="#demo" className="flex items-center gap-2">
                <Play className="h-4 w-4" aria-hidden="true" />
                View demo page
              </Link>
            </Button>
          </div>

          {/* Social proof */}
          <div className="mt-8 flex items-center gap-3">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-8 w-8 rounded-full border-2 border-card bg-muted"
                  aria-hidden="true"
                />
              ))}
            </div>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <svg key={i} className="h-4 w-4 text-yellow-400 fill-current" viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <span className="text-sm text-muted-foreground">Loved by 2,000+ users worldwide</span>
          </div>
        </div>

        {/* Right column - Product preview */}
        <div className="relative">
          {/* No double-booking badge */}
          <div className="absolute -top-3 -right-3 z-10 flex items-center gap-1.5 rounded-full bg-card border border-border px-3 py-1.5 shadow-md">
            <svg className="h-4 w-4 text-success" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.06l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
            </svg>
            <span className="text-xs font-medium text-foreground">No double-booking</span>
          </div>

          {/* Mock booking page */}
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-lg">
            {/* Mock browser chrome */}
            <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-2.5">
              <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
              <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
              <div className="ml-4 flex h-5 flex-1 items-center rounded-sm bg-background px-2">
                <span className="text-[10px] text-muted-foreground">openslot.com/your-openslot</span>
              </div>
            </div>

            {/* Mock booking page content */}
            <div className="grid gap-4 p-4 sm:grid-cols-3 sm:p-6">
              {/* Left panel - Host info */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-full bg-muted" aria-hidden="true" />
                  <div>
                    <div className="text-xs font-medium text-foreground">Sarah Chen</div>
                    <div className="text-[10px] text-muted-foreground">Product Designer</div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span>⏱ 30 min</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span>One-on-one meeting</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span>🌐 Timezone</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">America/New York (EDT)</div>
                </div>
                <p className="text-[10px] text-muted-foreground italic">
                  Let&apos;s find time to connect!<br />Pick a slot that works for you.
                </p>
              </div>

              {/* Middle - Calendar */}
              <div>
                <div className="text-xs font-medium text-foreground mb-2">June 2025</div>
                <div className="grid grid-cols-7 gap-0.5 text-[9px]">
                  {['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].map((d) => (
                    <div key={d} className="flex h-5 items-center justify-center text-muted-foreground font-medium">{d}</div>
                  ))}
                  {Array.from({ length: 35 }, (_, i) => {
                    const day = i - 0 // offset for June 2025 starting on Sunday
                    const isToday = i === 18 // 13th
                    const isHighlighted = i === 16 || i === 17 || i === 18 // 11, 12, 13
                    const isCircled = i === 21 // 16th
                    return (
                      <div
                        key={i}
                        className={`flex h-5 items-center justify-center rounded-full text-[9px] ${
                          isToday ? 'bg-primary text-primary-foreground font-medium' :
                          isHighlighted ? 'text-primary font-medium' :
                          isCircled ? 'border border-primary text-primary' :
                          'text-foreground'
                        }`}
                        aria-hidden="true"
                      >
                        {day >= 0 && day < 35 ? (i < 6 ? 25 + i : i - 5) : ''}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Right - Time slots */}
              <div>
                <div className="text-xs font-medium text-foreground mb-1">Friday, June 13, 2025</div>
                <div className="text-[9px] text-muted-foreground mb-2">Available times</div>
                <div className="space-y-1.5">
                  {['9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM'].map((time, i) => (
                    <div
                      key={time}
                      className={`flex h-6 items-center justify-center rounded-md text-[10px] font-medium ${
                        i === 0
                          ? 'bg-primary text-primary-foreground'
                          : 'border border-border text-foreground'
                      }`}
                      aria-hidden="true"
                    >
                      {time}
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-1 text-[8px] text-muted-foreground">
                  <span className="text-success">●</span> Times adjust to your timezone
                </div>
              </div>
            </div>
          </div>

          {/* Timezone detected badge */}
          <div className="absolute -bottom-3 -left-3 z-10 flex items-center gap-1.5 rounded-full bg-card border border-border px-3 py-1.5 shadow-md">
            <svg className="h-4 w-4 text-primary" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
            </svg>
            <span className="text-xs font-medium text-foreground">Timezone detected</span>
          </div>

          {/* Booking confirmed badge */}
          <div className="absolute -bottom-3 -right-3 z-10 flex items-center gap-1.5 rounded-full bg-card border border-border px-3 py-1.5 shadow-md">
            <svg className="h-4 w-4 text-success" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.06l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
            </svg>
            <span className="text-xs font-medium text-foreground">Booking confirmed</span>
          </div>
        </div>
      </div>
    </section>
  )
}
