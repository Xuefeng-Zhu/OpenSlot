import { routeMetadata } from "@/app/route-metadata";

export const metadata = routeMetadata.manageBooking;

export default function BookingManagementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
