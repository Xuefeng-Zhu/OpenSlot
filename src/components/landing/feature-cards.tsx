import { Calendar, Shield, Globe, TrendingUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

const features = [
  {
    icon: Calendar,
    title: 'Share availability',
    description:
      'Publish your schedule and let others book time with you — no back-and-forth emails needed.',
  },
  {
    icon: Shield,
    title: 'Prevent double-booking',
    description:
      'Real-time slot holds ensure no two guests can book the same time, keeping your calendar conflict-free.',
  },
  {
    icon: Globe,
    title: 'Timezone aware',
    description:
      'Guests see available times in their own timezone, so everyone shows up at the right time.',
  },
  {
    icon: TrendingUp,
    title: 'Built to grow',
    description:
      'From solo freelancers to growing teams, OpenSlot scales with your scheduling needs.',
  },
]

export function FeatureCards() {
  return (
    <section id="features" className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Everything you need to get booked
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Simple tools that make scheduling effortless for you and your guests.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-7xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <Card key={feature.title} className="border-border bg-card">
              <CardContent className="p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                  <feature.icon
                    className="h-5 w-5 text-accent-foreground"
                    aria-hidden="true"
                  />
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
