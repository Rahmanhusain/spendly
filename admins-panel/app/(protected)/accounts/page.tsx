import { listTenants } from "../../../lib/repositories/adminRepository";
import { AccountsClient } from "../../../components/accounts-client";

export const metadata = { title: "Accounts" };

export default async function AdminAccountsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const offset = parseInt(sp.offset ?? "0");
  const limit = 20;

  const result = await listTenants({
    search: sp.search ?? undefined,
    status: sp.status ?? undefined,
    limit,
    offset,
  });

  return (
    <AccountsClient
      key={`${sp.search ?? ""}-${sp.status ?? ""}`}
      rows={result.rows}
      total={result.total}
      offset={offset}
      limit={limit}
      search={sp.search ?? ""}
      statusFilter={sp.status ?? ""}
    />
  );
}
