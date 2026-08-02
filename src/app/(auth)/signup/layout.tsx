import { routeMetadata } from "@/app/route-metadata";

export const metadata = routeMetadata.signup;

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
