import Link from "next/link";
import type { ElementType, ReactNode } from "react";
import {
  ArrowRight,
  CalendarX,
  Clock,
  Globe2,
  ShieldCheck,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { AppIcon } from "@/components/shared/app-icon";
import { EmptyState } from "@/components/shared/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export interface ProfileData {
  name: string;
  username: string;
  avatar_url: string | null;
  default_timezone: string;
  public_headline: string | null;
  public_bio: string | null;
  response_time_label: string | null;
}

export interface EventTypeData {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  duration_minutes: number;
  location_type: string;
  video_provider?: string | null;
}

interface PublicProfileContentProps {
  profile: ProfileData;
  activeEventTypes: EventTypeData[];
}

export function PublicProfileContent({
  profile,
  activeEventTypes,
}: PublicProfileContentProps) {
  const firstName = profile.name.split(" ")[0] || profile.name;
  const fallback = profile.name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative mx-auto max-w-6xl overflow-hidden">
      <DottedMap className="left-0 top-16 hidden h-36 w-56 -translate-x-20 md:block" />
      <DottedMap className="right-0 top-80 hidden h-40 w-72 translate-x-12 md:block" />
      <DottedMap className="bottom-28 right-8 hidden h-48 w-64 translate-x-20 lg:block" />

      <div className="relative grid grid-cols-1 gap-10 lg:grid-cols-[460px_minmax(0,1fr)] lg:items-start">
        <Card className="rounded-2xl border-[#dfe7f4] bg-white/95 shadow-lg shadow-slate-200/60 lg:sticky lg:top-32">
          <CardContent className="flex flex-col items-center px-7 py-10 text-center sm:px-10">
            <Avatar
              src={profile.avatar_url}
              alt={`${profile.name}'s avatar`}
              fallback={fallback}
              size="xl"
              className="shadow-md shadow-slate-300/60"
            />
            <h1 className="mt-6 text-4xl font-bold leading-tight text-[#061943]">
              {profile.name}
            </h1>
            {profile.public_headline ? (
              <p className="mt-3 text-xl font-medium text-[#5c6c8d]">
                {profile.public_headline}
              </p>
            ) : null}
            {profile.public_bio ? (
              <p className="mt-7 max-w-[300px] text-left text-base leading-7 text-[#5c6c8d] sm:text-center">
                {profile.public_bio}
              </p>
            ) : null}

            <div className="mt-9 w-full border-t border-[#dfe7f4] pt-7">
              <div className="space-y-6 text-left">
                <ProfileFact
                  icon={<Globe2 className="h-7 w-7" aria-hidden="true" />}
                  label="Timezone"
                  value={profile.default_timezone}
                />
                {profile.response_time_label ? (
                  <ProfileFact
                    icon={<Clock className="h-7 w-7" aria-hidden="true" />}
                    label="Typically responds"
                    value={profile.response_time_label}
                  />
                ) : null}
              </div>
            </div>

            <div className="mt-9 w-full rounded-xl border border-[#dbe8ff] bg-[#f2f7ff] p-5 text-left shadow-inner shadow-white">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#e8f1ff] text-primary">
                  <UsersRound className="h-8 w-8" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-base font-bold text-[#061943]">
                    Let&apos;s connect
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[#465678]">
                    Choose a time that works for you. I look forward to our conversation!
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <section aria-labelledby="profile-booking-heading" className="pt-4 lg:pt-5">
          <div className="mb-7">
            <h2
              id="profile-booking-heading"
              className="text-3xl font-bold tracking-tight text-[#061943] sm:text-4xl"
            >
              Book time with {firstName}
            </h2>
            <p className="mt-3 text-xl leading-7 text-[#5c6c8d]">
              Choose an event type to get started.
            </p>
          </div>

          {activeEventTypes.length === 0 ? (
            <EmptyState
              icon={<CalendarX className="h-6 w-6" aria-hidden="true" />}
              heading="No event types available"
              description="This host does not have any active booking options right now. Check back later or contact them directly."
            />
          ) : (
            <div className="space-y-6">
              {activeEventTypes.map((eventType, index) => (
                <EventTypeCard
                  key={eventType.id}
                  eventType={eventType}
                  href={`/${profile.username}/${eventType.slug}`}
                  visual={EVENT_VISUALS[index % EVENT_VISUALS.length]}
                />
              ))}
            </div>
          )}

          <div className="mt-8 rounded-xl bg-[#eef5ff] px-5 py-4 text-[#465678]">
            <div className="flex items-center gap-4">
              <ShieldCheck className="h-8 w-8 shrink-0 text-primary" aria-hidden="true" />
              <p className="text-sm leading-6 sm:text-base">
                <span className="font-bold text-[#061943]">Your time is respected</span>
                <br className="sm:hidden" /> No double-booking. Times are shown in your local timezone.
              </p>
            </div>
          </div>
        </section>
      </div>

      <footer className="mt-16 border-t border-[#dfe7f4] pt-8 text-center">
        <p className="flex items-center justify-center gap-3 text-xl font-bold text-[#061943]">
          <AppIcon className="h-7 w-7" />
          Scheduling that stays <span className="text-primary">open.</span>
        </p>
        <p className="mt-2 text-base text-[#5c6c8d]">
          Share availability. Prevent double-booking. Let others book time that works for everyone.
        </p>
      </footer>
    </div>
  );
}

function ProfileFact({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center text-primary">
        {icon}
      </div>
      <div>
        <p className="text-base font-bold text-[#061943]">{label}</p>
        <p className="mt-1 text-base text-[#465678]">{value}</p>
      </div>
    </div>
  );
}

interface EventVisual {
  icon: ElementType;
  className: string;
  iconClassName: string;
}

const EVENT_VISUALS: EventVisual[] = [
  {
    icon: Clock,
    className: "bg-[#e9f7ef] text-[#0f9a55]",
    iconClassName: "h-12 w-12",
  },
  {
    icon: TrendingUp,
    className: "bg-[#eef5ff] text-primary",
    iconClassName: "h-12 w-12",
  },
  {
    icon: UsersRound,
    className: "bg-[#f3edff] text-[#7c3aed]",
    iconClassName: "h-12 w-12",
  },
];

function EventTypeCard({
  eventType,
  href,
  visual,
}: {
  eventType: EventTypeData;
  href: string;
  visual: EventVisual;
}) {
  const Icon = visual.icon;

  return (
    <Card className="rounded-2xl border-[#dfe7f4] bg-white/95 shadow-md shadow-slate-200/60 transition-colors hover:border-primary/40">
      <CardContent className="p-6 sm:p-7">
        <div className="grid gap-5 sm:grid-cols-[6rem_minmax(0,1fr)_7rem] sm:items-start">
          <div
            className={`flex h-24 w-24 items-center justify-center rounded-2xl ${visual.className}`}
          >
            <Icon className={visual.iconClassName} aria-hidden="true" strokeWidth={2.4} />
          </div>

          <div className="min-w-0">
            <h3 className="text-2xl font-bold leading-tight text-[#061943]">
              {eventType.title}
            </h3>
            <div className="mt-3 flex items-center gap-2 text-base font-medium text-[#5c6c8d]">
              <Clock className="h-5 w-5" aria-hidden="true" />
              <span>{eventType.duration_minutes} min</span>
            </div>
            {eventType.description ? (
              <p className="mt-4 max-w-[440px] text-base leading-7 text-[#465678]">
                {eventType.description}
              </p>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-stretch">
            <Button asChild className="h-12 rounded-lg px-8 text-base">
              <Link href={href}>
                <span>Book</span>
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <p className="text-center text-base font-semibold text-[#5c6c8d]">
              Free
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DottedMap({ className }: { className: string }) {
  return (
    <div
      className={`pointer-events-none absolute opacity-60 ${className}`}
      aria-hidden="true"
      style={{
        backgroundImage:
          "radial-gradient(circle at 2px 2px, rgba(37, 99, 235, 0.18) 2px, transparent 0)",
        backgroundSize: "12px 12px",
        maskImage:
          "radial-gradient(ellipse at center, black 0 55%, transparent 78%)",
      }}
    />
  );
}
