"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useDashboardNavigationGuard,
  useDashboardUnsavedChanges,
} from "@/components/dashboard/navigation-guard-provider";
import { PageHeader } from "@/components/dashboard/page-header";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  errorToastDescription,
  requestJson,
} from "@/components/dashboard/request-json";
import { useToast } from "@/components/ui/use-toast";
import type { CalendarConnectionSummary } from "@/lib/calendar/connections";
import type { CalendarOAuthResult } from "@/lib/calendar/oauth-result";
import {
  type SettingsFormValues,
  type SettingsPatch,
  type SettingsTab,
} from "@/lib/validations/settings";
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
  clearIgnoredCalendarOAuthResult?: boolean;
  calendarConnections: CalendarConnectionSummary[];
  calendarConnectionsLoadFailed?: boolean;
  webhookEndpoints: WebhookEndpointSummary[];
  webhookEndpointsLoadFailed?: boolean;
  mcpTokens?: McpTokenSummary[];
  mcpTokensLoadFailed?: boolean;
}

type SaveAction = "preferences" | "notifications";
type WritableSettingsPatch = Exclude<
  SettingsPatch,
  { section: "account" }
>;

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
  initialTab = "account",
  calendarOAuthResult = null,
  clearIgnoredCalendarOAuthResult = false,
  calendarConnections,
  calendarConnectionsLoadFailed = false,
  webhookEndpoints: initialWebhookEndpoints,
  webhookEndpointsLoadFailed = false,
  mcpTokens: initialMcpTokens = [],
  mcpTokensLoadFailed = false,
}: SettingsClientProps) {
  const router = useRouter();
  const { requestNavigation } = useDashboardNavigationGuard();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const oauthFeedbackShown = useRef(false);
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
  const [deleteSaving, setDeleteSaving] = useState(false);
  const preferencesDirty =
    timezone !== savedTimezone ||
    dateFormat !== savedDateFormat ||
    timeFormat !== savedTimeFormat;
  const notificationsDirty =
    notifyNewBooking !== savedNotifyNewBooking ||
    notifyCancellation !== savedNotifyCancellation ||
    notifyReminder !== savedNotifyReminder;
  const discardDrafts = useCallback(() => {
    setTimezone(savedTimezone);
    setDateFormat(savedDateFormat);
    setTimeFormat(savedTimeFormat);
    setNotifyNewBooking(savedNotifyNewBooking);
    setNotifyCancellation(savedNotifyCancellation);
    setNotifyReminder(savedNotifyReminder);
  }, [
    savedDateFormat,
    savedNotifyCancellation,
    savedNotifyNewBooking,
    savedNotifyReminder,
    savedTimeFormat,
    savedTimezone,
  ]);

  useDashboardUnsavedChanges(
    "settings-drafts",
    preferencesDirty || notificationsDirty,
    discardDrafts
  );

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (oauthFeedbackShown.current) return;

    if (!calendarOAuthResult) {
      if (clearIgnoredCalendarOAuthResult) {
        oauthFeedbackShown.current = true;
        router.replace("/settings?tab=integrations", { scroll: false });
      }
      return;
    }

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
  }, [calendarOAuthResult, clearIgnoredCalendarOAuthResult, router, toast]);

  const settingsPatch = (action: SaveAction): WritableSettingsPatch => {
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
    const patch = settingsPatch(action);

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

      if (patch.section === "preferences") {
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

      toast({
        title: "Settings not saved",
        description,
        variant: "destructive",
      });
    } finally {
      setSavingAction(null);
    }
  };

  const deleteAccount = () => {
    requestNavigation(() => {
      void deleteAccountAfterDiscard();
    });
  };

  const deleteAccountAfterDiscard = async () => {
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
        <TabsList
          aria-label="Settings sections"
          className="grid w-full grid-cols-2 overflow-visible sm:inline-flex sm:w-auto"
        >
          <TabsTrigger value="account" className="w-full sm:w-auto">
            Account
          </TabsTrigger>
          <TabsTrigger
            value="preferences"
            className="w-full sm:w-auto"
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
            className="w-full sm:w-auto"
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
          <TabsTrigger value="integrations" className="w-full sm:w-auto">
            Integrations
          </TabsTrigger>
        </TabsList>

        <SettingsAccountTab
          email={initialSettings.email}
          deleteSaving={deleteSaving}
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
