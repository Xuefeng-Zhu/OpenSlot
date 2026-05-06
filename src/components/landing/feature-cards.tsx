import { Calendar, Shield, Globe, TrendingUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

const features = [
  {
    icon: Calendar,
    title: 'Share availability',
    description:
      'Publish your schedule and let others book time with you, no back-and-forth emails needed.',
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
    <section id="features" className="px-5 py-8 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1320px]">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <Card key={feature.title} className="bg-white">
              <CardContent className="p-6">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[12px] bg-accent">
                  <feature.icon
                    className="h-5 w-5 text-primary"
                    aria-hidden="true"
                  />
                </div>
                <h3 className="text-lg font-extrabold text-foreground">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm font-medium leading-6 text-muted-foreground">
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
