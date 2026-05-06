import Link from "next/link";
import { ArrowRight, CalendarCheck2, CirclePlay } from "lucide-react";

import { Button } from "@/components/ui/button";

export function CTASection() {
  return (
    <section className="px-5 py-8 sm:px-8 lg:px-10">
      <div className="mx-auto flex max-w-[1320px] flex-col items-center justify-between gap-6 rounded-[18px] border border-primary/10 bg-primary/[0.07] px-8 py-8 shadow-sm sm:flex-row">
        <div className="flex items-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-[16px] bg-primary/10 text-primary">
            <CalendarCheck2 className="h-9 w-9" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-foreground">
              Ready to keep your schedule open?
            </h2>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              Join thousands of professionals who book smarter with OpenSlot.
            </p>
          </div>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Button asChild size="lg" className="min-w-[200px]">
            <Link href="/signup">
              Create your OpenSlot
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="min-w-[170px]">
            <Link href="#demo">
              <CirclePlay className="mr-2 h-5 w-5" aria-hidden="true" />
              View demo page
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
