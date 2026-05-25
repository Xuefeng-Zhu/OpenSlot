"use client";

import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TabsContent } from "@/components/ui/tabs";

interface SettingsAccountTabProps {
  name: string;
  email: string;
  currentPassword: string;
  newPassword: string;
  savingAction: "account" | "preferences" | "notifications" | null;
  passwordSaving: boolean;
  deleteSaving: boolean;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onCurrentPasswordChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onSaveAccount: () => void;
  onUpdatePassword: () => void;
  onDeleteAccount: () => void;
}

export function SettingsAccountTab({
  name,
  email,
  currentPassword,
  newPassword,
  savingAction,
  passwordSaving,
  deleteSaving,
  onNameChange,
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
              Profile information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="settings-name">Name</Label>
              <Input
                id="settings-name"
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="settings-email">Email</Label>
              <Input
                id="settings-email"
                type="email"
                value={email}
                onChange={(event) => onEmailChange(event.target.value)}
              />
            </div>
            <Button onClick={onSaveAccount} disabled={savingAction !== null}>
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
