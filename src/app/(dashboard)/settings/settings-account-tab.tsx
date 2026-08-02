"use client";

import type { Ref } from "react";
import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TabsContent } from "@/components/ui/tabs";

interface SettingsAccountTabProps {
  email: string;
  emailError: string | null;
  emailInputRef: Ref<HTMLInputElement>;
  isDirty: boolean;
  currentPassword: string;
  newPassword: string;
  savingAction: "account" | "preferences" | "notifications" | null;
  passwordSaving: boolean;
  deleteSaving: boolean;
  onEmailChange: (value: string) => void;
  onCurrentPasswordChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onSaveAccount: () => void;
  onUpdatePassword: () => void;
  onDeleteAccount: () => void;
}

export function SettingsAccountTab({
  email,
  emailError,
  emailInputRef,
  isDirty,
  currentPassword,
  newPassword,
  savingAction,
  passwordSaving,
  deleteSaving,
  onEmailChange,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onSaveAccount,
  onUpdatePassword,
  onDeleteAccount,
}: SettingsAccountTabProps) {
  return (
    <TabsContent value="account">
      <div className="space-y-6 mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" aria-hidden="true" />
              Sign-in email
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="settings-email">Email</Label>
              <Input
                ref={emailInputRef}
                id="settings-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => onEmailChange(event.target.value)}
                aria-invalid={Boolean(emailError)}
                aria-describedby={
                  emailError ? "settings-email-error" : undefined
                }
              />
              {emailError ? (
                <p
                  id="settings-email-error"
                  className="mt-1 text-sm text-destructive"
                  role="alert"
                >
                  {emailError}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={onSaveAccount}
                disabled={savingAction !== null || !isDirty}
              >
                {savingAction === "account" ? "Saving..." : "Save email"}
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
                onChange={(event) =>
                  onCurrentPasswordChange(event.target.value)
                }
                placeholder="Enter current password"
              />
            </div>
            <div>
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(event) => onNewPasswordChange(event.target.value)}
                placeholder="Enter new password"
              />
            </div>
            <Button onClick={onUpdatePassword} disabled={passwordSaving}>
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
              onClick={onDeleteAccount}
              disabled={deleteSaving}
            >
              {deleteSaving ? "Deleting..." : "Delete account"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </TabsContent>
  );
}
