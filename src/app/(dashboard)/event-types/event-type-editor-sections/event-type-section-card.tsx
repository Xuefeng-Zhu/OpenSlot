import type { ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { FormSection } from "./event-type-section-types";

interface EventTypeSectionCardProps {
  section: FormSection;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function EventTypeSectionCard({
  section,
  open,
  onToggle,
  children,
}: EventTypeSectionCardProps) {
  return (
    <Card>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-t-lg"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground" aria-hidden="true">
            {section.icon}
          </span>
          <span className="text-sm font-medium">{section.title}</span>
        </div>
        {open ? (
          <ChevronDown
            className="h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
        ) : (
          <ChevronRight
            className="h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
        )}
      </button>
      {open ? (
        <CardContent className="pt-0 pb-4 px-4">{children}</CardContent>
      ) : null}
    </Card>
  );
}
