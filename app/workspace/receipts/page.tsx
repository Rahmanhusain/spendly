import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerAuthContext } from "@/lib/middleware/auth";
import {
  getReceiptCountForTenant,
  getReceiptsForTenant,
} from "@/lib/repositories/receiptRepository";
import { ReceiptsWorkspace } from "./receipts-workspace";
import ReceiptsLoading from "./loading";

function getCurrentMonthRange(referenceDate = new Date()): {
  dateFrom: string;
  dateTo: string;
} {
  const pad = (value: number) => String(value).padStart(2, "0");
  const firstDay = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    1,
  );
  const toIsoDate = (date: Date) =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return {
    dateFrom: toIsoDate(firstDay),
    dateTo: toIsoDate(referenceDate),
  };
}

// ─── Data component — suspends while fetching ────────────────────────────────
async function ReceiptsData({
  tenantId,
  canReview,
}: {
  tenantId: string;
  canReview: boolean;
}) {
  const pageSize = 25;
  const { dateFrom, dateTo } = getCurrentMonthRange();

  const [receipts, total] = await Promise.all([
    getReceiptsForTenant(tenantId, { limit: pageSize, offset: 0 }),
    getReceiptCountForTenant(tenantId, {}),
  ]);

  return (
    <ReceiptsWorkspace
      receipts={receipts}
      canReview={canReview}
      initialPageSize={pageSize}
      initialHasMore={receipts.length < total}
      initialDateFrom={dateFrom}
      initialDateTo={dateTo}
    />
  );
}

// ─── Page — auth only, renders instantly ─────────────────────────────────────
export default async function AllReceiptsPage() {
  const authContext = await getServerAuthContext();

  if (!authContext) {
    redirect("/api/auth/logout?next=/login");
  }

  const canReview =
    authContext.role === "admin" || authContext.role === "manager";

  return (
    <Suspense fallback={<ReceiptsLoading />}>
      <ReceiptsData tenantId={authContext.tenantId} canReview={canReview} />
    </Suspense>
  );
}
