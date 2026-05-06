"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignupPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{
    fullName?: string;
    email?: string;
    password?: string;
    general?: string;
  }>({});
  const [loading, setLoading] = useState(false);

  // Password strength checks
  const hasMinLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const hasLowercase = /[a-z]/.test(password);

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
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters.";
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
          {/* Logo */}
          <div className="flex items-center gap-2">
            <svg
              className="h-7 w-7"
              viewBox="0 0 28 28"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <rect width="28" height="28" rx="6" className="fill-primary" />
              <path
                d="M8 14.5L12 18.5L20 10.5"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-xl font-bold text-foreground">OpenSlot</span>
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Create your account
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Join thousands of professionals who book smarter with OpenSlot.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border">
            <Link
              href="/signup"
              className="border-b-2 border-primary px-4 pb-3 text-sm font-medium text-foreground"
            >
              Sign up
            </Link>
            <Link
              href="/login"
              className="border-b-2 border-transparent px-4 pb-3 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Log in
            </Link>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {errors.general && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {errors.general}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M8 8a3 3 0 100-6 3 3 0 000 6zM2 14a6 6 0 0112 0H2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Sarah Chen"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  className="pl-9"
                  aria-invalid={!!errors.fullName}
                  aria-describedby={errors.fullName ? "fullName-error" : undefined}
                />
              </div>
              {errors.fullName && (
                <p id="fullName-error" className="text-sm text-destructive">
                  {errors.fullName}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M2 4l6 4 6-4M2 4v8h12V4H2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="pl-9"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? "email-error" : undefined}
                />
              </div>
              {errors.email && (
                <p id="email-error" className="text-sm text-destructive">
                  {errors.email}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </span>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="pl-9 pr-10"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? "password-error" : "password-requirements"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p id="password-error" className="text-sm text-destructive">
                  {errors.password}
                </p>
              )}
              {/* Password strength indicators */}
              <div id="password-requirements" className="flex flex-wrap gap-3 mt-2">
                <span className={`flex items-center gap-1 text-xs ${hasMinLength ? "text-success" : "text-muted-foreground"}`}>
                  <Check className="h-3 w-3" aria-hidden="true" />
                  At least 8 characters
                </span>
                <span className={`flex items-center gap-1 text-xs ${hasNumber ? "text-success" : "text-muted-foreground"}`}>
                  <Check className="h-3 w-3" aria-hidden="true" />
                  Includes a number
                </span>
                <span className={`flex items-center gap-1 text-xs ${hasLowercase ? "text-success" : "text-muted-foreground"}`}>
                  <Check className="h-3 w-3" aria-hidden="true" />
                  Includes a lowercase letter
                </span>
              </div>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? "Creating account..." : "Create account →"}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              By signing up, you agree to our{" "}
              <Link href="/terms" className="text-primary underline-offset-4 hover:underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-primary underline-offset-4 hover:underline">
                Privacy Policy
              </Link>
              .
            </p>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Log in
              </Link>
            </p>
          </form>
        </div>
      </div>

      {/* Right column - Brand panel (hidden on mobile) */}
      <div className="hidden lg:flex flex-1 flex-col items-center justify-center bg-accent p-12 relative overflow-hidden">
        <div className="flex max-w-lg flex-col items-center text-center space-y-6">
          {/* Tagline */}
          <p className="text-sm font-medium text-primary flex items-center gap-1.5">
            <span aria-hidden="true">✨</span> The open way to schedule
          </p>

          {/* Headline */}
          <h2 className="text-4xl font-bold text-foreground leading-tight">
            Scheduling that stays{" "}
            <span className="text-primary">open.</span>
          </h2>

          <p className="text-muted-foreground">
            Share your availability. Prevent double-booking.
            Let others book time that works for everyone—
            automatically, across time zones.
          </p>

          {/* Mock booking preview */}
          <div className="w-full rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="grid grid-cols-3 gap-4">
              {/* Host info */}
              <div className="space-y-2">
                <div className="h-10 w-10 rounded-full bg-muted" aria-hidden="true" />
                <div className="text-xs font-medium text-foreground">Sarah Chen</div>
                <div className="text-[10px] text-muted-foreground">Product Designer</div>
                <div className="mt-2 space-y-1">
                  <div className="text-[10px] text-muted-foreground">⏱ 30 min</div>
                  <div className="text-[10px] text-muted-foreground">One-on-one meeting</div>
                  <div className="text-[10px] text-muted-foreground">🌐 Timezone</div>
                  <div className="text-[10px] text-muted-foreground">America/Los Angeles (PDT)</div>
                </div>
              </div>

              {/* Calendar */}
              <div>
                <div className="text-[10px] font-medium mb-1">May 2026</div>
                <div className="grid grid-cols-7 gap-px text-[8px]">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                    <div key={i} className="h-4 flex items-center justify-center text-muted-foreground">{d}</div>
                  ))}
                  {Array.from({ length: 28 }, (_, i) => (
                    <div
                      key={i}
                      className={`h-4 flex items-center justify-center rounded-full ${
                        i === 12 ? 'bg-primary text-primary-foreground' :
                        i === 10 || i === 11 ? 'text-primary font-medium' :
                        'text-foreground'
                      }`}
                      aria-hidden="true"
                    >
                      {i + 1}
                    </div>
                  ))}
                </div>
              </div>

              {/* Time slots */}
              <div>
                <div className="text-[10px] font-medium mb-1">Available times</div>
                <div className="space-y-1">
                  {['9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM'].map((time, i) => (
                    <div
                      key={time}
                      className={`h-5 flex items-center justify-center rounded text-[9px] ${
                        i === 0 ? 'bg-primary text-primary-foreground' : 'border border-border text-foreground'
                      }`}
                      aria-hidden="true"
                    >
                      {time}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Feature badges */}
          <div className="grid grid-cols-3 gap-3 w-full">
            <div className="text-center">
              <div className="mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
                <svg className="h-4 w-4 text-primary" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-[10px] font-medium text-foreground">Timezone aware</p>
              <p className="text-[9px] text-muted-foreground">We detect timezones automatically</p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-success/10">
                <svg className="h-4 w-4 text-success" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.06l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-[10px] font-medium text-foreground">Prevent double-booking</p>
              <p className="text-[9px] text-muted-foreground">Keep your schedule conflict-free</p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
                <svg className="h-4 w-4 text-primary" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15z" />
                </svg>
              </div>
              <p className="text-[10px] font-medium text-foreground">Share your availability</p>
              <p className="text-[9px] text-muted-foreground">Create your OpenSlot in seconds</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
