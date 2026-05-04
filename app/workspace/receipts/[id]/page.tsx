import { notFound, redirect } from "next/navigation";
import { getServerAuthContext } from "@/lib/middleware/auth";
import {
  getReceiptById,
  getReceiptsForTenant,
} from "@/lib/repositories/receiptRepository";
import { query } from "@/lib/db/client";
import { ReceiptsWorkspace } from "@/app/workspace/receipts/receipts-workspace";

export default async function ReceiptByIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const authContext = await getServerAuthContext();
  if (!authContext) {
    redirect("/login");
  }

  const { id: receiptId } = await params;

  const [receipt, receipts] = await Promise.all([
    getReceiptById(authContext.tenantId, receiptId),
    getReceiptsForTenant(authContext.tenantId, { limit: 999, offset: 0 }),
  ]);

  if (!receipt) {
    notFound();
  }

  if (
    authContext.role === "employee" &&
    receipt.uploadedByUserId !== authContext.userId
  ) {
    const mentionResult = await query<{ exists: boolean }>(
      `SELECT EXISTS(
        SELECT 1
        FROM notifications n
        WHERE n.tenant_id = $1
          AND n.user_id = $2
          AND n.channel = 'in_app'
          AND n.related_type = 'receipt'
          AND n.related_id = $3
      ) as "exists"`,
      [authContext.tenantId, authContext.userId, receiptId],
    );

    const exists = mentionResult.rows[0]?.exists ?? false;
    if (!exists) {
      notFound();
    }
  }

  const initialReceipts = receipts.some((r) => r.id === receipt.id)
    ? receipts
    : [receipt, ...receipts];

  return (
    <ReceiptsWorkspace
      receipts={initialReceipts}
      canReview={authContext.role === "manager" || authContext.role === "admin"}
      initialPageSize={25}
      initialHasMore={false}
      initialDateFrom={new Date().toISOString().slice(0, 10)}
      initialDateTo={new Date().toISOString().slice(0, 10)}
      showReceiptBrowser={false}
      initialSelectedReceiptId={receipt.receiptId}
      initialSelectedDetails={receipt}
    />
  );
}
