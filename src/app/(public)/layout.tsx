import Link from "next/link";
import { AppIcon } from "@/components/shared/app-icon";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[#f8fbff] text-foreground">
      <header className="sticky top-0 z-40 px-0 py-0">
        <div className="mx-auto flex w-full max-w-[1448px] items-center justify-between rounded-b-2xl border border-border/80 bg-card/95 px-6 py-6 shadow-sm shadow-slate-200/70 backdrop-blur sm:rounded-2xl lg:px-12">
          <Link
            href="/"
            className="flex items-center text-xl font-bold text-foreground"
          >
            <AppIcon className="mr-2 h-8 w-8" />
            OpenSlot
          </Link>
          <span className="text-sm font-medium text-muted-foreground">
            Powered by OpenSlot
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        {children}
      </main>
    </div>
  );
}
