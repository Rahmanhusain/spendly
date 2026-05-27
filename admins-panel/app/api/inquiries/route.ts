import { NextResponse } from "next/server";
import { extractAdminAuthContext } from "../../../lib/middleware/adminAuth";
import { listInquiries } from "../../../lib/repositories/adminRepository";
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

export async function GET(request: Request) {
  const ctx = await extractAdminAuthContext(request);
  if (!ctx) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED" } },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const reasonParam = searchParams.get("reason");
  const result = await listInquiries({
    status: isInquiryStatus(statusParam) ? statusParam : undefined,
    reason: isInquiryReason(reasonParam) ? reasonParam : undefined,
    search: searchParams.get("search") ?? undefined,
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
    limit: parseInt(searchParams.get("limit") ?? "20"),
    offset: parseInt(searchParams.get("offset") ?? "0"),
  });

  return NextResponse.json({ ok: true, ...result }, { status: 200 });
}
