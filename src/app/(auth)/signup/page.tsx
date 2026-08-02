"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
} from "lucide-react";
import { createBrowserBackendClient } from "@/lib/backend/compat/browser-client";
import { AuthBrandPanel } from "@/components/auth/auth-brand-panel";
import { AppIcon } from "@/components/shared/app-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PASSWORD_COMPLEXITY_ERROR,
  getPasswordRequirements,
  isStrongPassword,
} from "@/lib/validations/password";

export default function SignupPage() {
  const router = useRouter();
  const fullNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

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

  const passwordRequirements = getPasswordRequirements(password);

  useEffect(() => {
    const firstInvalidField = errors.fullName
      ? fullNameRef
      : errors.email
        ? emailRef
        : errors.password
          ? passwordRef
          : null;

    firstInvalidField?.current?.focus();
  }, [errors.email, errors.fullName, errors.password]);

  function validate(): boolean {
    const newErrors: typeof errors = {};
    const trimmedEmail = email.trim();

    if (!fullName.trim()) {
      newErrors.fullName = "Full name is required.";
    }

    if (!trimmedEmail) {
      newErrors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      newErrors.email = "Please enter a valid email address.";
    }

    if (!password) {
      newErrors.password = "Password is required.";
    } else if (!isStrongPassword(password)) {
      newErrors.password = PASSWORD_COMPLEXITY_ERROR;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!validate()) return;

    setErrors({});
    setLoading(true);

    try {
      const backendClient = createBrowserBackendClient();
      const trimmedEmail = email.trim();

      const { data: signUpData, error: signUpError } =
        await backendClient.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            data: {
              full_name: fullName.trim(),
            },
          },
        });

      if (signUpError) {
        setErrors({ general: "Unable to create account. Please try again." });
        return;
      }

      if (signUpData?.requiresLogin) {
        router.push("/login?returnUrl=%2Fdashboard");
        router.refresh();
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setErrors({
        general:
          "Account creation is unavailable. Check the app configuration and try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full">
      {/* Left column - Signup form */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <AppIcon className="h-7 w-7" />
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
              <div
                className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
                role="alert"
              >
                {errors.general}
              </div>
            )}
            {(errors.fullName || errors.email || errors.password) && (
              <p className="sr-only" role="alert">
                Please correct the highlighted fields before creating your
                account.
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <div className="relative">
                <User
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  ref={fullNameRef}
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
                <Mail
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  ref={emailRef}
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
                <Lock
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  ref={passwordRef}
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="pl-9 pr-10"
                  aria-invalid={!!errors.password}
                  aria-describedby={
                    errors.password
                      ? "password-error password-requirements"
                      : "password-requirements"
                  }
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
              <ul
                id="password-requirements"
                aria-label="Password requirements"
                className="mt-2 flex flex-wrap gap-3"
              >
                {passwordRequirements.map((requirement) => (
                  <li
                    key={requirement.id}
                    data-state={requirement.isMet ? "met" : "unmet"}
                    className={`flex items-center gap-1 text-xs ${
                      requirement.isMet
                        ? "text-success"
                        : "text-muted-foreground"
                    }`}
                  >
                    <span className="sr-only">
                      {requirement.isMet ? "Met: " : "Not met: "}
                    </span>
                    {requirement.isMet ? (
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                    ) : (
                      <Circle className="h-3 w-3" aria-hidden="true" />
                    )}
                    {requirement.label}
                  </li>
                ))}
              </ul>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? (
                "Creating account..."
              ) : (
                <>
                  Create account
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </>
              )}
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

      <AuthBrandPanel />
    </div>
  );
}
