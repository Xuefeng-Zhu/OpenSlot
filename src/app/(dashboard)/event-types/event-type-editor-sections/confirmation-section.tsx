import { Badge } from "@/components/ui/badge";

export function ConfirmationSection() {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Custom confirmation messages will be available in a future update.
      </p>
      <Badge variant="secondary">Coming soon</Badge>
    </div>
  );
}
