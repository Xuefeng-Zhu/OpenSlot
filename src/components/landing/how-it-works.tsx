import { CalendarDays, CheckCircle2, Link2, Users } from "lucide-react";

const steps = [
  {
    number: 1,
    icon: CalendarDays,
    title: "Create your OpenSlot",
    description: "Connect your calendar and set availability preferences.",
  },
  {
    number: 2,
    icon: Link2,
    title: "Share your link",
    description: "Send your OpenSlot link anywhere: email, chat, socials.",
  },
  {
    number: 3,
    icon: Users,
    title: "They pick a time",
    description: "Others see your available times and book what works.",
  },
  {
    number: 4,
    icon: CheckCircle2,
    title: "You stay in sync",
    description: "Events are added to your calendar automatically.",
  },
];

export function HowItWorks() {
  return (
    <section id="use-cases" className="px-5 py-10 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1320px]">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-extrabold uppercase text-primary">
            How it works
          </p>
          <h2 className="mt-2 text-2xl font-extrabold text-foreground sm:text-3xl">
            Get booked in four simple steps
          </h2>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <div
              key={step.number}
              className="relative rounded-[16px] border border-border bg-white p-6 shadow-sm"
            >
              <div className="absolute -left-2 top-6 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-extrabold text-white shadow-sm">
                {step.number}
              </div>
              <div className="ml-7 flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] bg-accent text-primary">
                  <step.icon className="h-7 w-7" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-1 text-sm font-medium leading-6 text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
