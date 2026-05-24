"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Lock, Mail } from "lucide-react";
import { createBrowserBackendClient } from "@/lib/backend/compat/browser-client";
import {
  setBrowserAuthSessionPersistence,
} from "@/lib/backend/compat/session-persistence";
import { AppIcon } from "@/components/shared/app-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LoginFormProps = {
  returnUrl: string;
};

export function LoginForm({ returnUrl }: LoginFormProps) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const nextFieldErrors: typeof fieldErrors = {};
    if (!email.trim()) {
      nextFieldErrors.email = "Email is required.";
    }
    if (!password) {
      nextFieldErrors.password = "Password is required.";
    }

    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) return;

    setLoading(true);

    try {
      setBrowserAuthSessionPersistence(keepSignedIn);
      const backendClient = createBrowserBackendClient({ keepSignedIn });

      const { error: signInError } = await backendClient.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError("We could not sign you in. Check your email and password.");
        return;
      }

      router.push(returnUrl);
      router.refresh();
    } catch {
      setError(
        "Authentication is unavailable. Check the app configuration and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md space-y-8">
      <div className="flex items-center gap-2">
        <AppIcon className="h-7 w-7" />
        <span className="text-xl font-bold text-foreground">OpenSlot</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Welcome back
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Log in to manage event types, availability, and bookings.
        </p>
      </div>

      <div className="flex border-b border-border">
        <Link
          href="/signup"
          className="border-b-2 border-transparent px-4 pb-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Sign up
        </Link>
        <Link
          href="/login"
          className="border-b-2 border-primary px-4 pb-3 text-sm font-medium text-foreground"
        >
          Log in
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {error && (
          <div
            className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
            role="alert"
          >
            {error}
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="pl-9"
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? "email-error" : undefined}
            />
          </div>
          {fieldErrors.email && (
            <p id="email-error" className="text-sm text-destructive">
              {fieldErrors.email}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="pl-9"
              aria-invalid={!!fieldErrors.password}
              aria-describedby={
                fieldErrors.password ? "password-error" : undefined
              }
            />
          </div>
          {fieldErrors.password && (
            <p id="password-error" className="text-sm text-destructive">
              {fieldErrors.password}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            id="keep-signed-in"
            type="checkbox"
            checked={keepSignedIn}
            onChange={(e) => setKeepSignedIn(e.target.checked)}
            className="h-4 w-4 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          <Label
            htmlFor="keep-signed-in"
            className="cursor-pointer text-sm font-normal text-muted-foreground"
          >
            Keep me signed in
          </Label>
        </div>
        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? (
            "Logging in..."
          ) : (
            <>
              Log in
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </>
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          New to OpenSlot?{" "}
          <Link
            href="/signup"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </p>
      </form>
    </div>
  );
}
