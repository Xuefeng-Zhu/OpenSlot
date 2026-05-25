"use client";

import { useState } from "react";
import { User, Settings2, Bell } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TimezoneSelector } from "@/components/booking/timezone-selector";
import {
  errorToastDescription,
  requestJson,
} from "@/components/dashboard/request-json";
import { useToast } from "@/components/ui/use-toast";
import { createBrowserBackendClient } from "@/lib/backend/compat/browser-client";
import type { CalendarConnectionSummary } from "@/lib/calendar/connections";
import type { SettingsFormValues } from "@/lib/validations/settings";
import type { McpTokenSummary } from "@/lib/mcp/tokens";
import type { WebhookEndpointSummary } from "@/lib/webhooks/endpoints";
import { SettingsIntegrationsTab } from "./settings-integrations-tab";

interface SettingsClientProps {
  initialSettings: SettingsFormValues;
  calendarConnections: CalendarConnectionSummary[];
  calendarConnectionsLoadFailed?: boolean;
  webhookEndpoints: WebhookEndpointSummary[];
  webhookEndpointsLoadFailed?: boolean;
  mcpTokens?: McpTokenSummary[];
  mcpTokensLoadFailed?: boolean;
}

type SaveAction = "account" | "preferences" | "notifications";

type SettingsMutationResponse =
  | {
      success: true;
    }
  | {
      success: false;
      error?: string;
    };

/**
 * Dashboard settings surface for account details, preferences, calendar status,
 * and webhook endpoint management. Calendar connections are redirected through
 * OAuth routes, while webhook changes are kept in local state after API writes.
 */
export function SettingsClient({
  initialSettings,
  calendarConnections,
  calendarConnectionsLoadFailed = false,
  webhookEndpoints: initialWebhookEndpoints,
  webhookEndpointsLoadFailed = false,
  mcpTokens: initialMcpTokens = [],
  mcpTokensLoadFailed = false,
}: SettingsClientProps) {
  const { toast } = useToast();
  const [savedSettings, setSavedSettings] = useState(initialSettings);

  const [name, setName] = useState(initialSettings.name);
  const [email, setEmail] = useState(initialSettings.email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [timezone, setTimezone] = useState(initialSettings.defaultTimezone);
  const [dateFormat, setDateFormat] = useState<SettingsFormValues["dateFormat"]>(
    initialSettings.dateFormat
  );
  const [timeFormat, setTimeFormat] = useState<SettingsFormValues["timeFormat"]>(
    initialSettings.timeFormat
  );
  const [notifyNewBooking, setNotifyNewBooking] = useState(
    initialSettings.notifyNewBooking
  );
  const [notifyCancellation, setNotifyCancellation] = useState(
    initialSettings.notifyCancellation
  );
  const [notifyReminder, setNotifyReminder] = useState(
    initialSettings.notifyReminder
  );

  const [savingAction, setSavingAction] = useState<SaveAction | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const currentSettings = (): SettingsFormValues => ({
    name: name.trim(),
    email: email.trim(),
    defaultTimezone: timezone,
    dateFormat,
    timeFormat,
    notifyNewBooking,
    notifyCancellation,
    notifyReminder,
  });

  const saveSettings = async (action: SaveAction) => {
    const nextSettings = currentSettings();
    setSavingAction(action);

    try {
      if (action === "account" && nextSettings.email !== savedSettings.email) {
        const backendClient = createBrowserBackendClient();
        const { error } = await backendClient.auth.updateUser({
          email: nextSettings.email,
        });

        if (error) {
          throw new Error(error.message);
        }
      }

      const data = await requestJson<SettingsMutationResponse>(
        "/api/settings",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(nextSettings),
        },
        "Failed to save settings"
      );

      if (!data.success) {
        throw new Error(data.error ?? "Failed to save settings");
      }

      setSavedSettings(nextSettings);
      toast({
        title: "Settings saved",
        description: "Your settings have been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Settings not saved",
        description: errorToastDescription(error),
        variant: "destructive",
      });
    } finally {
      setSavingAction(null);
    }
  };

  const updatePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast({
        title: "Password not updated",
        description: "Enter your current password and a new password.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: "Password not updated",
        description: "New password must be at least 8 characters.",
        variant: "destructive",
      });
      return;
    }

    setPasswordSaving(true);

    try {
      const backendClient = createBrowserBackendClient();
      const { error: signInError } = await backendClient.auth.signInWithPassword({
        email: savedSettings.email,
        password: currentPassword,
      });

      if (signInError) {
        throw new Error("Current password is incorrect.");
      }

      const { error } = await backendClient.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw new Error(error.message);
      }

      setCurrentPassword("");
      setNewPassword("");
      toast({
        title: "Password updated",
        description: "Use the new password next time you sign in.",
      });
    } catch (error) {
      toast({
        title: "Password not updated",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setPasswordSaving(false);
    }
  };

  const deleteAccount = async () => {
    if (
      !window.confirm(
        "Delete your account and all OpenSlot data? This action cannot be undone."
      )
    ) {
      return;
    }

    setDeleteSaving(true);

    try {
      const data = await requestJson<SettingsMutationResponse>(
        "/api/settings",
        { method: "DELETE" },
        "Failed to delete account"
      );

      if (!data.success) {
        throw new Error(data.error ?? "Failed to delete account");
      }

      const backendClient = createBrowserBackendClient();
      await backendClient.auth.signOut();
      window.location.assign("/signup");
    } catch (error) {
      setDeleteSaving(false);
      toast({
        title: "Account not deleted",
        description: errorToastDescription(error),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Keep account details, display preferences, notifications, calendars, and webhook endpoints in sync."
      />

      <Tabs defaultValue="account">
        <TabsList aria-label="Settings sections">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="account">
          <div className="space-y-6 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" aria-hidden="true" />
                  Profile information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="settings-name">Name</Label>
                  <Input
                    id="settings-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="settings-email">Email</Label>
                  <Input
                    id="settings-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <Button
                  onClick={() => saveSettings("account")}
                  disabled={savingAction !== null}
                >
                  {savingAction === "account" ? "Saving..." : "Save changes"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Change password</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="current-password">Current password</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                  />
                </div>
                <div>
                  <Label htmlFor="new-password">New password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                </div>
                <Button onClick={updatePassword} disabled={passwordSaving}>
                  {passwordSaving ? "Updating..." : "Update password"}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-base text-destructive">
                  Danger zone
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Permanently delete your account and all associated data. This
                  action cannot be undone.
                </p>
                <Button
                  variant="destructive"
                  onClick={deleteAccount}
                  disabled={deleteSaving}
                >
                  {deleteSaving ? "Deleting..." : "Delete account"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="preferences">
          <div className="space-y-6 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings2 className="h-4 w-4" aria-hidden="true" />
                  Display Preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Default timezone</Label>
                  <TimezoneSelector
                    value={timezone}
                    onChange={setTimezone}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="date-format">Date format</Label>
                  <select
                    id="date-format"
                    value={dateFormat}
                    onChange={(e) =>
                      setDateFormat(e.target.value as SettingsFormValues["dateFormat"])
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
                    onChange={(e) =>
                      setTimeFormat(e.target.value as SettingsFormValues["timeFormat"])
                    }
                    className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="12h">12-hour (1:00 PM)</option>
                    <option value="24h">24-hour (13:00)</option>
                  </select>
                </div>
                <Button
                  onClick={() => saveSettings("preferences")}
                  disabled={savingAction !== null}
                >
                  {savingAction === "preferences"
                    ? "Saving..."
                    : "Save preferences"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

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
                    onCheckedChange={setNotifyNewBooking}
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
                    onCheckedChange={setNotifyCancellation}
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
                    onCheckedChange={setNotifyReminder}
                    aria-label="Toggle reminder notifications"
                  />
                </div>
                <Button
                  onClick={() => saveSettings("notifications")}
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

        <SettingsIntegrationsTab
          calendarConnections={calendarConnections}
          calendarConnectionsLoadFailed={calendarConnectionsLoadFailed}
          webhookEndpoints={initialWebhookEndpoints}
          webhookEndpointsLoadFailed={webhookEndpointsLoadFailed}
          mcpTokens={initialMcpTokens}
          mcpTokensLoadFailed={mcpTokensLoadFailed}
        />
      </Tabs>
    </div>
  );
}
