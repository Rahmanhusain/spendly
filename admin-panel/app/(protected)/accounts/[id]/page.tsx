import { notFound } from "next/navigation";
import { getTenantById } from "../../../../lib/repositories/authRepository";
import { listUsersForTenant } from "../../../../lib/repositories/adminRepository";
import { TenantDetailClient } from "../../../../components/tenant-detail-client";

export const metadata = { title: "Tenant Detail" };

export default async function TenantDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const offset = parseInt(sp.offset ?? "0");
  const limit = 50;

  const [tenant, users] = await Promise.all([
    getTenantById(id),
    listUsersForTenant(id, {
      search: sp.search ?? undefined,
      limit,
      offset,
    }),
  ]);

  if (!tenant) notFound();

  return (
    <TenantDetailClient
      tenant={tenant}
      users={users.rows}
      total={users.total}
      offset={offset}
      limit={limit}
      search={sp.search ?? ""}
    />
  );
}
