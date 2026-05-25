"use client";

import { useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  errorToastDescription,
  requestJson,
} from "@/components/dashboard/request-json";
import { useToast } from "@/components/ui/use-toast";
import { createBrowserBackendClient } from "@/lib/backend/compat/browser-client";
import type { CalendarConnectionSummary } from "@/lib/calendar/connections";
import type { SettingsFormValues } from "@/lib/validations/settings";
import {
  PASSWORD_COMPLEXITY_ERROR,
  isStrongPassword,
} from "@/lib/validations/password";
import type { McpTokenSummary } from "@/lib/mcp/tokens";
import type { WebhookEndpointSummary } from "@/lib/webhooks/endpoints";
import { SettingsAccountTab } from "./settings-account-tab";
import { SettingsIntegrationsTab } from "./settings-integrations-tab";
import { SettingsNotificationsTab } from "./settings-notifications-tab";
import { SettingsPreferencesTab } from "./settings-preferences-tab";

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

    if (!isStrongPassword(newPassword)) {
      toast({
        title: "Password not updated",
        description: PASSWORD_COMPLEXITY_ERROR,
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

        <SettingsAccountTab
          name={name}
          email={email}
          currentPassword={currentPassword}
          newPassword={newPassword}
          savingAction={savingAction}
          passwordSaving={passwordSaving}
          deleteSaving={deleteSaving}
          onNameChange={setName}
          onEmailChange={setEmail}
          onCurrentPasswordChange={setCurrentPassword}
          onNewPasswordChange={setNewPassword}
          onSaveAccount={() => saveSettings("account")}
          onUpdatePassword={updatePassword}
          onDeleteAccount={deleteAccount}
        />

        <SettingsPreferencesTab
          timezone={timezone}
          dateFormat={dateFormat}
          timeFormat={timeFormat}
          savingAction={savingAction}
          onTimezoneChange={setTimezone}
          onDateFormatChange={setDateFormat}
          onTimeFormatChange={setTimeFormat}
          onSavePreferences={() => saveSettings("preferences")}
        />

        <SettingsNotificationsTab
          notifyNewBooking={notifyNewBooking}
          notifyCancellation={notifyCancellation}
          notifyReminder={notifyReminder}
          savingAction={savingAction}
          onNotifyNewBookingChange={setNotifyNewBooking}
          onNotifyCancellationChange={setNotifyCancellation}
          onNotifyReminderChange={setNotifyReminder}
          onSaveNotifications={() => saveSettings("notifications")}
        />

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
