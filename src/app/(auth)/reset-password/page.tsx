"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Email is required.");
      return;
    }

    if (!code.trim()) {
      setError("Reset code is required.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          code: code.trim(),
          password,
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        setError(
          result.error ?? "Unable to update password. Please request a new code."
        );
        return;
      }

      setSuccess(true);
      setCode("");
      setPassword("");
      setConfirmPassword("");
    } catch {
      setError("Unable to update password. Please request a new code.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 md:p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Choose a new password</CardTitle>
          <CardDescription>
            Enter the reset code from your email and choose a new password.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit} noValidate>
          <CardContent className="space-y-4">
            {success && (
              <div className="rounded-md bg-success/10 p-3 text-sm text-success">
                Your password has been updated.
              </div>
            )}
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                disabled={success}
                aria-invalid={!!error}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Reset code</Label>
              <Input
                id="code"
                inputMode="numeric"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                autoComplete="one-time-code"
                disabled={success}
                aria-invalid={!!error}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                disabled={success}
                aria-invalid={!!error}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                disabled={success}
                aria-invalid={!!error}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button
              type="submit"
              className="w-full"
              disabled={success || loading}
            >
              {loading ? "Updating..." : "Update password"}
            </Button>
            <Link
              href="/login"
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Back to log in
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
