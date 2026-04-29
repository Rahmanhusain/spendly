import { query } from "@/lib/db/client";

export type ReimbursementMethod = "upi" | "bank" | "cash" | "other";
export type ReimbursementStatus = "pending" | "paid" | "failed" | "cancelled";

export type Reimbursement = {
  id: string;
  tenantId: string;
  reportId: string;
  method: ReimbursementMethod | null;
  referenceNumber: string | null;
  amountPaid: number;
  paidBy: string | null;
  paidByName?: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateReimbursementInput = {
  method: ReimbursementMethod;
  referenceNumber?: string;
  amountPaid: number;
  paidBy: string;
};

/**
 * Create or update reimbursement record for a report
 */
export async function createOrUpdateReimbursement(
  tenantId: string,
  reportId: string,
  input: CreateReimbursementInput,
): Promise<Reimbursement> {
  // First, get the total report amount
  const reportResult = await query(
    `SELECT total_amount FROM expense_reports 
    WHERE id = $1 AND tenant_id = $2`,
    [reportId, tenantId],
  );

  if (reportResult.rows.length === 0) {
    throw new Error("Report not found");
  }

  const amountToUse = input.amountPaid || reportResult.rows[0].total_amount;

  // Try to update existing reimbursement
  let result = await query<Reimbursement>(
    `UPDATE reimbursements 
    SET method = $1, reference_number = $2, amount_paid = $3, 
        paid_by = $4, paid_at = NOW(), updated_at = NOW()
    WHERE report_id = $5 AND tenant_id = $6
    RETURNING 
      id, tenant_id as "tenantId", report_id as "reportId",
      method, reference_number as "referenceNumber",
      amount_paid as "amountPaid", paid_by as "paidBy",
      paid_at as "paidAt", created_at as "createdAt",
      updated_at as "updatedAt"`,
    [
      input.method,
      input.referenceNumber || null,
      amountToUse,
      input.paidBy,
      reportId,
      tenantId,
    ],
  );

  // If no existing record, create new one
  if (result.rowCount === 0) {
    result = await query<Reimbursement>(
      `INSERT INTO reimbursements (
        tenant_id, report_id, method, reference_number, 
        amount_paid, paid_by, paid_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING 
        id, tenant_id as "tenantId", report_id as "reportId",
        method, reference_number as "referenceNumber",
        amount_paid as "amountPaid", paid_by as "paidBy",
        paid_at as "paidAt", created_at as "createdAt",
        updated_at as "updatedAt"`,
      [
        tenantId,
        reportId,
        input.method,
        input.referenceNumber || null,
        amountToUse,
        input.paidBy,
      ],
    );
  }

  return result.rows[0];
}

/**
 * Get reimbursement details for a report
 */
export async function getReimbursement(
  tenantId: string,
  reportId: string,
): Promise<Reimbursement | null> {
  const result = await query<Reimbursement>(
    `SELECT 
      r.id, r.tenant_id as "tenantId", r.report_id as "reportId",
      r.method, r.reference_number as "referenceNumber",
      r.amount_paid as "amountPaid", r.paid_by as "paidBy",
      u.first_name || ' ' || u.last_name as "paidByName",
      r.paid_at as "paidAt", r.created_at as "createdAt",
      r.updated_at as "updatedAt"
    FROM reimbursements r
    LEFT JOIN users u ON r.paid_by = u.id
    WHERE r.tenant_id = $1 AND r.report_id = $2`,
    [tenantId, reportId],
  );

  return result.rows[0] || null;
}

/**
 * Get reimbursement status for a report
 */
export async function getReimbursementStatus(
  tenantId: string,
  reportId: string,
): Promise<{
  status: ReimbursementStatus;
  method?: ReimbursementMethod;
  amount?: number;
  paidAt?: string;
  referenceNumber?: string;
}> {
  const reimbursement = await getReimbursement(tenantId, reportId);

  if (!reimbursement || !reimbursement.paidAt) {
    return { status: "pending" };
  }

  return {
    status: "paid",
    method: reimbursement.method || undefined,
    amount: reimbursement.amountPaid,
    paidAt: reimbursement.paidAt,
    referenceNumber: reimbursement.referenceNumber || undefined,
  };
}

/**
 * Delete reimbursement (for cancellations)
 */
export async function deleteReimbursement(
  tenantId: string,
  reportId: string,
): Promise<boolean> {
  const result = await query(
    `DELETE FROM reimbursements 
    WHERE tenant_id = $1 AND report_id = $2`,
    [tenantId, reportId],
  );

  return (result.rowCount ?? 0) > 0;
}
