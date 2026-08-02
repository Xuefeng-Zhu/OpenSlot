import { routeMetadata } from "@/app/route-metadata";

export const metadata = routeMetadata.resetPassword;

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
