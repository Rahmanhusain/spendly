import { redirect } from "next/navigation";
import { getServerAdminAuthContext } from "../../lib/middleware/adminAuth";
import { AdminShell } from "../../components/admin-shell";

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getServerAdminAuthContext();
  if (!ctx) redirect("/login");

  return (
    <AdminShell adminName={ctx.name} adminEmail={ctx.email}>
      {children}
    </AdminShell>
  );
}
