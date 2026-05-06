import { Navbar } from '@/components/landing/navbar'
import { HeroSection } from '@/components/landing/hero-section'
import { FeatureCards } from '@/components/landing/feature-cards'
import { HowItWorks } from '@/components/landing/how-it-works'
import { CTASection } from '@/components/landing/cta-section'

export default function HomePage() {
  return (
    <div className="min-h-screen openslot-page-glow">
      <Navbar />
      <main>
        <HeroSection />
        <FeatureCards />
        <HowItWorks />
        <CTASection />
      </main>
      <footer className="px-4 py-8 text-center text-sm font-medium text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} OpenSlot. All rights reserved.</p>
      </footer>
    </div>
  )
}
