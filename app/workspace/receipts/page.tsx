import { redirect } from "next/navigation";
import { getServerAuthContext } from "@/lib/middleware/auth";
import {
  getReceiptCountForTenant,
  getReceiptsForTenant,
} from "@/lib/repositories/receiptRepository";
import { ReceiptsWorkspace } from "./receipts-workspace";

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

export default async function AllReceiptsPage() {
  const authContext = await getServerAuthContext();

  if (!authContext) {
    redirect("/login");
  }

  const pageSize = 25;
  const { dateFrom, dateTo } = getCurrentMonthRange();

  const [receipts, total] = await Promise.all([
    getReceiptsForTenant(authContext.tenantId, {
      limit: pageSize,
      offset: 0,
    }),
    getReceiptCountForTenant(authContext.tenantId, {}),
  ]);

  const canReview =
    authContext.role === "admin" || authContext.role === "manager";

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
