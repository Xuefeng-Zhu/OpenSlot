import { CalendarCheck, Clock3, Globe2, ShieldCheck } from "lucide-react";

import { AppIcon } from "@/components/shared/app-icon";
import { cn } from "@/lib/utils";

const proofPoints = [
  {
    icon: Globe2,
    title: "Timezone aware",
    description: "Guests see times in their local timezone.",
  },
  {
    icon: ShieldCheck,
    title: "Conflict guarded",
    description: "Holds and bookings protect each available slot.",
  },
  {
    icon: CalendarCheck,
    title: "Ready to share",
    description: "Public booking pages stay focused on conversion.",
  },
];

interface AuthBrandPanelProps {
  className?: string;
}

export function AuthBrandPanel({ className }: AuthBrandPanelProps) {
  return (
    <aside
      className={cn(
        "hidden flex-1 items-center justify-center border-l border-border bg-gradient-to-br from-card via-accent/35 to-background p-12 lg:flex",
        className
      )}
      aria-label="OpenSlot preview"
    >
      <div className="w-full max-w-xl space-y-8">
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-card shadow-sm">
            <AppIcon className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-4xl font-bold leading-tight tracking-tight text-foreground">
              A booking page that feels ready before you share it.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-base leading-7 text-muted-foreground">
              OpenSlot keeps the guest path simple: choose a time, hold the
              slot, and confirm with confidence.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 shadow-lg shadow-slate-200/70">
          <div className="mb-4 flex items-center justify-between border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-muted" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Sarah Chen
                </p>
                <p className="text-xs text-muted-foreground">
                  Product Designer
                </p>
              </div>
            </div>
            <div className="rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
              Available
            </div>
          </div>

          <div className="grid grid-cols-[1fr_160px] gap-5">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  May 2026
                </p>
                <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
                  {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                    <span key={`${day}-${index}`} className="font-medium">
                      {day}
                    </span>
                  ))}
                  {Array.from({ length: 28 }, (_, index) => {
                    const selected = index === 12;
                    const open = index === 10 || index === 11 || index === 15;

                    return (
                      <span
                        key={index}
                        className={cn(
                          "flex h-6 items-center justify-center rounded-full text-[11px]",
                          selected &&
                            "bg-primary font-semibold text-primary-foreground",
                          open && !selected && "font-semibold text-primary",
                          !open && !selected && "text-foreground"
                        )}
                      >
                        {index + 1}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div className="rounded-md border border-border bg-muted/40 p-3">
                  <Clock3 className="mb-2 h-4 w-4 text-primary" />
                  30 minutes
                </div>
                <div className="rounded-md border border-border bg-muted/40 p-3">
                  <Globe2 className="mb-2 h-4 w-4 text-primary" />
                  Local timezone
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">
                Available times
              </p>
              <div className="mt-2 space-y-2">
                {["9:00 AM", "10:00 AM", "11:00 AM", "1:00 PM", "2:00 PM"].map(
                  (time, index) => (
                    <div
                      key={time}
                      className={cn(
                        "flex h-8 items-center justify-center rounded-md border text-xs font-semibold",
                        index === 0
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-foreground"
                      )}
                    >
                      {time}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {proofPoints.map((point) => (
            <div
              key={point.title}
              className="rounded-lg border border-border bg-card/80 p-4 text-center shadow-sm"
            >
              <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-md bg-accent text-primary">
                <point.icon className="h-4 w-4" aria-hidden="true" />
              </div>
              <p className="mt-2 text-xs font-semibold text-foreground">
                {point.title}
              </p>
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                {point.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
