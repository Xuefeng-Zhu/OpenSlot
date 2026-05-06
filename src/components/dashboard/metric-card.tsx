import * as React from "react";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function MetricCard({
  title,
  value,
  icon,
  action,
  className,
}: MetricCardProps) {
  return (
    <Card className={cn("p-6", className)}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-accent-foreground"
            aria-hidden="true"
          >
            {icon}
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-semibold text-foreground">{value}</p>
          </div>
        </div>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="text-sm font-medium text-primary hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md px-2 py-1 transition-colors"
          >
            {action.label}
          </button>
        )}
      </div>
    </Card>
  );
}
