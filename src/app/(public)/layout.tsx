import Link from "next/link";
import { AppIcon } from "@/components/shared/app-icon";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Public header */}
      <header className="border-b border-border bg-card px-4 py-3">
        <div className="mx-auto max-w-4xl flex items-center justify-between">
          <Link href="/" className="flex items-center text-lg font-bold text-foreground">
            <AppIcon className="mr-2 h-6 w-6" />
            OpenSlot
          </Link>
          <span className="text-sm text-muted-foreground">Powered by OpenSlot</span>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8">
        {children}
      </main>
    </div>
  );
}
