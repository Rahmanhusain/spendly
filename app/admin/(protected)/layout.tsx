import { redirect } from "next/navigation";
import { getServerAdminAuthContext } from "@/lib/middleware/adminAuth";
import { AdminShell } from "@/components/admin/admin-shell";

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getServerAdminAuthContext();
  if (!ctx) redirect("/admin/login");

  return (
    <AdminShell adminName={ctx.name} adminEmail={ctx.email}>
      {children}
    </AdminShell>
  );
}
