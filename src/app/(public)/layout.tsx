import Link from "next/link";
import { AppIcon } from "@/components/shared/app-icon";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Public header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link
            href="/"
            className="flex items-center text-lg font-bold text-foreground"
          >
            <AppIcon className="mr-2 h-6 w-6" />
            OpenSlot
          </Link>
          <span className="text-sm text-muted-foreground">
            Powered by OpenSlot
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:py-10">
        {children}
      </main>
    </div>
  );
}
