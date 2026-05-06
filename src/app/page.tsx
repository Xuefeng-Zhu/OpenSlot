import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
          OpenSlot
        </h1>

        <p className="mt-6 text-xl text-muted-foreground">
          Share availability. Book time. Stay in sync.
        </p>

        <p className="mt-4 text-lg text-muted-foreground">
          Create your public scheduling page, define when you&apos;re available,
          and let others book time with you — no back-and-forth needed.
        </p>

        <div className="mt-10 flex items-center justify-center gap-4">
          <Button asChild size="lg">
            <Link href="/signup">Get Started</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/login">Log In</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
