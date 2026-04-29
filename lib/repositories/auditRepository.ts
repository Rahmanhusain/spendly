import { query } from "@/lib/db/client";

export type AuditLogEntry = {
  id: string;
  tenantId: string;
  userId: string | null;
  userName?: string | null;
  userRole?: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
};

export type CreateAuditLogInput = {
  userId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  // For convenience we keep the existing `details` naming used across routes,
  // but we persist it into the `metadata` column in the DB.
  details?: Record<string, unknown>;
  beforeData?: Record<string, unknown>;
  afterData?: Record<string, unknown>;
};

/**
 * Log an audit event
 */
export async function createAuditLog(
  tenantId: string,
  input: CreateAuditLogInput,
): Promise<AuditLogEntry> {
  const result = await query<AuditLogEntry>(
    `INSERT INTO audit_logs (
      tenant_id, user_id, action, resource_type,
      resource_id, before_data, after_data, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING 
      id, tenant_id as "tenantId", user_id as "userId",
      action, resource_type as "resourceType",
      resource_id as "resourceId",
      before_data as "beforeData",
      after_data as "afterData",
      metadata,
      created_at as "createdAt"`,
    [
      tenantId,
      input.userId || null,
      input.action,
      input.resourceType,
      input.resourceId || null,
      input.beforeData ? JSON.stringify(input.beforeData) : null,
      input.afterData ? JSON.stringify(input.afterData) : null,
      input.details ? JSON.stringify(input.details) : null,
    ],
  );

  return result.rows[0];
}

/**
 * Get audit logs for a report with formatted dates
 */
export async function getReportAuditLog(
  tenantId: string,
  reportId: string,
): Promise<AuditLogEntry[]> {
  const result = await query<AuditLogEntry>(
    `SELECT 
      al.id, al.tenant_id as "tenantId", al.user_id as "userId",
      u.first_name || ' ' || u.last_name as "userName",
      u.role as "userRole",
      al.action, al.resource_type as "resourceType",
      al.resource_id as "resourceId",
      al.before_data as "beforeData",
      al.after_data as "afterData",
      al.metadata as "metadata",
      al.created_at as "createdAt"
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    WHERE al.tenant_id = $1 AND al.resource_type = 'expense_report' 
      AND al.resource_id = $2
    ORDER BY al.created_at DESC`,
    [tenantId, reportId],
  );

  // Format createdAt dates to ISO string for consistency
  return result.rows.map((row) => ({
    ...row,
    createdAt: formatDateToISO(row.createdAt),
  }));
}

/**
 * Helper function to format date to ISO string
 */
function formatDateToISO(date: string | null | undefined): string {
  if (!date) return "";
  const dateObj = new Date(date);
  return dateObj.toISOString();
}

/**
 * Log report status change
 */
export async function logReportStatusChange(
  tenantId: string,
  reportId: string,
  userId: string | null,
  oldStatus: string,
  newStatus: string,
  additionalDetails?: Record<string, unknown>,
): Promise<void> {
  await createAuditLog(tenantId, {
    userId,
    action: `status_changed_${oldStatus}_to_${newStatus}`,
    resourceType: "expense_report",
    resourceId: reportId,
    details: {
      oldStatus,
      newStatus,
      ...additionalDetails,
    },
  });
}

/**
 * Get activity summary for a report
 */
export async function getReportActivitySummary(
  tenantId: string,
  reportId: string,
): Promise<{
  createdAt: string;
  submittedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  paidAt?: string;
  recentCommentCount: number;
}> {
  const reportResult = await query(
    `SELECT 
      created_at as "createdAt",
      submitted_at as "submittedAt",
      approved_at as "approvedAt",
      rejected_at as "rejectedAt",
      paid_at as "paidAt"
    FROM expense_reports
    WHERE id = $1 AND tenant_id = $2`,
    [reportId, tenantId],
  );

  const commentResult = await query(
    `SELECT COUNT(*) as count FROM report_comments
    WHERE tenant_id = $1 AND report_id = $2
    AND created_at > NOW() - INTERVAL '7 days'`,
    [tenantId, reportId],
  );

  const report = reportResult.rows[0] || {};
  const recentCommentCount = parseInt(commentResult.rows[0]?.count || 0);

  return {
    createdAt: formatDateToISO(report.createdAt),
    submittedAt: report.submittedAt
      ? formatDateToISO(report.submittedAt)
      : undefined,
    approvedAt: report.approvedAt
      ? formatDateToISO(report.approvedAt)
      : undefined,
    rejectedAt: report.rejectedAt
      ? formatDateToISO(report.rejectedAt)
      : undefined,
    paidAt: report.paidAt ? formatDateToISO(report.paidAt) : undefined,
    recentCommentCount,
  };
}
