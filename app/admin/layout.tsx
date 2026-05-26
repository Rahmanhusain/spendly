import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Spendly Admin", template: "%s | Spendly Admin" },
  robots: { index: false, follow: false },
};

// Root admin layout — no auth check here.
// Auth is enforced by proxy.ts (redirects /admin/* to /admin/login)
// and by app/admin/(protected)/layout.tsx for the shell pages.
export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
