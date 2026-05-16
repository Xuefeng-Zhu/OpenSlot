import { redirect } from "next/navigation";
import { AuthBrandPanel } from "@/components/auth/auth-brand-panel";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";
import { loginReturnUrl } from "./return-url";

type LoginPageProps = {
  searchParams?: Promise<{
    returnUrl?: string | string[];
  }>;
};

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const returnUrl = loginReturnUrl(params?.returnUrl);
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(returnUrl);
  }

  return (
    <div className="flex min-h-screen w-full">
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <LoginForm returnUrl={returnUrl} />
      </div>
      <AuthBrandPanel />
    </div>
  );
}
