import { listInquiries } from "../../../lib/repositories/adminRepository";
import { InquiriesClient } from "../../../components/inquiries-client";
import type {
  InquiryReason,
  InquiryStatus,
} from "../../../lib/repositories/adminRepository";

const inquiryStatuses: InquiryStatus[] = [
  "new",
  "in_review",
  "reviewed",
  "closed",
];
const inquiryReasons: InquiryReason[] = [
  "complaint",
  "suggestion",
  "feedback",
  "query",
  "support",
  "partnership",
];

function isInquiryStatus(value: string | null): value is InquiryStatus {
  return value !== null && inquiryStatuses.includes(value as InquiryStatus);
}

function isInquiryReason(value: string | null): value is InquiryReason {
  return value !== null && inquiryReasons.includes(value as InquiryReason);
}

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
    status: isInquiryStatus(sp.status) ? sp.status : undefined,
    reason: isInquiryReason(sp.reason) ? sp.reason : undefined,
    search: sp.search ?? undefined,
    dateFrom: sp.dateFrom ?? undefined,
    dateTo: sp.dateTo ?? undefined,
    limit,
    offset,
  });

  return (
    <InquiriesClient
      key={`${sp.search ?? ""}-${sp.status ?? ""}-${sp.reason ?? ""}-${sp.dateFrom ?? ""}-${sp.dateTo ?? ""}`}
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
