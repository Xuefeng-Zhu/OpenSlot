import { routeMetadata } from '@/app/route-metadata'

export const metadata = routeMetadata.onboarding

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
