import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { cn } from "@/lib/utils";

interface OpenSlotLogoProps {
  href?: string;
  className?: string;
  markClassName?: string;
  textClassName?: string;
}

export function OpenSlotLogo({
  href = "/",
  className,
  markClassName,
  textClassName,
}: OpenSlotLogoProps) {
  const content = (
    <>
      <span
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-[8px] bg-primary text-primary-foreground shadow-[0_8px_18px_-12px_hsl(var(--primary))]",
          markClassName
        )}
        aria-hidden="true"
      >
        <CalendarDays className="h-5 w-5" strokeWidth={2.5} />
      </span>
      <span
        className={cn(
          "text-[1.35rem] font-extrabold leading-none text-foreground",
          textClassName
        )}
      >
        OpenSlot
      </span>
    </>
  );

  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2.5", className)}
    >
      {content}
    </Link>
  );
}
