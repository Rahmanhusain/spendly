import { listInquiries } from "@/lib/repositories/adminRepository";
import { InquiriesClient } from "@/components/admin/inquiries-client";

export const metadata = { title: "Inquiries" };

export default async function AdminInquiriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const offset = parseInt(sp.offset ?? "0");
  const limit = 20;

  const result = await listInquiries({
    status: (sp.status as any) ?? undefined,
    reason: (sp.reason as any) ?? undefined,
    search: sp.search ?? undefined,
    dateFrom: sp.dateFrom ?? undefined,
    dateTo: sp.dateTo ?? undefined,
    limit,
    offset,
  });

  return (
    <InquiriesClient
      rows={result.rows}
      total={result.total}
      offset={offset}
      limit={limit}
      filters={{
        search: sp.search ?? "",
        status: sp.status ?? "",
        reason: sp.reason ?? "",
        dateFrom: sp.dateFrom ?? "",
        dateTo: sp.dateTo ?? "",
      }}
    />
  );
}
