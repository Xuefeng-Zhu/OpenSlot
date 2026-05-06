import { Calendar, Shield, Globe, TrendingUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

const features = [
  {
    icon: Calendar,
    title: 'Share availability',
    description:
      'Create your OpenSlot in seconds and share a link. Others see only the times you\'re free.',
    iconBg: 'bg-accent',
    iconColor: 'text-primary',
  },
  {
    icon: Shield,
    title: 'Prevent double-booking',
    description:
      'OpenSlot syncs with your calendar in real time to keep your schedule conflict-free.',
    iconBg: 'bg-success/10',
    iconColor: 'text-success',
  },
  {
    icon: Globe,
    title: 'Timezone aware',
    description:
      'We detect timezones automatically and show times that make sense for everyone.',
    iconBg: 'bg-accent',
    iconColor: 'text-primary',
  },
  {
    icon: TrendingUp,
    title: 'Built to grow',
    description:
      'From solo professionals to large teams—scales with your workflow and organization.',
    iconBg: 'bg-warning/10',
    iconColor: 'text-warning',
  },
]

export function FeatureCards() {
  return (
    <section id="features" className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto mt-12 grid max-w-7xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <Card key={feature.title} className="border-border bg-card">
              <CardContent className="p-6">
                <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${feature.iconBg}`}>
                  <feature.icon
                    className={`h-6 w-6 ${feature.iconColor}`}
                    aria-hidden="true"
                  />
                </div>
                <h3 className="text-base font-semibold text-foreground">
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
