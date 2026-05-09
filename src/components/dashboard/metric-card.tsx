import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

type MetricCardAction =
  | {
      label: string;
      onClick: () => void;
      href?: never;
    }
  | {
      label: string;
      href: string;
      onClick?: never;
    };

export interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  action?: MetricCardAction;
  subtitle?: string;
  valueClassName?: string;
  className?: string;
}

const actionClassName =
  "text-sm font-medium text-primary hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md transition-colors flex items-center gap-1";

export function MetricCard({
  title,
  value,
  icon,
  action,
  subtitle,
  valueClassName,
  className,
}: MetricCardProps) {
  return (
    <Card className={cn("p-5 transition-colors hover:border-primary/30", className)}>
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground"
          aria-hidden="true"
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p
            className={cn(
              "mt-0.5 truncate text-xl font-semibold text-foreground",
              valueClassName
            )}
          >
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {action && (
        <div className="mt-3 pt-3 border-t border-border">
          {action.href ? (
            <Link href={action.href} className={actionClassName}>
              {action.label}
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className={actionClassName}
            >
              {action.label}
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
