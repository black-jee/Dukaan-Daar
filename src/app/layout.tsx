import type { Metadata, Viewport } from "next";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import "./globals.css";

export const metadata: Metadata = {
  title: "KhataLink — Clear dues. Better business.",
  description:
    "A simple, secure digital khata for local shops and customers. Every shop gets its own private ledger.",
  manifest: "/manifest.json",
  applicationName: "KhataLink",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "KhataLink",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#047857",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
