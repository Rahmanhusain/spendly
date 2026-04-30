import { query, transaction } from "@/lib/db/client";

function toPublicReceiptUrl(filePath: string | null): string | null {
  if (!filePath) {
    return null;
  }

  const normalized = filePath.replace(/\\/g, "/");

  if (normalized.startsWith("./public/")) {
    return normalized.slice("./public".length);
  }

  if (normalized.startsWith("public/")) {
    return `/${normalized.slice("public/".length)}`;
  }

  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

export type ReportStatus =
  | "draft"
  | "submitted"
  | "info_requested"
  | "approved"
  | "rejected"
  | "paid";

export type ExpenseReport = {
  id: string;
  tenantId: string;
  userId: string;
  creatorName?: string | null;
  title: string;
  description: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  totalAmount: number;
  status: ReportStatus;
  approverId: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  paidAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExpenseReportItem = {
  id: string;
  tenantId: string;
  reportId: string;
  receiptId: string;
  lineNumber: number | null;
  createdAt: string;
};

export type CreateReportInput = {
  title: string;
  description?: string;
  periodStart?: string;
  periodEnd?: string;
};

export type UpdateReportInput = {
  title?: string;
  description?: string;
  periodStart?: string;
  periodEnd?: string;
};

/**
 * Create a new expense report
 */
export async function createReport(
  tenantId: string,
  userId: string,
  input: CreateReportInput,
): Promise<ExpenseReport> {
  const result = await query<ExpenseReport>(
    `INSERT INTO expense_reports (
      tenant_id, user_id, title, description, 
      period_start, period_end, status, total_amount
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING 
      id, tenant_id as "tenantId", user_id as "userId", 
      title, description, period_start as "periodStart", 
      period_end as "periodEnd", total_amount as "totalAmount",
      status, approver_id as "approverId", submitted_at as "submittedAt",
      approved_at as "approvedAt", rejected_at as "rejectedAt",
      paid_at as "paidAt", rejection_reason as "rejectionReason",
      created_at as "createdAt", updated_at as "updatedAt"`,
    [
      tenantId,
      userId,
      input.title,
      input.description || null,
      input.periodStart || null,
      input.periodEnd || null,
      "draft",
      0,
    ],
  );

  if (result.rows.length === 0) {
    throw new Error("Failed to create expense report");
  }

  return result.rows[0];
}

/**
 * Get a report by ID
 */
export async function getReportById(
  tenantId: string,
  reportId: string,
): Promise<ExpenseReport | null> {
  const result = await query<ExpenseReport>(
    `SELECT 
      er.id, er.tenant_id as "tenantId", er.user_id as "userId",
      COALESCE(NULLIF(CONCAT(u.first_name, ' ', u.last_name), ''), u.email) as "creatorName",
      er.title, er.description, er.period_start as "periodStart",
      er.period_end as "periodEnd", er.total_amount as "totalAmount",
      er.status, er.approver_id as "approverId", er.submitted_at as "submittedAt",
      er.approved_at as "approvedAt", er.rejected_at as "rejectedAt",
      er.paid_at as "paidAt", er.rejection_reason as "rejectionReason",
      er.created_at as "createdAt", er.updated_at as "updatedAt"
    FROM expense_reports er
    LEFT JOIN users u ON u.id = er.user_id
    WHERE er.id = $1 AND er.tenant_id = $2`,
    [reportId, tenantId],
  );

  return result.rows[0] || null;
}

/**
 * Get all reports for a tenant with optional filters
 */
export async function getReportsForTenant(
  tenantId: string,
  filters?: {
    userId?: string;
    status?: ReportStatus | "all";
    search?: string;
    limit?: number;
    offset?: number;
  },
): Promise<{ reports: ExpenseReport[]; total: number }> {
  const limit = Math.min(Math.max(filters?.limit || 25, 1), 200);
  const offset = Math.max(filters?.offset || 0, 0);

  let whereClause = "WHERE er.tenant_id = $1";
  const params: (string | number)[] = [tenantId];

  if (filters?.userId) {
    // Employees should see reports they are involved with (owner OR mentioned/updated via in-app notifications).
    // This keeps the UI aligned with team-collaboration + mentions without requiring strict comment-schema storage.
    whereClause += ` AND (
      er.user_id = $${params.length + 1}
      OR EXISTS (
        SELECT 1
        FROM notifications n
        WHERE n.tenant_id = $1
          AND n.user_id = $${params.length + 1}
          AND n.channel = 'in_app'
          AND n.related_type = 'expense_report'
          AND n.related_id = er.id
      )
    )`;
    params.push(filters.userId);
  }

  if (filters?.status && filters.status !== "all") {
    whereClause += ` AND er.status = $${params.length + 1}`;
    params.push(filters.status);
  }

  if (filters?.search && filters.search.trim()) {
    const searchValue = `%${filters.search.trim()}%`;
    whereClause += ` AND (
      er.title ILIKE $${params.length + 1}
      OR er.id::text ILIKE $${params.length + 1}
    )`;
    params.push(searchValue);
  }

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM expense_reports er ${whereClause}`,
    params,
  );

  const listResult = await query<ExpenseReport>(
    `SELECT 
      er.id, er.tenant_id as "tenantId", er.user_id as "userId",
      COALESCE(NULLIF(CONCAT(u.first_name, ' ', u.last_name), ''), u.email) as "creatorName",
      er.title, er.description, er.period_start as "periodStart",
      er.period_end as "periodEnd", er.total_amount as "totalAmount",
      er.status, er.approver_id as "approverId", er.submitted_at as "submittedAt",
      er.approved_at as "approvedAt", er.rejected_at as "rejectedAt",
      er.paid_at as "paidAt", er.rejection_reason as "rejectionReason",
      er.created_at as "createdAt", er.updated_at as "updatedAt"
    FROM expense_reports er
    LEFT JOIN users u ON u.id = er.user_id
    ${whereClause}
    ORDER BY er.created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );

  return {
    reports: listResult.rows,
    total: parseInt(countResult.rows[0].count, 10),
  };
}

/**
 * Update a report
 */
export async function updateReport(
  tenantId: string,
  reportId: string,
  input: UpdateReportInput,
): Promise<ExpenseReport> {
  const updates: string[] = [];
  // NOTE: query uses `WHERE id = $1 AND tenant_id = $2`, so the param order must be [reportId, tenantId].
  const params: (string | number | null)[] = [reportId, tenantId];

  if (input.title !== undefined) {
    updates.push(`title = $${params.length + 1}`);
    params.push(input.title);
  }

  if (input.description !== undefined) {
    updates.push(`description = $${params.length + 1}`);
    params.push(input.description);
  }

  if (input.periodStart !== undefined) {
    updates.push(`period_start = $${params.length + 1}`);
    params.push(input.periodStart);
  }

  if (input.periodEnd !== undefined) {
    updates.push(`period_end = $${params.length + 1}`);
    params.push(input.periodEnd);
  }

  if (updates.length === 0) {
    return getReportById(tenantId, reportId) as Promise<ExpenseReport>;
  }

  const result = await query<ExpenseReport>(
    `UPDATE expense_reports 
    SET ${updates.join(", ")}
    WHERE id = $1 AND tenant_id = $2
    RETURNING 
      id, tenant_id as "tenantId", user_id as "userId",
      title, description, period_start as "periodStart",
      period_end as "periodEnd", total_amount as "totalAmount",
      status, approver_id as "approverId", submitted_at as "submittedAt",
      approved_at as "approvedAt", rejected_at as "rejectedAt",
      paid_at as "paidAt", rejection_reason as "rejectionReason",
      created_at as "createdAt", updated_at as "updatedAt"`,
    params,
  );

  if (result.rows.length === 0) {
    throw new Error("Report not found");
  }

  return result.rows[0];
}

/**
 * Add a receipt to a report
 */
export async function addReceiptToReport(
  tenantId: string,
  reportId: string,
  receiptId: string,
): Promise<ExpenseReportItem> {
  return transaction(async (client) => {
    // Check report exists and is draft
    const reportCheck = await client.query(
      `SELECT id, total_amount, status FROM expense_reports 
       WHERE id = $1 AND tenant_id = $2`,
      [reportId, tenantId],
    );

    if (reportCheck.rows.length === 0) {
      throw new Error("Report not found");
    }

    const report = reportCheck.rows[0];
    if (report.status !== "draft" && report.status !== "info_requested") {
      throw new Error(
        "Cannot add receipts unless the report is draft or info requested",
      );
    }

    // Check receipt exists and get amount
    const receiptCheck = await client.query(
      `SELECT id, amount, status FROM receipts
       WHERE id = $1 AND tenant_id = $2`,
      [receiptId, tenantId],
    );

    if (receiptCheck.rows.length === 0) {
      throw new Error("Receipt not found");
    }

    const receipt = receiptCheck.rows[0];
    if (receipt.status !== "verified") {
      throw new Error("Can only add verified receipts to a report");
    }

    // Check if receipt already in report
    const existing = await client.query(
      `SELECT id FROM expense_report_items 
       WHERE report_id = $1 AND receipt_id = $2 AND tenant_id = $3`,
      [reportId, receiptId, tenantId],
    );

    if (existing.rows.length > 0) {
      throw new Error("Receipt already in report");
    }

    // Insert report item
    const itemResult = await client.query(
      `INSERT INTO expense_report_items (
        tenant_id, report_id, receipt_id
      ) VALUES ($1, $2, $3)
      RETURNING 
        id, tenant_id as "tenantId", report_id as "reportId",
        receipt_id as "receiptId", line_number as "lineNumber",
        created_at as "createdAt"`,
      [tenantId, reportId, receiptId],
    );

    // Update report total
    await client.query(
      `UPDATE expense_reports 
       SET total_amount = total_amount + $1
       WHERE id = $2 AND tenant_id = $3`,
      [receipt.amount, reportId, tenantId],
    );

    return itemResult.rows[0] as ExpenseReportItem;
  });
}

/**
 * Remove a receipt from a report
 */
export async function removeReceiptFromReport(
  tenantId: string,
  reportId: string,
  receiptId: string,
): Promise<void> {
  return transaction(async (client) => {
    // Check report is draft
    const reportCheck = await client.query(
      `SELECT status FROM expense_reports 
       WHERE id = $1 AND tenant_id = $2`,
      [reportId, tenantId],
    );

    if (reportCheck.rows.length === 0) {
      throw new Error("Report not found");
    }

    if (reportCheck.rows[0].status !== "draft") {
      if (reportCheck.rows[0].status !== "info_requested") {
        throw new Error(
          "Cannot remove receipts unless the report is draft or info requested",
        );
      }
    }

    // Get receipt amount
    const receiptCheck = await client.query(
      `SELECT amount FROM receipts
       WHERE id = $1 AND tenant_id = $2`,
      [receiptId, tenantId],
    );

    if (receiptCheck.rows.length === 0) {
      throw new Error("Receipt not found");
    }

    // Delete report item
    await client.query(
      `DELETE FROM expense_report_items 
       WHERE report_id = $1 AND receipt_id = $2 AND tenant_id = $3`,
      [reportId, receiptId, tenantId],
    );

    // Update report total
    await client.query(
      `UPDATE expense_reports 
       SET total_amount = total_amount - $1
       WHERE id = $2 AND tenant_id = $3`,
      [receiptCheck.rows[0].amount, reportId, tenantId],
    );
  });
}

/**
 * Get report items with receipt details
 */
export async function getReportItemsWithDetails(
  tenantId: string,
  reportId: string,
): Promise<
  Array<{
    id: string;
    receiptId: string;
    vendor: string;
    amount: number;
    category: string;
    receiptDate: string;
    uploadedAt: string;
  }>
> {
  const result = await query<{
    id: string;
    receiptId: string;
    vendor: string;
    amount: number;
    category: string;
    receiptDate: string;
    uploadedAt: string;
    uploadedById: string | null;
    uploadedByName: string | null;
    uploadedByRole: string | null;
    filePath: string | null;
    fileUrl: string | null;
    fileName: string | null;
    mimeType: string | null;
    vendorGstin: string | null;
    isDuplicate: boolean;
    duplicateOf: string | null;
  }>(
    `SELECT 
      ri.id,
      r.id as "receiptId",
      r.vendor_name as vendor,
      r.amount,
      r.category,
      r.receipt_date as "receiptDate",
      r.created_at::text as "uploadedAt",
      r.user_id::text as "uploadedById",
      COALESCE(NULLIF(CONCAT(u.first_name, ' ', u.last_name), ''), u.email) as "uploadedByName",
      u.role as "uploadedByRole",
      r.file_path as "filePath",
      r.file_name as "fileName",
      r.mime_type as "mimeType",
      r.vendor_gstin as "vendorGstin",
      r.is_duplicate as "isDuplicate",
      r.duplicate_of as "duplicateOf"
    FROM expense_report_items ri
    JOIN receipts r ON ri.receipt_id = r.id
    LEFT JOIN users u ON r.user_id = u.id
    WHERE ri.report_id = $1 AND ri.tenant_id = $2
    ORDER BY ri.created_at ASC`,
    [reportId, tenantId],
  );

  return result.rows.map((row) => ({
    ...row,
    fileUrl: toPublicReceiptUrl(row.filePath),
  }));
}

/**
 * Submit a report for approval
 */
export async function submitReport(
  tenantId: string,
  reportId: string,
  fromStatuses: Array<"draft" | "info_requested"> = ["draft"],
): Promise<ExpenseReport> {
  // Backend validation: ensure there is at least one verified receipt in the report.
  // (UI prevents empty submissions, but we enforce it here for correctness.)
  const [totalItems, verifiedItems] = await Promise.all([
    query<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM expense_report_items ri
       WHERE ri.report_id = $1 AND ri.tenant_id = $2`,
      [reportId, tenantId],
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM expense_report_items ri
       JOIN receipts r ON ri.receipt_id = r.id
       WHERE ri.report_id = $1 AND ri.tenant_id = $2
         AND r.status = 'verified'`,
      [reportId, tenantId],
    ),
  ]);

  const totalCount = parseInt(totalItems.rows[0]?.count || "0", 10);
  const verifiedCount = parseInt(verifiedItems.rows[0]?.count || "0", 10);

  if (totalCount === 0) {
    throw new Error("Report must have at least one receipt");
  }
  if (verifiedCount !== totalCount) {
    throw new Error("All receipts must be verified before submission");
  }

  const result = await query<ExpenseReport>(
    `UPDATE expense_reports 
    SET status = $1, submitted_at = NOW()
    WHERE id = $2 AND tenant_id = $3 AND status = ANY($4::report_status[])
    RETURNING 
      id, tenant_id as "tenantId", user_id as "userId",
      title, description, period_start as "periodStart",
      period_end as "periodEnd", total_amount as "totalAmount",
      status, approver_id as "approverId", submitted_at as "submittedAt",
      approved_at as "approvedAt", rejected_at as "rejectedAt",
      paid_at as "paidAt", rejection_reason as "rejectionReason",
      created_at as "createdAt", updated_at as "updatedAt"`,
    ["submitted", reportId, tenantId, fromStatuses],
  );

  if (result.rows.length === 0) {
    throw new Error("Report not found or cannot be submitted from this state");
  }

  return result.rows[0];
}

/**
 * Approve a report
 */
export async function approveReport(
  tenantId: string,
  reportId: string,
  approverId: string,
): Promise<ExpenseReport> {
  const result = await query<ExpenseReport>(
    `UPDATE expense_reports 
    SET status = $1, approved_at = NOW(), approver_id = $2
    WHERE id = $3 AND tenant_id = $4 AND status = $5
    RETURNING 
      id, tenant_id as "tenantId", user_id as "userId",
      title, description, period_start as "periodStart",
      period_end as "periodEnd", total_amount as "totalAmount",
      status, approver_id as "approverId", submitted_at as "submittedAt",
      approved_at as "approvedAt", rejected_at as "rejectedAt",
      paid_at as "paidAt", rejection_reason as "rejectionReason",
      created_at as "createdAt", updated_at as "updatedAt"`,
    ["approved", approverId, reportId, tenantId, "submitted"],
  );

  if (result.rows.length === 0) {
    throw new Error("Report not found or not in submitted state");
  }

  return result.rows[0];
}

/**
 * Reject a report
 */
export async function rejectReport(
  tenantId: string,
  reportId: string,
  reason: string,
): Promise<ExpenseReport> {
  const result = await query<ExpenseReport>(
    `UPDATE expense_reports 
    SET status = $1, rejected_at = NOW(), rejection_reason = $2
    WHERE id = $3 AND tenant_id = $4 AND status = $5
    RETURNING 
      id, tenant_id as "tenantId", user_id as "userId",
      title, description, period_start as "periodStart",
      period_end as "periodEnd", total_amount as "totalAmount",
      status, approver_id as "approverId", submitted_at as "submittedAt",
      approved_at as "approvedAt", rejected_at as "rejectedAt",
      paid_at as "paidAt", rejection_reason as "rejectionReason",
      created_at as "createdAt", updated_at as "updatedAt"`,
    // Story requirement: rejected report returns to draft for employee to fix/resubmit.
    ["draft", reason, reportId, tenantId, "submitted"],
  );

  if (result.rows.length === 0) {
    throw new Error("Report not found or not in submitted state");
  }

  return result.rows[0];
}

/**
 * Delete a report (draft only)
 */
export async function deleteReport(
  tenantId: string,
  reportId: string,
): Promise<void> {
  const result = await query(
    `DELETE FROM expense_reports 
    WHERE id = $1 AND tenant_id = $2 AND status = $3`,
    [reportId, tenantId, "draft"],
  );

  if (result.rowCount === 0) {
    throw new Error("Report not found or not a draft");
  }
}

/**
 * Request additional info from employee (change status to info_requested)
 */
export async function requestInfoReport(
  tenantId: string,
  reportId: string,
  infoRequestReason: string,
): Promise<ExpenseReport> {
  const result = await query<ExpenseReport>(
    `UPDATE expense_reports 
    SET status = $1, updated_at = NOW()
    WHERE id = $2 AND tenant_id = $3 AND status = $4
    RETURNING 
      id, tenant_id as "tenantId", user_id as "userId",
      title, description, period_start as "periodStart",
      period_end as "periodEnd", total_amount as "totalAmount",
      status, approver_id as "approverId", submitted_at as "submittedAt",
      approved_at as "approvedAt", rejected_at as "rejectedAt",
      paid_at as "paidAt", rejection_reason as "rejectionReason",
      created_at as "createdAt", updated_at as "updatedAt"`,
    ["info_requested", reportId, tenantId, "submitted"],
  );

  if (result.rows.length === 0) {
    throw new Error("Report not found or not in submitted state");
  }

  return result.rows[0];
}

/**
 * Mark a report as paid
 */
export async function markReportAsPaid(
  tenantId: string,
  reportId: string,
): Promise<ExpenseReport> {
  const result = await query<ExpenseReport>(
    `UPDATE expense_reports 
    SET status = $1, paid_at = NOW()
    WHERE id = $2 AND tenant_id = $3 AND status = $4
    RETURNING 
      id, tenant_id as "tenantId", user_id as "userId",
      title, description, period_start as "periodStart",
      period_end as "periodEnd", total_amount as "totalAmount",
      status, approver_id as "approverId", submitted_at as "submittedAt",
      approved_at as "approvedAt", rejected_at as "rejectedAt",
      paid_at as "paidAt", rejection_reason as "rejectionReason",
      created_at as "createdAt", updated_at as "updatedAt"`,
    ["paid", reportId, tenantId, "approved"],
  );

  if (result.rows.length === 0) {
    throw new Error("Report not found or not in approved state");
  }

  return result.rows[0];
}
