import { query } from "@/lib/db/client";

export type ReportAccessEntry = {
  id: string;
  tenantId: string;
  reportId: string;
  userId: string;
  userName?: string | null;
  userEmail?: string | null;
  addedBy: string;
  addedByName?: string | null;
  createdAt: string;
};

/**
 * Add a user to report access list
 * Employees must be added before they can view comments or be mentioned
 */
export async function addReportAccess(
  tenantId: string,
  reportId: string,
  userId: string,
  addedByUserId: string,
): Promise<ReportAccessEntry> {
  const result = await query<ReportAccessEntry>(
    `INSERT INTO report_access_list (
      tenant_id, report_id, user_id, added_by
    ) VALUES ($1, $2, $3, $4)
    ON CONFLICT (report_id, user_id) DO UPDATE
    SET added_by = $4
    RETURNING
      id, tenant_id as "tenantId", report_id as "reportId",
      user_id as "userId", added_by as "addedBy",
      created_at as "createdAt"`,
    [tenantId, reportId, userId, addedByUserId],
  );

  if (result.rows.length === 0) {
    throw new Error("Failed to add report access");
  }

  return result.rows[0];
}

/**
 * Remove a user from report access list
 */
export async function removeReportAccess(
  tenantId: string,
  reportId: string,
  userId: string,
): Promise<boolean> {
  const result = await query(
    `DELETE FROM report_access_list
    WHERE tenant_id = $1 AND report_id = $2 AND user_id = $3`,
    [tenantId, reportId, userId],
  );

  return (result.rowCount ?? 0) > 0;
}

/**
 * Check if user has access to report comments
 * Returns true if:
 * - User is manager or admin (can see all)
 * - User is the report creator
 * - User is in the access list
 */
export async function hasReportAccess(
  tenantId: string,
  reportId: string,
  userId: string,
  userRole: string,
): Promise<boolean> {
  // Managers and admins can see all reports
  if (userRole === "manager" || userRole === "admin") {
    return true;
  }

  // Check if user is report creator or in access list
  const result = await query<{ has_access: boolean }>(
    `SELECT EXISTS(
      SELECT 1 FROM expense_reports
      WHERE id = $1 AND tenant_id = $2 AND user_id = $3
    ) OR EXISTS(
      SELECT 1 FROM report_access_list
      WHERE report_id = $1 AND tenant_id = $2 AND user_id = $3
    ) as has_access`,
    [reportId, tenantId, userId],
  );

  return Boolean(result.rows[0]?.has_access);
}

/**
 * Get all users with access to a report
 */
export async function getReportAccessList(
  tenantId: string,
  reportId: string,
): Promise<ReportAccessEntry[]> {
  const result = await query<ReportAccessEntry>(
    `SELECT
      ral.id, ral.tenant_id as "tenantId", ral.report_id as "reportId",
      ral.user_id as "userId",
      u.first_name || ' ' || u.last_name as "userName",
      u.email as "userEmail",
      ral.added_by as "addedBy",
      au.first_name || ' ' || au.last_name as "addedByName",
      ral.created_at as "createdAt"
    FROM report_access_list ral
    LEFT JOIN users u ON ral.user_id = u.id
    LEFT JOIN users au ON ral.added_by = au.id
    WHERE ral.tenant_id = $1 AND ral.report_id = $2
    ORDER BY ral.created_at DESC`,
    [tenantId, reportId],
  );

  return result.rows;
}

/**
 * Get all reports a user has access to (as an employee)
 */
export async function getUserAccessibleReports(
  tenantId: string,
  userId: string,
): Promise<string[]> {
  const result = await query<{ report_id: string }>(
    `SELECT DISTINCT report_id FROM report_access_list
    WHERE tenant_id = $1 AND user_id = $2`,
    [tenantId, userId],
  );

  return result.rows.map((row) => row.report_id);
}

/**
 * Check if user can be mentioned in report comments
 * Can be mentioned if:
 * - User is manager or admin (always)
 * - User is in the report access list (for employees)
 */
export async function canBeMentioned(
  tenantId: string,
  reportId: string,
  userId: string,
  userRole: string,
): Promise<boolean> {
  // Managers and admins can always be mentioned
  if (userRole === "manager" || userRole === "admin") {
    return true;
  }

  // For employees, check if they're in the access list
  const result = await query<{ exists: boolean }>(
    `SELECT EXISTS(
      SELECT 1 FROM report_access_list
      WHERE tenant_id = $1 AND report_id = $2 AND user_id = $3
    ) as exists`,
    [tenantId, reportId, userId],
  );

  return Boolean(result.rows[0]?.exists);
}
