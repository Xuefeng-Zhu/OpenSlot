import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface BookingSummaryQuestion {
  id: string;
  label: string;
  type: "text" | "textarea" | "select" | "checkbox";
  required: boolean;
  options?: string[];
}

export interface BookingSummaryCardProps {
  hostName: string;
  eventTitle: string;
  description?: string;
  urlSlug?: string;
  visibility?: string;
  dateLabel?: string;
  date?: string;
  timeLabel?: string;
  time?: string;
  duration: number;
  bufferBefore?: number;
  bufferAfter?: number;
  minNotice?: number;
  maxDaysAhead?: number;
  timezone: string;
  showTimezone?: boolean;
  locationType?: string;
  locationDetails?: string;
  questions?: BookingSummaryQuestion[];
  className?: string;
}

export function BookingSummaryCard({
  hostName,
  eventTitle,
  description,
  urlSlug,
  visibility,
  dateLabel = "Date",
  date,
  timeLabel = "Time",
  time,
  duration,
  bufferBefore,
  bufferAfter,
  minNotice,
  maxDaysAhead,
  timezone,
  showTimezone = true,
  locationType,
  locationDetails,
  questions,
  className,
}: BookingSummaryCardProps) {
  const hasQuestions = questions !== undefined;

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{eventTitle}</CardTitle>
        {description !== undefined && (
          <p className="pt-1 text-sm leading-5 text-muted-foreground">
            {description.trim() || "No description"}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <SummaryRow label="Host" value={hostName} />
        {urlSlug !== undefined && (
          <SummaryRow label="URL slug" value={urlSlug || "Not set"} />
        )}
        {visibility !== undefined && (
          <SummaryRow label="Visibility" value={visibility} />
        )}
        {date !== undefined && <SummaryRow label={dateLabel} value={date} />}
        {time !== undefined && <SummaryRow label={timeLabel} value={time} />}
        <SummaryRow label="Duration" value={`${duration} min`} />
        {bufferBefore !== undefined && (
          <SummaryRow label="Buffer before" value={`${bufferBefore} min`} />
        )}
        {bufferAfter !== undefined && (
          <SummaryRow label="Buffer after" value={`${bufferAfter} min`} />
        )}
        {minNotice !== undefined && (
          <SummaryRow label="Min notice" value={`${minNotice} min`} />
        )}
        {maxDaysAhead !== undefined && (
          <SummaryRow label="Booking window" value={`${maxDaysAhead} days`} />
        )}
        {showTimezone && <SummaryRow label="Timezone" value={timezone} />}
        {locationType !== undefined && (
          <SummaryRow label="Location type" value={locationType} />
        )}
        {locationDetails !== undefined && (
          <SummaryRow label="Location details" value={locationDetails} />
        )}
        {hasQuestions && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
              <span className="text-muted-foreground">Invitee questions</span>
              <span className="font-medium">
                {questions.length === 0
                  ? "None"
                  : `${questions.length} configured`}
              </span>
            </div>
            {questions.map((question, index) => (
              <div
                key={question.id}
                className="rounded-md border border-border/70 p-3"
              >
                <p className="font-medium">
                  {question.label.trim() || `Question ${index + 1}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {questionTypeLabel(question.type)} ·{" "}
                  {question.required ? "Required" : "Optional"}
                </p>
                {question.type === "select" && question.options?.length ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Options: {question.options.join(", ")}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] items-start gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-words text-right font-medium">{value}</span>
    </div>
  );
}

function questionTypeLabel(type: BookingSummaryQuestion["type"]): string {
  if (type === "textarea") return "Long text";
  if (type === "select") return "Dropdown";
  if (type === "checkbox") return "Checkbox";
  return "Short text";
}
