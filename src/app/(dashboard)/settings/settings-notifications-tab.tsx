"use client";

import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { TabsContent } from "@/components/ui/tabs";

interface SettingsNotificationsTabProps {
  notifyNewBooking: boolean;
  notifyCancellation: boolean;
  notifyReminder: boolean;
  savingAction: "account" | "preferences" | "notifications" | null;
  onNotifyNewBookingChange: (value: boolean) => void;
  onNotifyCancellationChange: (value: boolean) => void;
  onNotifyReminderChange: (value: boolean) => void;
  onSaveNotifications: () => void;
}

export function SettingsNotificationsTab({
  notifyNewBooking,
  notifyCancellation,
  notifyReminder,
  savingAction,
  onNotifyNewBookingChange,
  onNotifyCancellationChange,
  onNotifyReminderChange,
  onSaveNotifications,
}: SettingsNotificationsTabProps) {
  return (
    <TabsContent value="notifications">
      <div className="space-y-6 mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4" aria-hidden="true" />
              Email Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">New bookings</p>
                <p className="text-xs text-muted-foreground">
                  Get notified when someone books a meeting with you.
                </p>
              </div>
              <Switch
                checked={notifyNewBooking}
                onCheckedChange={onNotifyNewBookingChange}
                aria-label="Toggle new booking notifications"
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Cancellations</p>
                <p className="text-xs text-muted-foreground">
                  Get notified when a booking is cancelled.
                </p>
              </div>
              <Switch
                checked={notifyCancellation}
                onCheckedChange={onNotifyCancellationChange}
                aria-label="Toggle cancellation notifications"
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Reminders</p>
                <p className="text-xs text-muted-foreground">
                  Get reminded before upcoming meetings.
                </p>
              </div>
              <Switch
                checked={notifyReminder}
                onCheckedChange={onNotifyReminderChange}
                aria-label="Toggle reminder notifications"
              />
            </div>
            <Button
              onClick={onSaveNotifications}
              disabled={savingAction !== null}
            >
              {savingAction === "notifications"
                ? "Saving..."
                : "Save notification settings"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </TabsContent>
  );
}
