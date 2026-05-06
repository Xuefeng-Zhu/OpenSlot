import Link from 'next/link'
import { Play, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function CTASection() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-4xl rounded-xl bg-accent px-6 py-12 text-center sm:px-12 sm:py-16">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 mb-6">
          <Calendar className="h-7 w-7 text-primary" aria-hidden="true" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Ready to keep your schedule open?
        </h2>
        <p className="mt-3 text-base text-muted-foreground">
          Join thousands of professionals who book smarter with OpenSlot.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg">
            <Link href="/signup">Create your OpenSlot →</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="#demo" className="flex items-center gap-2">
              <Play className="h-4 w-4" aria-hidden="true" />
              View demo page
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
