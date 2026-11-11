import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kitchen UI Details Preview · The Pooja Edit",
  description: "Standalone preview for receipt printer and hold-to-delete interactions.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
