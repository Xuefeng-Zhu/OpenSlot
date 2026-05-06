import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const avatarVariants = cva(
  "relative inline-flex items-center justify-center rounded-full overflow-hidden shrink-0",
  {
    variants: {
      size: {
        sm: "h-8 w-8 text-xs",
        md: "h-10 w-10 text-sm",
        lg: "h-16 w-16 text-lg",
      },
    },
    defaultVariants: { size: "md" },
  }
);

/**
 * Generate initials from a name string.
 * Returns 1–2 uppercase alphabetic characters:
 * - For multi-word names: first alpha character of first word + first alpha character of last word
 * - For single-word names: first alpha character only
 * - Words without alphabetic characters are skipped
 */
export function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";

  // Extract words that contain at least one alphabetic character
  const words = trimmed
    .split(/\s+/)
    .filter((w) => w.length > 0 && /[a-zA-Z]/.test(w));

  if (words.length === 0) return "";

  const firstInitial = getFirstAlpha(words[0]);

  if (words.length === 1) {
    return firstInitial.toUpperCase();
  }

  const lastInitial = getFirstAlpha(words[words.length - 1]);
  return (firstInitial + lastInitial).toUpperCase();
}

function getFirstAlpha(word: string): string {
  for (const char of word) {
    if (/[a-zA-Z]/.test(char)) {
      return char;
    }
  }
  return "";
}

export interface AvatarProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children">,
    VariantProps<typeof avatarVariants> {
  src?: string | null;
  alt: string;
  fallback: string;
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, alt, fallback, size, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(avatarVariants({ size, className }))}
        {...props}
      >
        {src ? (
          <img
            src={src}
            alt={alt}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-accent text-accent-foreground font-medium">
            {fallback}
          </div>
        )}
      </div>
    );
  }
);
Avatar.displayName = "Avatar";

export { Avatar, avatarVariants };
