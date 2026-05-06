const steps = [
  {
    number: 1,
    title: 'Create your profile',
    description:
      'Sign up and set up your public scheduling page in minutes.',
  },
  {
    number: 2,
    title: 'Set your availability',
    description:
      'Define your weekly hours and let OpenSlot handle the rest.',
  },
  {
    number: 3,
    title: 'Share your link',
    description:
      'Send your booking link to clients, colleagues, or anyone who needs time with you.',
  },
  {
    number: 4,
    title: 'Get booked',
    description:
      'Guests pick a time that works for them, and you both get a confirmation.',
  },
]

export function HowItWorks() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            How it works
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Get up and running in four simple steps.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <div key={step.number} className="text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {step.number}
              </div>
              <h3 className="mt-4 text-base font-semibold text-foreground">
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
