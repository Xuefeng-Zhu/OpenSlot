"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  errorToastDescription,
  requestJson,
} from "@/components/dashboard/request-json";
import { useToast } from "@/components/ui/use-toast";
import { createBrowserBackendClient } from "@/lib/backend/compat/browser-client";
import type { CalendarConnectionSummary } from "@/lib/calendar/connections";
import type { CalendarOAuthResult } from "@/lib/calendar/oauth-result";
import {
  accountSettingsPatchSchema,
  type SettingsFormValues,
  type SettingsPatch,
  type SettingsTab,
} from "@/lib/validations/settings";
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
  initialTab?: SettingsTab;
  calendarOAuthResult?: CalendarOAuthResult | null;
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
      email?: string;
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
  initialTab = "account",
  calendarOAuthResult = null,
  calendarConnections,
  calendarConnectionsLoadFailed = false,
  webhookEndpoints: initialWebhookEndpoints,
  webhookEndpointsLoadFailed = false,
  mcpTokens: initialMcpTokens = [],
  mcpTokensLoadFailed = false,
}: SettingsClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const oauthFeedbackShown = useRef(false);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState(initialSettings.email);
  const [savedEmail, setSavedEmail] = useState(initialSettings.email);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [timezone, setTimezone] = useState(initialSettings.defaultTimezone);
  const [savedTimezone, setSavedTimezone] = useState(
    initialSettings.defaultTimezone
  );
  const [dateFormat, setDateFormat] = useState<SettingsFormValues["dateFormat"]>(
    initialSettings.dateFormat
  );
  const [savedDateFormat, setSavedDateFormat] = useState(dateFormat);
  const [timeFormat, setTimeFormat] = useState<SettingsFormValues["timeFormat"]>(
    initialSettings.timeFormat
  );
  const [savedTimeFormat, setSavedTimeFormat] = useState(timeFormat);
  const [notifyNewBooking, setNotifyNewBooking] = useState(
    initialSettings.notifyNewBooking
  );
  const [savedNotifyNewBooking, setSavedNotifyNewBooking] = useState(
    initialSettings.notifyNewBooking
  );
  const [notifyCancellation, setNotifyCancellation] = useState(
    initialSettings.notifyCancellation
  );
  const [savedNotifyCancellation, setSavedNotifyCancellation] = useState(
    initialSettings.notifyCancellation
  );
  const [notifyReminder, setNotifyReminder] = useState(
    initialSettings.notifyReminder
  );
  const [savedNotifyReminder, setSavedNotifyReminder] = useState(
    initialSettings.notifyReminder
  );

  const [savingAction, setSavingAction] = useState<SaveAction | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const accountDirty = email.trim().toLowerCase() !== savedEmail.toLowerCase();
  const preferencesDirty =
    timezone !== savedTimezone ||
    dateFormat !== savedDateFormat ||
    timeFormat !== savedTimeFormat;
  const notificationsDirty =
    notifyNewBooking !== savedNotifyNewBooking ||
    notifyCancellation !== savedNotifyCancellation ||
    notifyReminder !== savedNotifyReminder;

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!calendarOAuthResult || oauthFeedbackShown.current) return;

    oauthFeedbackShown.current = true;
    const provider =
      calendarOAuthResult.provider === "google"
        ? "Google Calendar"
        : "Microsoft Outlook";

    if (calendarOAuthResult.status === "connected") {
      toast({
        title: `${provider} connected`,
        description: "Calendar availability and booking sync are ready.",
      });
    } else {
      toast({
        title: "Calendar not connected",
        description: calendarOAuthErrorDescription(calendarOAuthResult.reason),
        variant: "destructive",
      });
    }

    router.replace("/settings?tab=integrations", { scroll: false });
  }, [calendarOAuthResult, router, toast]);

  const settingsPatch = (action: SaveAction): SettingsPatch => {
    if (action === "account") {
      return { section: "account", email: email.trim() };
    }

    if (action === "preferences") {
      return {
        section: "preferences",
        defaultTimezone: timezone,
        dateFormat,
        timeFormat,
      };
    }

    return {
      section: "notifications",
      notifyNewBooking,
      notifyCancellation,
      notifyReminder,
    };
  };

  const saveSettings = async (action: SaveAction) => {
    let patch = settingsPatch(action);

    if (patch.section === "account") {
      const parsed = accountSettingsPatchSchema.safeParse(patch);

      if (!parsed.success) {
        setEmailError(
          parsed.error.flatten().fieldErrors.email?.[0] ??
            "Enter a valid email address."
        );
        emailInputRef.current?.focus();
        return;
      }

      patch = parsed.data;
      setEmailError(null);
    }

    setSavingAction(action);

    try {
      const data = await requestJson<SettingsMutationResponse>(
        "/api/settings",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        },
        "Failed to save settings"
      );

      if (!data.success) {
        throw new Error(data.error ?? "Failed to save settings");
      }

      if (patch.section === "account") {
        const canonicalEmail = data.email ?? patch.email;
        setEmail(canonicalEmail);
        setSavedEmail(canonicalEmail);
        setEmailError(null);
        router.refresh();
      } else if (patch.section === "preferences") {
        setSavedTimezone(patch.defaultTimezone);
        setSavedDateFormat(patch.dateFormat);
        setSavedTimeFormat(patch.timeFormat);
        router.refresh();
      } else {
        setSavedNotifyNewBooking(patch.notifyNewBooking);
        setSavedNotifyCancellation(patch.notifyCancellation);
        setSavedNotifyReminder(patch.notifyReminder);
      }

      toast({
        title: "Settings saved",
        description: "Your settings have been updated successfully.",
      });
    } catch (error) {
      const description = errorToastDescription(error);

      if (action === "account") {
        setEmailError(
          description === "Validation failed"
            ? "Enter a valid email address."
            : description
        );
        emailInputRef.current?.focus();
        return;
      }

      toast({
        title: "Settings not saved",
        description,
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
        email: savedEmail,
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

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          const nextTab = value as SettingsTab;
          setActiveTab(nextTab);
          router.replace(`/settings?tab=${nextTab}`, { scroll: false });
        }}
      >
        <TabsList aria-label="Settings sections">
          <TabsTrigger
            value="account"
            aria-label={accountDirty ? "Account, unsaved changes" : "Account"}
          >
            <SettingsTabLabel label="Account" dirty={accountDirty} />
          </TabsTrigger>
          <TabsTrigger
            value="preferences"
            aria-label={
              preferencesDirty
                ? "Preferences, unsaved changes"
                : "Preferences"
            }
          >
            <SettingsTabLabel label="Preferences" dirty={preferencesDirty} />
          </TabsTrigger>
          <TabsTrigger
            value="notifications"
            aria-label={
              notificationsDirty
                ? "Notifications, unsaved changes"
                : "Notifications"
            }
          >
            <SettingsTabLabel
              label="Notifications"
              dirty={notificationsDirty}
            />
          </TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        <SettingsAccountTab
          email={email}
          emailError={emailError}
          emailInputRef={emailInputRef}
          isDirty={accountDirty}
          currentPassword={currentPassword}
          newPassword={newPassword}
          savingAction={savingAction}
          passwordSaving={passwordSaving}
          deleteSaving={deleteSaving}
          onEmailChange={(value) => {
            setEmail(value);
            setEmailError(null);
          }}
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
          isDirty={preferencesDirty}
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
          isDirty={notificationsDirty}
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

function SettingsTabLabel({ label, dirty }: { label: string; dirty: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {label}
      {dirty ? (
        <span
          className="h-1.5 w-1.5 rounded-full bg-warning"
          aria-hidden="true"
        />
      ) : null}
    </span>
  );
}

function calendarOAuthErrorDescription(
  reason: Extract<CalendarOAuthResult, { status: "error" }>["reason"]
) {
  if (reason === "access_denied") {
    return "Calendar access was declined. No connection was created.";
  }

  if (reason === "invalid_state") {
    return "The connection session expired. Start the connection again.";
  }

  if (reason === "unauthorized" || reason === "profile_mismatch") {
    return "Sign in again, then retry the calendar connection.";
  }

  if (reason === "provider_unavailable") {
    return "The calendar provider is temporarily unavailable. Try again shortly.";
  }

  return "The calendar connection could not be completed. Please try again.";
}
