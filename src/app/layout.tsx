import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KhataLink – Digital Khata & Micro-Credit",
  description:
    "Simple digital ledger for local shops. Track credit, settle dues, and stay in sync with customers in real time.",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content="#059669" />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
