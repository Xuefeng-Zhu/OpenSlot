"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Clock3,
  Globe2,
  ShieldCheck,
  Users,
} from "lucide-react";

import { AvatarPhoto, PoweredByOpenSlot } from "@/components/brand/booking-preview";
import { OpenSlotLogo } from "@/components/brand/openslot-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const profile = {
  name: "Alex Kim",
  role: "Product Growth Advisor",
  username: "alex",
  bio: "I help early-stage founders grow smarter. Book time to talk growth, product, or anything in between.",
  timezone: "Pacific Time (PT)",
  response: "Within a few hours",
};

const eventTypes = [
  {
    title: "30 min intro call",
    duration: "30 min",
    description:
      "A quick intro to get to know each other. Perfect for founders exploring ideas.",
    slug: "30-min-intro-call",
    icon: Clock3,
    tone: "bg-emerald-50 text-emerald-600",
    primary: true,
  },
  {
    title: "Strategy session",
    duration: "60 min",
    description:
      "Deep dive into your growth or product strategy. Walk away with actionable next steps.",
    slug: "strategy-session",
    icon: BarChart3,
    tone: "bg-primary/10 text-primary",
    primary: true,
  },
  {
    title: "Office hours",
    duration: "60 min",
    description:
      "Ask me anything. Open Q&A on growth, product, and scaling your startup.",
    slug: "office-hours",
    icon: Users,
    tone: "bg-violet-50 text-violet-600",
    primary: false,
  },
];

export default function PublicProfilePage() {
  return (
    <div className="min-h-screen openslot-page-glow">
      <header className="p-0">
        <div className="mx-auto flex h-[86px] max-w-[1440px] items-center justify-between rounded-b-[18px] border border-t-0 border-border bg-white px-7 shadow-sm sm:px-12">
          <OpenSlotLogo />
          <p className="hidden text-sm font-bold text-muted-foreground sm:block">
            Powered by OpenSlot
          </p>
        </div>
      </header>

      <main className="relative mx-auto grid max-w-[1240px] gap-10 px-5 py-14 lg:grid-cols-[430px_1fr] lg:px-8">
        <div className="openslot-dots pointer-events-none absolute left-0 top-28 hidden h-[130px] w-[130px] opacity-70 lg:block" />
        <Card className="relative z-10 bg-white">
          <CardContent className="p-9">
            <div className="flex flex-col items-center text-center">
              <AvatarPhoto className="h-36 w-36" />
              <h1 className="mt-6 text-4xl font-extrabold text-foreground">
                {profile.name}
              </h1>
              <p className="mt-2 text-lg font-semibold text-muted-foreground">
                {profile.role}
              </p>
              <p className="mt-7 max-w-[280px] text-base font-medium leading-7 text-muted-foreground">
                {profile.bio}
              </p>
            </div>

            <div className="my-8 h-px bg-border" />

            <div className="space-y-6">
              <ProfileFact
                icon={<Globe2 className="h-7 w-7" aria-hidden="true" />}
                title="Timezone"
                value={profile.timezone}
              />
              <ProfileFact
                icon={<Clock3 className="h-7 w-7" aria-hidden="true" />}
                title="Typically responds"
                value={profile.response}
              />
            </div>

            <div className="mt-8 flex gap-4 rounded-[14px] border border-primary/10 bg-primary/[0.06] p-5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] bg-white text-primary shadow-sm">
                <Users className="h-7 w-7" aria-hidden="true" />
              </div>
              <div>
                <p className="font-extrabold text-foreground">Let us connect</p>
                <p className="mt-1 text-sm font-medium leading-6 text-muted-foreground">
                  Choose a time that works for you. I look forward to our conversation.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <section className="relative z-10">
          <h2 className="text-3xl font-extrabold text-foreground">
            Book time with Alex
          </h2>
          <p className="mt-2 text-lg font-medium text-muted-foreground">
            Choose an event type to get started.
          </p>

          <div className="mt-7 space-y-6">
            {eventTypes.map((eventType) => (
              <Link key={eventType.slug} href={`/${profile.username}/${eventType.slug}`}>
                <Card className="block bg-white transition-transform hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md">
                  <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex gap-6">
                      <div
                        className={`flex h-24 w-24 shrink-0 items-center justify-center rounded-[16px] ${eventType.tone}`}
                        aria-hidden="true"
                      >
                        <eventType.icon className="h-10 w-10" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-extrabold text-foreground">
                          {eventType.title}
                        </h3>
                        <p className="mt-2 flex items-center gap-2 text-sm font-bold text-muted-foreground">
                          <Clock3 className="h-4 w-4" aria-hidden="true" />
                          {eventType.duration}
                        </p>
                        <p className="mt-3 max-w-[480px] text-base font-medium leading-7 text-muted-foreground">
                          {eventType.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex min-w-[140px] flex-row items-center justify-between gap-4 sm:flex-col">
                      {eventType.primary ? (
                        <Button>Book</Button>
                      ) : (
                        <Button variant="outline" size="icon" aria-label={`Book ${eventType.title}`}>
                          <ArrowRight className="h-5 w-5" aria-hidden="true" />
                        </Button>
                      )}
                      <span className="font-bold text-muted-foreground">Free</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <div className="mt-6 flex gap-4 rounded-[14px] border border-primary/10 bg-primary/[0.07] p-5">
            <ShieldCheck className="h-8 w-8 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="font-extrabold text-foreground">Your time is respected</p>
              <p className="text-sm font-medium text-muted-foreground">
                No double-booking. Times are shown in your local timezone.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-white/70 px-5 py-7 text-center">
        <PoweredByOpenSlot />
        <p className="mt-2 text-sm font-medium text-muted-foreground">
          Share availability. Prevent double-booking. Let others book time that works for everyone.
        </p>
      </footer>
    </div>
  );
}

function ProfileFact({
  icon,
  title,
  value,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="text-primary">{icon}</div>
      <div>
        <p className="font-extrabold text-foreground">{title}</p>
        <p className="font-medium text-muted-foreground">{value}</p>
      </div>
    </div>
  );
}
