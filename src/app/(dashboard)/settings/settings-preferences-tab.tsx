"use client";

import { Settings2 } from "lucide-react";
import { TimezoneSelector } from "@/components/booking/timezone-selector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { TabsContent } from "@/components/ui/tabs";
import type { SettingsFormValues } from "@/lib/validations/settings";

interface SettingsPreferencesTabProps {
  timezone: string;
  dateFormat: SettingsFormValues["dateFormat"];
  timeFormat: SettingsFormValues["timeFormat"];
  isDirty: boolean;
  savingAction: "account" | "preferences" | "notifications" | null;
  onTimezoneChange: (value: string) => void;
  onDateFormatChange: (value: SettingsFormValues["dateFormat"]) => void;
  onTimeFormatChange: (value: SettingsFormValues["timeFormat"]) => void;
  onSavePreferences: () => void;
}

export function SettingsPreferencesTab({
  timezone,
  dateFormat,
  timeFormat,
  isDirty,
  savingAction,
  onTimezoneChange,
  onDateFormatChange,
  onTimeFormatChange,
  onSavePreferences,
}: SettingsPreferencesTabProps) {
  return (
    <TabsContent value="preferences">
      <div className="space-y-6 mt-4">
        <Card>
          <CardHeader>
            <h2 className="flex items-center gap-2 text-base font-semibold leading-tight tracking-tight">
              <Settings2 className="h-4 w-4" aria-hidden="true" />
              Display Preferences
            </h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="settings-default-timezone">
                Default timezone
              </Label>
              <TimezoneSelector
                inputId="settings-default-timezone"
                value={timezone}
                onChange={onTimezoneChange}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="date-format">Date format</Label>
              <select
                id="date-format"
                value={dateFormat}
                onChange={(event) =>
                  onDateFormatChange(
                    event.target.value as SettingsFormValues["dateFormat"]
                  )
                }
                className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>
            <div>
              <Label htmlFor="time-format">Time format</Label>
              <select
                id="time-format"
                value={timeFormat}
                onChange={(event) =>
                  onTimeFormatChange(
                    event.target.value as SettingsFormValues["timeFormat"]
                  )
                }
                className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="12h">12-hour (1:00 PM)</option>
                <option value="24h">24-hour (13:00)</option>
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={onSavePreferences}
                disabled={savingAction !== null || !isDirty}
              >
                {savingAction === "preferences"
                  ? "Saving..."
                  : "Save preferences"}
              </Button>
              {isDirty && (
                <span
                  className="text-xs font-medium text-warning"
                  role="status"
                >
                  Unsaved changes
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </TabsContent>
  );
}
