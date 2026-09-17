import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Alexon Fleet", template: "%s · Alexon Fleet" },
  description: "Alexon Fleet & Asset Management System",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1A1870" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
