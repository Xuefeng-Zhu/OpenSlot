import { CalendarDays, CheckCircle2, Clock, Globe2, Link2, ShieldCheck, Users } from "lucide-react";

import { cn } from "@/lib/utils";

const days = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const calendarCells = [
  "25",
  "26",
  "27",
  "28",
  "29",
  "30",
  "31",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
  "22",
  "23",
  "24",
  "25",
  "26",
  "27",
  "28",
];

export function AvatarPhoto({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-full bg-[linear-gradient(145deg,#e8f1ff,#fff)] shadow-inner",
        className
      )}
      aria-hidden="true"
    >
      <div className="absolute left-1/2 top-[16%] h-[34%] w-[34%] -translate-x-1/2 rounded-full bg-[#1f2937]" />
      <div className="absolute left-[22%] top-[48%] h-[42%] w-[56%] rounded-t-full bg-[#0f172a]" />
      <div className="absolute left-[32%] top-[26%] h-[29%] w-[36%] rounded-full bg-[#f2c9a5]" />
      <div className="absolute left-[29%] top-[21%] h-[22%] w-[42%] rounded-t-full bg-[#111827]" />
      <div className="absolute inset-x-[12%] bottom-0 h-[29%] rounded-t-[999px] bg-[#1265f3]" />
    </div>
  );
}

export function MiniCalendar({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("rounded-[14px] bg-white", className)}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">June 2025</h3>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span aria-hidden="true">&lt;</span>
          <span aria-hidden="true">&gt;</span>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-2 text-center">
        {days.map((day) => (
          <div key={day} className="text-[10px] font-bold text-muted-foreground">
            {day}
          </div>
        ))}
        {calendarCells.map((cell, index) => {
          const isSelected = cell === "13" && index === 19;
          const isSoft = ["11", "12", "16"].includes(cell);
          const isMuted = index < 7 || index > 31;
          return (
            <div
              key={`${cell}-${index}`}
              className={cn(
                "mx-auto flex items-center justify-center rounded-full text-xs font-semibold",
                compact ? "h-7 w-7" : "h-8 w-8",
                isSelected
                  ? "bg-primary text-white shadow-[0_8px_16px_-10px_hsl(var(--primary))]"
                  : isSoft
                  ? "bg-primary/10 text-primary"
                  : isMuted
                  ? "text-muted-foreground/60"
                  : "text-muted-foreground"
              )}
            >
              {cell}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TimeSlots({ selected = "9:00 AM" }: { selected?: string }) {
  const slots = ["9:00 AM", "10:00 AM", "11:00 AM", "1:00 PM", "2:00 PM", "3:00 PM"];

  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-sm font-bold text-foreground">Friday, June 13, 2025</h3>
        <p className="mt-1 text-xs text-muted-foreground">Available times</p>
      </div>
      {slots.map((slot) => (
        <button
          key={slot}
          type="button"
          className={cn(
            "h-9 w-full rounded-[8px] border text-xs font-bold transition-colors",
            slot === selected
              ? "border-primary bg-primary text-white"
              : "border-border bg-white text-foreground hover:border-primary/50"
          )}
        >
          {slot}
        </button>
      ))}
      <div className="flex items-center gap-2 pt-1 text-[11px] text-muted-foreground">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        Times adjust to your timezone
      </div>
    </div>
  );
}

export function BookingPreview({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative rounded-[18px] border border-border bg-white shadow-lg",
        className
      )}
    >
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff6b5f]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#f7b955]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#56c271]" />
        <div className="ml-4 flex h-8 min-w-0 flex-1 items-center gap-2 rounded-[10px] border border-border bg-muted/45 px-3 text-xs font-semibold text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          openslot.com/your-openslot
        </div>
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-[0.8fr_1.2fr_0.8fr]">
        <div className="rounded-[14px] border border-border p-4">
          <AvatarPhoto className="mx-auto h-16 w-16" />
          <div className="mt-3 text-center">
            <p className="font-bold text-foreground">Sarah Chen</p>
            <p className="text-xs text-muted-foreground">Product Designer</p>
          </div>
          <div className="mt-5 space-y-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" aria-hidden="true" />
              <span>
                <strong className="text-foreground">30 min</strong>
                <br />
                One-on-one meeting
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Globe2 className="h-4 w-4" aria-hidden="true" />
              <span>
                <strong className="text-foreground">Timezone</strong>
                <br />
                America/New York
              </span>
            </div>
          </div>
        </div>
        <MiniCalendar className="border border-border p-4" />
        <div className="rounded-[14px] border border-border p-4">
          <TimeSlots />
        </div>
      </div>
    </div>
  );
}

export const previewFeatures = [
  {
    icon: Globe2,
    title: "Timezone aware",
    description: "We detect timezones automatically and show times that make sense for everyone.",
    tone: "violet",
  },
  {
    icon: ShieldCheck,
    title: "Prevent double-booking",
    description: "OpenSlot syncs with your calendar in real time to keep your schedule conflict-free.",
    tone: "green",
  },
  {
    icon: Users,
    title: "Share availability",
    description: "Create your OpenSlot in seconds and share a link. Others see only the times you're free.",
    tone: "blue",
  },
];

export function PoweredByOpenSlot() {
  return (
    <div className="flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground">
      <CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" />
      Powered by <span className="text-primary">OpenSlot</span>
    </div>
  );
}

export function LinkIconBadge() {
  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-primary/10 text-primary">
      <Link2 className="h-5 w-5" aria-hidden="true" />
    </div>
  );
}

export function ConfirmationToast({ className }: { className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-2 rounded-[10px] border border-border bg-white px-4 py-3 text-sm font-bold text-foreground shadow-md", className)}>
      <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden="true" />
      Booking confirmed
    </div>
  );
}
