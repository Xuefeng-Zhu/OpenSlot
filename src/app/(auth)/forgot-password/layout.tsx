import { routeMetadata } from "@/app/route-metadata";

export const metadata = routeMetadata.forgotPassword;

export default function ForgotPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
