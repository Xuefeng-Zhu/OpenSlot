import { routeMetadata } from "@/app/route-metadata";

export const metadata = routeMetadata.account;

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-background">
      {children}
    </main>
  );
}
