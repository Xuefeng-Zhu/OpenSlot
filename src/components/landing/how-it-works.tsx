import { Calendar, Link2, Clock, CheckCircle } from 'lucide-react'

const steps = [
  {
    number: 1,
    icon: Calendar,
    title: 'Create your OpenSlot',
    description:
      'Connect your calendar and set your availability preferences.',
  },
  {
    number: 2,
    icon: Link2,
    title: 'Share your link',
    description:
      'Send your OpenSlot link anywhere—email, chat, socials, you name it.',
  },
  {
    number: 3,
    icon: Clock,
    title: 'They pick a time',
    description:
      'Others see your available times and book what works for them.',
  },
  {
    number: 4,
    icon: CheckCircle,
    title: 'You stay in sync',
    description:
      'Events are added to your calendar automatically. Everyone stays on track.',
  },
]

export function HowItWorks() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            HOW IT WORKS
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Get booked in four simple steps
          </h2>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <div key={step.number} className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {step.number}
              </div>
              <div className="mt-4 mx-auto flex h-10 w-10 items-center justify-center">
                <step.icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              </div>
              <h3 className="mt-2 text-base font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
