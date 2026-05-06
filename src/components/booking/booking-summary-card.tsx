import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface BookingSummaryCardProps {
  hostName: string;
  eventTitle: string;
  date: string;
  time: string;
  duration: number;
  timezone: string;
  className?: string;
}

export function BookingSummaryCard({
  hostName,
  eventTitle,
  date,
  time,
  duration,
  timezone,
  className,
}: BookingSummaryCardProps) {
  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{eventTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Host</span>
          <span className="font-medium">{hostName}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Date</span>
          <span className="font-medium">{date}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Time</span>
          <span className="font-medium">{time}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Duration</span>
          <span className="font-medium">{duration} min</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Timezone</span>
          <span className="font-medium">{timezone}</span>
        </div>
      </CardContent>
    </Card>
  );
}
