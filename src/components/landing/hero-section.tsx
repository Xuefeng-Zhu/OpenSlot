import Link from "next/link";
import { ArrowRight, Check, CirclePlay, Sparkles, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  BookingPreview,
  ConfirmationToast,
} from "@/components/brand/booking-preview";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-5 pb-10 pt-14 sm:px-8 lg:px-10 lg:pb-14 lg:pt-20">
      <div className="openslot-dots pointer-events-none absolute right-0 top-36 hidden h-[360px] w-[360px] opacity-70 lg:block" />
      <div className="mx-auto grid max-w-[1320px] items-center gap-12 lg:grid-cols-[0.88fr_1.12fr]">
        <div className="relative z-10">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-bold text-primary">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            The open way to schedule
          </div>
          <h1 className="max-w-[620px] text-[3.1rem] font-extrabold leading-[1.05] text-foreground sm:text-[4.4rem] lg:text-[5.2rem]">
            Scheduling that stays <span className="text-primary">open.</span>
          </h1>
          <p className="mt-6 max-w-[560px] text-lg font-medium leading-8 text-muted-foreground sm:text-xl">
            Share your availability. Prevent double-booking. Let others book
            time that works for everyone automatically, across time zones.
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <Button asChild size="lg" className="min-w-[210px]">
              <Link href="/signup">
                Create your OpenSlot
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="min-w-[180px]">
              <Link href="#demo">
                <CirclePlay className="mr-2 h-5 w-5" aria-hidden="true" />
                View demo page
              </Link>
            </Button>
          </div>
          <div className="mt-9 flex items-center gap-4">
            <div className="flex -space-x-2">
              {["SC", "JW", "EP"].map((initials) => (
                <div
                  key={initials}
                  className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-primary/10 text-xs font-extrabold text-primary shadow-sm"
                >
                  {initials}
                </div>
              ))}
              <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-primary text-xs font-extrabold text-white shadow-sm">
                +2k
              </div>
            </div>
            <div className="text-sm font-semibold text-muted-foreground">
              <div className="mb-1 flex gap-0.5 text-amber-400">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star
                    key={index}
                    className="h-4 w-4 fill-current"
                    aria-hidden="true"
                  />
                ))}
              </div>
              Loved by 2,000+ users worldwide
            </div>
          </div>
        </div>

        <div className="relative" id="demo">
          <div className="absolute -right-3 top-8 z-10 hidden rounded-[12px] border border-border bg-white px-4 py-3 text-sm font-bold text-foreground shadow-md sm:flex">
            <span className="mr-2 h-5 w-5 rounded-full bg-emerald-500 text-center text-white">
              <Check className="mx-auto h-5 w-3.5" aria-hidden="true" />
            </span>
            No double-booking
          </div>
          <BookingPreview />
          <ConfirmationToast className="absolute -bottom-7 right-8 hidden sm:inline-flex" />
          <div className="absolute -left-9 top-1/2 hidden rounded-[14px] border border-border bg-white px-4 py-3 text-sm font-bold text-foreground shadow-md lg:block">
            Timezone
            <br />
            <span className="text-muted-foreground">detected</span>
          </div>
        </div>
      </div>
    </section>
  );
}
