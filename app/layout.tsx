import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Spendly",
    template: "%s | Spendly",
  },
  description:
    "India-first expense management for tenant onboarding, receipt capture, approvals, and GST-ready reporting.",
  icons: {
    icon: [
      { url: "/logo/app_favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/logo/app_favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/logo/app_favicon/favicon.ico", sizes: "any" },
    ],
    apple: { url: "/logo/app_favicon/apple-touch-icon.png" },
    other: [
      { rel: "android-chrome-192x192", url: "/logo/app_favicon/android-chrome-192x192.png" },
      { rel: "android-chrome-512x512", url: "/logo/app_favicon/android-chrome-512x512.png" },
    ],
  },
  manifest: "/logo/app_favicon/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      data-scroll-behavior="smooth"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
