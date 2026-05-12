"use client";

import Link from "next/link";
import { useState } from "react";
import {
  User,
  Settings2,
  Bell,
  Puzzle,
  Calendar,
  Video,
  CreditCard,
  Mail,
  RefreshCw,
  Copy,
  Plus,
  Power,
  Trash2,
  Webhook,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { TimezoneSelector } from "@/components/booking/timezone-selector";
import { useToast } from "@/components/ui/use-toast";
import { createClient } from "@/lib/supabase/client";
import type { CalendarConnectionSummary } from "@/lib/calendar/connections";
import type { SettingsFormValues } from "@/lib/validations/settings";
import type { WebhookEndpointSummary } from "@/lib/webhooks/endpoints";

interface SettingsClientProps {
  initialSettings: SettingsFormValues;
  calendarConnections: CalendarConnectionSummary[];
  webhookEndpoints: WebhookEndpointSummary[];
}

type SaveAction = "account" | "preferences" | "notifications";

const webhookEventOptions = [
  { value: "booking.confirmed", label: "Confirmed" },
  { value: "booking.cancelled", label: "Cancelled" },
  { value: "booking.rescheduled", label: "Rescheduled" },
  { value: "*", label: "All" },
] as const;

/**
 * Dashboard settings surface for account details, preferences, calendar status,
 * and webhook endpoint management. Calendar connections are redirected through
 * OAuth routes, while webhook changes are kept in local state after API writes.
 */
export function SettingsClient({
  initialSettings,
  calendarConnections,
  webhookEndpoints: initialWebhookEndpoints,
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
  const [webhookEndpoints, setWebhookEndpoints] = useState(
    initialWebhookEndpoints
  );
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookDescription, setWebhookDescription] = useState("");
  const [webhookEvents, setWebhookEvents] = useState<string[]>([
    "booking.confirmed",
  ]);
  const [webhookCreating, setWebhookCreating] = useState(false);
  const [webhookActionId, setWebhookActionId] = useState<string | null>(null);
  const [newWebhookSecret, setNewWebhookSecret] = useState<string | null>(null);

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
  const googleConnection = calendarConnections.find(
    (connection) => connection.provider === "google"
  );
  const microsoftConnection = calendarConnections.find(
    (connection) => connection.provider === "microsoft"
  );

  const saveSettings = async (action: SaveAction) => {
    const nextSettings = currentSettings();
    setSavingAction(action);

    try {
      if (action === "account" && nextSettings.email !== savedSettings.email) {
        const supabase = createClient();
        const { error } = await supabase.auth.updateUser({
          email: nextSettings.email,
        });

        if (error) {
          throw new Error(error.message);
        }
      }

      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextSettings),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
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
        description:
          error instanceof Error ? error.message : "Please try again.",
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
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: savedSettings.email,
        password: currentPassword,
      });

      if (signInError) {
        throw new Error("Current password is incorrect.");
      }

      const { error } = await supabase.auth.updateUser({
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
      const response = await fetch("/api/settings", { method: "DELETE" });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "Failed to delete account");
      }

      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.assign("/signup");
    } catch (error) {
      setDeleteSaving(false);
      toast({
        title: "Account not deleted",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const toggleWebhookEvent = (eventType: string, checked: boolean) => {
    setWebhookEvents((current) => {
      if (checked) {
        return Array.from(new Set([...current, eventType]));
      }

      const next = current.filter((event) => event !== eventType);
      return next.length > 0 ? next : current;
    });
  };

  const createWebhookEndpoint = async () => {
    setWebhookCreating(true);
    setNewWebhookSecret(null);

    try {
      const response = await fetch("/api/webhooks/endpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl.trim(),
          description: webhookDescription.trim() || undefined,
          subscribedEvents: webhookEvents,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "Failed to create webhook endpoint");
      }

      setWebhookEndpoints((current) => [data.endpoint, ...current]);
      setWebhookUrl("");
      setWebhookDescription("");
      setWebhookEvents(["booking.confirmed"]);
      setNewWebhookSecret(data.secretToken);
      toast({
        title: "Webhook created",
        description: "The signing secret is shown once.",
      });
    } catch (error) {
      toast({
        title: "Webhook not created",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setWebhookCreating(false);
    }
  };

  const setWebhookActive = async (
    endpoint: WebhookEndpointSummary,
    isActive: boolean
  ) => {
    setWebhookActionId(endpoint.id);

    try {
      const response = await fetch(`/api/webhooks/endpoints/${endpoint.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "Failed to update webhook endpoint");
      }

      setWebhookEndpoints((current) =>
        current.map((item) =>
          item.id === endpoint.id ? { ...item, isActive } : item
        )
      );
    } catch (error) {
      toast({
        title: "Webhook not updated",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setWebhookActionId(null);
    }
  };

  const deleteWebhookEndpoint = async (endpoint: WebhookEndpointSummary) => {
    if (!window.confirm("Delete this webhook endpoint?")) {
      return;
    }

    setWebhookActionId(endpoint.id);

    try {
      const response = await fetch(`/api/webhooks/endpoints/${endpoint.id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "Failed to delete webhook endpoint");
      }

      setWebhookEndpoints((current) =>
        current.filter((item) => item.id !== endpoint.id)
      );
      setNewWebhookSecret(null);
    } catch (error) {
      toast({
        title: "Webhook not deleted",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setWebhookActionId(null);
    }
  };

  const copyWebhookSecret = async () => {
    if (!newWebhookSecret || !navigator.clipboard) return;

    try {
      await navigator.clipboard.writeText(newWebhookSecret);
      toast({
        title: "Secret copied",
        description: "Use it to verify OpenSlot webhook signatures.",
      });
    } catch {
      toast({
        title: "Secret not copied",
        description: "Select the value and copy it manually.",
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

        <TabsContent value="integrations">
          <div className="space-y-6 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Puzzle className="h-4 w-4" aria-hidden="true" />
                  Integrations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-md border border-border p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent">
                          <Calendar className="h-5 w-5 text-accent-foreground" aria-hidden="true" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Google Calendar</p>
                          <p className="text-xs text-muted-foreground">
                            Sync your bookings
                          </p>
                        </div>
                      </div>
                      <Badge variant={googleConnection ? "default" : "secondary"}>
                        {connectionBadgeText(googleConnection)}
                      </Badge>
                    </div>
                    {googleConnection && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        {googleConnection.accountEmail} ·{" "}
                        {googleConnection.calendars.length} calendars
                      </p>
                    )}
                    <Button
                      asChild
                      variant={googleConnection ? "outline" : "default"}
                      size="sm"
                      className="mt-4"
                    >
                      <Link href="/api/calendar/oauth/google/start" prefetch={false}>
                        {googleConnection && (
                          <RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        {googleConnection ? "Reconnect" : "Connect"}
                      </Link>
                    </Button>
                  </div>

                  <div className="rounded-md border border-border p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent">
                          <Mail className="h-5 w-5 text-accent-foreground" aria-hidden="true" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            Microsoft Outlook
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Sync your calendar
                          </p>
                        </div>
                      </div>
                      <Badge variant={microsoftConnection ? "default" : "secondary"}>
                        {connectionBadgeText(microsoftConnection)}
                      </Badge>
                    </div>
                    {microsoftConnection && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        {microsoftConnection.accountEmail} ·{" "}
                        {microsoftConnection.calendars.length} calendars
                      </p>
                    )}
                    <Button
                      asChild
                      variant={microsoftConnection ? "outline" : "default"}
                      size="sm"
                      className="mt-4"
                    >
                      <Link href="/api/calendar/oauth/microsoft/start" prefetch={false}>
                        {microsoftConnection && (
                          <RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        {microsoftConnection ? "Reconnect" : "Connect"}
                      </Link>
                    </Button>
                  </div>

                  <div className="rounded-md border border-border p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent">
                          <Video className="h-5 w-5 text-accent-foreground" aria-hidden="true" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Zoom</p>
                          <p className="text-xs text-muted-foreground">
                            Auto-create meeting links
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary">Available soon</Badge>
                    </div>
                  </div>

                  <div className="rounded-md border border-border p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent">
                          <CreditCard className="h-5 w-5 text-accent-foreground" aria-hidden="true" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Stripe</p>
                          <p className="text-xs text-muted-foreground">
                            Accept payments
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary">Available soon</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Webhook className="h-4 w-4" aria-hidden="true" />
                  Webhook endpoints
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {newWebhookSecret && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
                    <Label htmlFor="webhook-secret">Signing secret</Label>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <Input
                        id="webhook-secret"
                        value={newWebhookSecret}
                        readOnly
                        className="font-mono text-xs"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={copyWebhookSecret}
                      >
                        <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
                        Copy
                      </Button>
                    </div>
                    <p className="mt-2 text-xs text-amber-900">
                      This secret is only shown once.
                    </p>
                  </div>
                )}

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="space-y-2">
                    <Label htmlFor="webhook-url">Endpoint URL</Label>
                    <Input
                      id="webhook-url"
                      type="url"
                      value={webhookUrl}
                      onChange={(event) => setWebhookUrl(event.target.value)}
                      placeholder="https://example.com/webhook"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="webhook-description">Description</Label>
                    <Input
                      id="webhook-description"
                      value={webhookDescription}
                      onChange={(event) =>
                        setWebhookDescription(event.target.value)
                      }
                      placeholder="Production"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Events</Label>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    {webhookEventOptions.map((option) => (
                      <label
                        key={option.value}
                        className="flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={webhookEvents.includes(option.value)}
                          onChange={(event) =>
                            toggleWebhookEvent(
                              option.value,
                              event.target.checked
                            )
                          }
                          className="h-4 w-4 rounded border-border"
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={createWebhookEndpoint}
                  disabled={!webhookUrl.trim() || webhookCreating}
                >
                  <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                  {webhookCreating ? "Creating..." : "Add endpoint"}
                </Button>

                <div className="space-y-3">
                  {webhookEndpoints.length === 0 ? (
                    <EmptyState
                      icon={<Webhook className="h-6 w-6" aria-hidden="true" />}
                      heading="No webhook endpoints configured."
                      description="Add an endpoint to receive signed booking lifecycle events in your own systems."
                      className="bg-muted/30 py-10"
                    />
                  ) : (
                    webhookEndpoints.map((endpoint) => (
                      <div
                        key={endpoint.id}
                        className="rounded-md border border-border p-4"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="break-all font-mono text-xs text-foreground">
                                {endpoint.url}
                              </p>
                              <Badge
                                variant={
                                  endpoint.isActive ? "default" : "secondary"
                                }
                              >
                                {endpoint.isActive ? "Active" : "Paused"}
                              </Badge>
                            </div>
                            {endpoint.description && (
                              <p className="text-sm text-muted-foreground">
                                {endpoint.description}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-1 pt-1">
                              {endpoint.subscribedEvents.map((eventType) => (
                                <Badge key={eventType} variant="secondary">
                                  {webhookEventLabel(eventType)}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          <div className="flex shrink-0 gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={webhookActionId === endpoint.id}
                              onClick={() =>
                                setWebhookActive(
                                  endpoint,
                                  !endpoint.isActive
                                )
                              }
                            >
                              <Power className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                              {endpoint.isActive ? "Pause" : "Enable"}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={webhookActionId === endpoint.id}
                              onClick={() => deleteWebhookEndpoint(endpoint)}
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function connectionBadgeText(connection?: CalendarConnectionSummary): string {
  if (!connection) {
    return "Not connected";
  }

  if (connection.status === "active") {
    return "Connected";
  }

  if (connection.status === "error") {
    return "Needs attention";
  }

  return "Disconnected";
}

function webhookEventLabel(eventType: string): string {
  return (
    webhookEventOptions.find((option) => option.value === eventType)?.label ??
    eventType
  );
}
