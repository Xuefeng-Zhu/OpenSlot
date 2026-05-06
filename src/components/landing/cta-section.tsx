import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function CTASection() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-3xl rounded-lg bg-accent px-6 py-12 text-center sm:px-12 sm:py-16">
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Ready to simplify your scheduling?
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Create your free OpenSlot page and start accepting bookings in minutes.
        </p>
        <div className="mt-8">
          <Button asChild size="lg">
            <Link href="/signup">Create your OpenSlot</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
