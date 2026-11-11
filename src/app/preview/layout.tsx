import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/server/auth/require-admin";

export const metadata: Metadata = {
  title: "Kitchen UI Details Preview · The Pooja Edit",
  description:
    "Standalone preview for receipt printer and hold-to-delete interactions.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Gate preview in production: notFound() unless an active admin session exists
  if (process.env.NODE_ENV === "production") {
    try {
      await requireAdmin();
    } catch {
      notFound();
    }
  }

  return <>{children}</>;
}
