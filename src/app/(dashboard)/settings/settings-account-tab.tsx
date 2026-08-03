"use client";

import { User } from "lucide-react";
import { GuardedLink } from "@/components/dashboard/guarded-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TabsContent } from "@/components/ui/tabs";

interface SettingsAccountTabProps {
  email: string;
  deleteSaving: boolean;
  onDeleteAccount: () => void;
}

export function SettingsAccountTab({
  email,
  deleteSaving,
  onDeleteAccount,
}: SettingsAccountTabProps) {
  return (
    <TabsContent value="account">
      <div className="space-y-6 mt-4">
        <Card>
          <CardHeader>
            <h2 className="flex items-center gap-2 text-base font-semibold leading-tight tracking-tight">
              <User className="h-4 w-4" aria-hidden="true" />
              Sign-in email
            </h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="settings-email">Login email</Label>
              <Input
                id="settings-email"
                type="email"
                autoComplete="email"
                value={email}
                readOnly
                className="bg-muted/50 text-muted-foreground"
                aria-describedby="settings-email-description"
              />
              <p
                id="settings-email-description"
                className="text-sm text-muted-foreground"
              >
                This is the canonical email from your sign-in account. Email
                changes are temporarily unavailable in OpenSlot.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold leading-tight tracking-tight">
              Password
            </h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Password changes use the verified reset-code flow. We&apos;ll
              send a reset code to your login email.
            </p>
            <Button asChild variant="outline">
              <GuardedLink href="/forgot-password">Reset password</GuardedLink>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-destructive/50">
          <CardHeader>
            <h2 className="text-base font-semibold leading-tight tracking-tight text-destructive">
              Danger zone
            </h2>
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
