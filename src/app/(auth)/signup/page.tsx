"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignupPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{
    fullName?: string;
    email?: string;
    password?: string;
    general?: string;
  }>({});
  const [loading, setLoading] = useState(false);

  function validate(): boolean {
    const newErrors: typeof errors = {};

    if (!fullName.trim()) {
      newErrors.fullName = "Full name is required.";
    }

    if (!email.trim()) {
      newErrors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Please enter a valid email address.";
    }

    if (!password) {
      newErrors.password = "Password is required.";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!validate()) return;

    setErrors({});
    setLoading(true);

    const supabase = createClient();

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
        },
      },
    });

    if (signUpError) {
      setErrors({ general: "Unable to create account. Please try again." });
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen w-full">
      {/* Left column - Signup form */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Create an account
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign up to start sharing your availability and receiving bookings.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {errors.general && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {errors.general}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Jane Smith"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                aria-invalid={!!errors.fullName}
                aria-describedby={errors.fullName ? "fullName-error" : undefined}
              />
              {errors.fullName && (
                <p id="fullName-error" className="text-sm text-destructive">
                  {errors.fullName}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
              />
              {errors.email && (
                <p id="email-error" className="text-sm text-destructive">
                  {errors.email}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? "password-error" : undefined}
              />
              {errors.password && (
                <p id="password-error" className="text-sm text-destructive">
                  {errors.password}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Create account"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/login"
                className="text-primary underline-offset-4 hover:underline"
              >
                Log in
              </Link>
            </p>
          </form>
        </div>
      </div>

      {/* Right column - Brand panel (hidden on mobile) */}
      <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-accent p-12">
        <div className="flex max-w-md flex-col items-center text-center space-y-8">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6 text-primary-foreground"
                aria-hidden="true"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <span className="text-xl font-bold text-foreground">OpenSlot</span>
          </div>

          {/* Tagline */}
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground">
              Scheduling that stays open.
            </h2>
            <p className="text-muted-foreground">
              Share your availability, prevent double-booking, and let guests
              book time from any timezone.
            </p>
          </div>

          {/* Decorative booking illustration */}
          <div className="w-full rounded-lg border border-border bg-card p-6 shadow-sm">
            <div className="space-y-4">
              {/* Mock calendar header */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  March 2024
                </span>
                <div className="flex space-x-1">
                  <div className="h-6 w-6 rounded bg-muted" aria-hidden="true" />
                  <div className="h-6 w-6 rounded bg-muted" aria-hidden="true" />
                </div>
              </div>
              {/* Mock calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => (
                  <div
                    key={i}
                    className="flex h-8 w-8 items-center justify-center text-xs text-muted-foreground"
                    aria-hidden="true"
                  >
                    {day}
                  </div>
                ))}
                {Array.from({ length: 14 }, (_, i) => (
                  <div
                    key={`day-${i}`}
                    className={`flex h-8 w-8 items-center justify-center rounded text-xs ${
                      i === 7
                        ? "bg-primary text-primary-foreground font-medium"
                        : "text-foreground"
                    }`}
                    aria-hidden="true"
                  >
                    {i + 1}
                  </div>
                ))}
              </div>
              {/* Mock time slots */}
              <div className="space-y-2">
                <div className="h-8 rounded-md bg-accent border border-primary/20 flex items-center justify-center text-xs text-primary font-medium" aria-hidden="true">
                  9:00 AM
                </div>
                <div className="h-8 rounded-md bg-muted flex items-center justify-center text-xs text-muted-foreground" aria-hidden="true">
                  10:00 AM
                </div>
                <div className="h-8 rounded-md bg-muted flex items-center justify-center text-xs text-muted-foreground" aria-hidden="true">
                  11:00 AM
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
