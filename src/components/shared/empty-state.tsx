import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface EmptyStateProps {
  icon: React.ReactNode;
  heading: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: "default" | "outline";
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
}

export function EmptyState({
  icon,
  heading,
  description,
  action,
  secondaryAction,
  className,
  headingLevel = 3,
}: EmptyStateProps) {
  const Heading =
    headingLevel === 1
      ? "h1"
      : headingLevel === 2
        ? "h2"
        : headingLevel === 3
          ? "h3"
          : headingLevel === 4
            ? "h4"
            : headingLevel === 5
              ? "h5"
              : "h6";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center",
        className
      )}
    >
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-sm"
        aria-hidden="true"
      >
        {icon}
      </div>
      <Heading className="mt-4 text-lg font-semibold text-foreground">
        {heading}
      </Heading>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-col items-center gap-2 sm:flex-row">
          {action && (
            <Button
              variant={action.variant ?? "default"}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="outline" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
