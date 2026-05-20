import type { Metadata } from "next";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

export const runtime = "edge";

export const metadata: Metadata = {
  title: "OpenSlot - Share availability. Book time. Stay in sync.",
  description:
    "A scheduling platform that lets you share your availability, let guests book time slots, and stay in sync.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
