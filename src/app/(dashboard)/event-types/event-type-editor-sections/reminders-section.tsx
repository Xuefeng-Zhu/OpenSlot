import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { EventTypeSectionProps } from "./event-type-section-types";

export function RemindersSection({
  values,
  errors,
  onFieldChange,
  clearFieldError,
}: EventTypeSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-md border border-border p-3">
        <div>
          <Label htmlFor="reminder-enabled">Pre-meeting reminder</Label>
          <p className="text-xs text-muted-foreground">
            Send one email reminder before this event starts.
          </p>
        </div>
        <Switch
          id="reminder-enabled"
          checked={values.reminder_enabled}
          onCheckedChange={(checked) => {
            onFieldChange("reminder_enabled", checked);
            clearFieldError("reminder_guest_enabled");
          }}
          aria-label="Enable pre-meeting reminders"
        />
      </div>
      <div>
        <Label htmlFor="reminder-minutes-before">
          Send before start (minutes)
        </Label>
        <Input
          id="reminder-minutes-before"
          type="number"
          value={values.reminder_minutes_before}
          onChange={(event) => {
            onFieldChange("reminder_minutes_before", Number(event.target.value));
            clearFieldError("reminder_minutes_before");
          }}
          min={5}
          max={10080}
          disabled={!values.reminder_enabled}
        />
        {errors.reminder_minutes_before ? (
          <p className="text-xs text-destructive mt-1">
            {errors.reminder_minutes_before}
          </p>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-md border border-border p-3">
          <div>
            <p className="text-sm font-medium">Email guest</p>
            <p className="text-xs text-muted-foreground">
              Use the guest&apos;s booking email.
            </p>
          </div>
          <Switch
            checked={values.reminder_guest_enabled}
            onCheckedChange={(checked) => {
              onFieldChange("reminder_guest_enabled", checked);
              clearFieldError("reminder_guest_enabled");
            }}
            disabled={!values.reminder_enabled}
            aria-label="Email guest reminders"
          />
        </div>
        <div className="flex items-center justify-between rounded-md border border-border p-3">
          <div>
            <p className="text-sm font-medium">Email host</p>
            <p className="text-xs text-muted-foreground">
              Use your profile email.
            </p>
          </div>
          <Switch
            checked={values.reminder_host_enabled}
            onCheckedChange={(checked) => {
              onFieldChange("reminder_host_enabled", checked);
              clearFieldError("reminder_guest_enabled");
            }}
            disabled={!values.reminder_enabled}
            aria-label="Email host reminders"
          />
        </div>
      </div>
      {errors.reminder_guest_enabled ? (
        <p className="text-xs text-destructive">
          {errors.reminder_guest_enabled}
        </p>
      ) : null}
    </div>
  );
}
