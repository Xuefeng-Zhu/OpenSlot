"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  Lock,
  Mail,
  Sparkles,
  User,
} from "lucide-react";

import {
  BookingPreview,
  ConfirmationToast,
  previewFeatures,
} from "@/components/brand/booking-preview";
import { OpenSlotLogo } from "@/components/brand/openslot-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

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
    <div className="min-h-screen p-5">
      <div className="mx-auto grid min-h-[calc(100vh-40px)] max-w-[1440px] overflow-hidden rounded-[24px] border border-border bg-white shadow-lg lg:grid-cols-[0.43fr_0.57fr]">
        <section className="flex flex-col px-8 py-10 sm:px-14">
          <OpenSlotLogo />

          <div className="mt-14 max-w-[480px]">
            <h1 className="text-4xl font-extrabold text-foreground">
              Create your account
            </h1>
            <p className="mt-4 text-lg font-medium leading-8 text-muted-foreground">
              Join thousands of professionals who book smarter with OpenSlot.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="mt-9 max-w-[480px] rounded-[16px] border border-border bg-white shadow-sm"
            noValidate
          >
            <div className="grid grid-cols-2 border-b border-border text-sm font-extrabold">
              <button
                type="button"
                className="h-14 border-b-2 border-primary text-primary"
              >
                Sign up
              </button>
              <Link
                href="/login"
                className="flex h-14 items-center justify-center text-muted-foreground"
              >
                Log in
              </Link>
            </div>

            <div className="space-y-6 p-8">
              {errors.general && (
                <div className="rounded-[10px] bg-destructive/10 p-3 text-sm font-medium text-destructive">
                  {errors.general}
                </div>
              )}

              <FieldIcon icon={<User className="h-5 w-5" aria-hidden="true" />}>
                <Label htmlFor="fullName">Full name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Sarah Chen"
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
              </FieldIcon>

              <FieldIcon icon={<Mail className="h-5 w-5" aria-hidden="true" />}>
                <Label htmlFor="email">Email address</Label>
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
              </FieldIcon>

              <FieldIcon icon={<Lock className="h-5 w-5" aria-hidden="true" />}>
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type="password"
                    placeholder="Create a strong password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? "password-error" : undefined}
                    className="pr-10"
                  />
                  <Eye
                    className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                </div>
                {errors.password && (
                  <p id="password-error" className="text-sm text-destructive">
                    {errors.password}
                  </p>
                )}
              </FieldIcon>

              <div className="grid gap-2 text-xs font-medium text-muted-foreground sm:grid-cols-3">
                {["At least 8 characters", "Includes a number", "Includes a lowercase letter"].map((item) => (
                  <span key={item} className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                    {item}
                  </span>
                ))}
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? "Creating account..." : "Create account"}
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>

              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-sm font-medium text-muted-foreground">
                <div className="h-px bg-border" />
                or continue with
                <div className="h-px bg-border" />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Button type="button" variant="outline">
                  <span className="mr-2 text-lg font-extrabold text-primary">G</span>
                  Google
                </Button>
                <Button type="button" variant="outline">
                  <span className="mr-2 grid h-4 w-4 grid-cols-2 gap-0.5" aria-hidden="true">
                    <span className="bg-[#f25022]" />
                    <span className="bg-[#7fba00]" />
                    <span className="bg-[#00a4ef]" />
                    <span className="bg-[#ffb900]" />
                  </span>
                  Microsoft
                </Button>
              </div>
            </div>
          </form>

          <p className="mt-7 max-w-[480px] text-center text-sm font-medium text-muted-foreground">
            By signing up, you agree to our{" "}
            <Link href="#" className="text-primary">Terms of Service</Link> and{" "}
            <Link href="#" className="text-primary">Privacy Policy</Link>.
          </p>
          <p className="mt-12 max-w-[480px] text-center text-sm font-medium text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-bold text-primary">
              Log in
            </Link>
          </p>
        </section>

        <section className="relative hidden overflow-hidden border-l border-border bg-background px-14 py-16 lg:block">
          <div className="openslot-dots pointer-events-none absolute right-2 top-48 h-[360px] w-[520px] opacity-70" />
          <div className="relative z-10">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-bold text-primary">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              The open way to schedule
            </div>
            <h2 className="max-w-[620px] text-[4.4rem] font-extrabold leading-[1.04] text-foreground">
              Scheduling that stays <span className="text-primary">open.</span>
            </h2>
            <p className="mt-6 max-w-[540px] text-xl font-medium leading-8 text-muted-foreground">
              Share your availability. Prevent double-booking. Let others book
              time that works for everyone, automatically across time zones.
            </p>
            <div className="relative mt-9">
              <BookingPreview />
              <div className="absolute -left-8 bottom-20 rounded-[12px] border border-border bg-white px-4 py-3 text-sm font-bold text-foreground shadow-md">
                Timezone
                <br />
                <span className="text-muted-foreground">detected</span>
              </div>
              <ConfirmationToast className="absolute -bottom-7 right-7" />
            </div>

            <div className="mt-20 grid grid-cols-3 gap-5">
              {previewFeatures.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-[14px] border border-border bg-white p-5 shadow-sm"
                >
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[12px] bg-accent text-primary">
                    <feature.icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <h3 className="text-sm font-extrabold text-foreground">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm font-medium leading-6 text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function FieldIcon({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-[38px] z-10 text-muted-foreground">
          {icon}
        </span>
        <div className="[&_input]:pl-11">{children}</div>
      </div>
    </div>
  );
}
