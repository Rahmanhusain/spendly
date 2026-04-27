import { query } from "@/lib/db/client";

export type ApprovalWorkflow = {
  id: string;
  tenantId: string;
  reportId: string;
  currentLevel: number;
  totalLevels: number;
  approverId: string | null;
  status: "submitted" | "approved" | "rejected" | "info_requested";
  comments: string | null;
  actedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Create approval workflow for a report
 */
export async function createApprovalWorkflow(
  tenantId: string,
  reportId: string,
): Promise<ApprovalWorkflow> {
  const result = await query<ApprovalWorkflow>(
    `INSERT INTO approval_workflows (
      tenant_id, report_id, current_level, total_levels, status
    ) VALUES ($1, $2, $3, $4, $5)
    RETURNING 
      id, tenant_id as "tenantId", report_id as "reportId",
      current_level as "currentLevel", total_levels as "totalLevels",
      approver_id as "approverId", status, comments,
      acted_at as "actedAt", created_at as "createdAt",
      updated_at as "updatedAt"`,
    [tenantId, reportId, 1, 1, "submitted"],
  );

  if (result.rows.length === 0) {
    throw new Error("Failed to create approval workflow");
  }

  return result.rows[0];
}

/**
 * Get approval workflow by ID
 */
export async function getApprovalWorkflowById(
  tenantId: string,
  approvalId: string,
): Promise<ApprovalWorkflow | null> {
  const result = await query<ApprovalWorkflow>(
    `SELECT 
      id, tenant_id as "tenantId", report_id as "reportId",
      current_level as "currentLevel", total_levels as "totalLevels",
      approver_id as "approverId", status, comments,
      acted_at as "actedAt", created_at as "createdAt",
      updated_at as "updatedAt"
    FROM approval_workflows
    WHERE id = $1 AND tenant_id = $2`,
    [approvalId, tenantId],
  );

  return result.rows[0] || null;
}

/**
 * Get approval workflow for a report
 */
export async function getApprovalWorkflow(
  tenantId: string,
  reportId: string,
): Promise<ApprovalWorkflow | null> {
  const result = await query<ApprovalWorkflow>(
    `SELECT 
      id, tenant_id as "tenantId", report_id as "reportId",
      current_level as "currentLevel", total_levels as "totalLevels",
      approver_id as "approverId", status, comments,
      acted_at as "actedAt", created_at as "createdAt",
      updated_at as "updatedAt"
    FROM approval_workflows
    WHERE report_id = $1 AND tenant_id = $2
    ORDER BY created_at DESC LIMIT 1`,
    [reportId, tenantId],
  );

  return result.rows[0] || null;
}

/**
 * Get pending approvals for a manager/admin
 */
export async function getPendingApprovalsForUser(
  tenantId: string,
  userId: string,
  limit = 25,
  offset = 0,
): Promise<{ approvals: ApprovalWorkflow[]; total: number }> {
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM approval_workflows aw
    WHERE aw.tenant_id = $1 AND aw.status = 'submitted'`,
    [tenantId],
  );

  const listResult = await query<ApprovalWorkflow>(
    `SELECT 
      aw.id, aw.tenant_id as "tenantId", aw.report_id as "reportId",
      aw.current_level as "currentLevel", aw.total_levels as "totalLevels",
      aw.approver_id as "approverId", aw.status, aw.comments,
      aw.acted_at as "actedAt", aw.created_at as "createdAt",
      aw.updated_at as "updatedAt"
    FROM approval_workflows aw
    WHERE aw.tenant_id = $1 AND aw.status = 'submitted'
    ORDER BY aw.created_at DESC
    LIMIT $2 OFFSET $3`,
    [tenantId, limit, offset],
  );

  return {
    approvals: listResult.rows,
    total: parseInt(countResult.rows[0].count, 10),
  };
}

/**
 * Approve a report
 */
export async function approveApprovalWorkflow(
  tenantId: string,
  approvalId: string,
  approverId: string,
  comments?: string,
): Promise<ApprovalWorkflow> {
  const result = await query<ApprovalWorkflow>(
    `UPDATE approval_workflows 
    SET status = $1, approver_id = $2, comments = $3, acted_at = NOW()
    WHERE id = $4 AND tenant_id = $5
    RETURNING 
      id, tenant_id as "tenantId", report_id as "reportId",
      current_level as "currentLevel", total_levels as "totalLevels",
      approver_id as "approverId", status, comments,
      acted_at as "actedAt", created_at as "createdAt",
      updated_at as "updatedAt"`,
    ["approved", approverId, comments || null, approvalId, tenantId],
  );

  if (result.rows.length === 0) {
    throw new Error("Approval workflow not found");
  }

  return result.rows[0];
}

/**
 * Reject a report
 */
export async function rejectApprovalWorkflow(
  tenantId: string,
  approvalId: string,
  approverId: string,
  comments?: string,
): Promise<ApprovalWorkflow> {
  const result = await query<ApprovalWorkflow>(
    `UPDATE approval_workflows 
    SET status = $1, approver_id = $2, comments = $3, acted_at = NOW()
    WHERE id = $4 AND tenant_id = $5
    RETURNING 
      id, tenant_id as "tenantId", report_id as "reportId",
      current_level as "currentLevel", total_levels as "totalLevels",
      approver_id as "approverId", status, comments,
      acted_at as "actedAt", created_at as "createdAt",
      updated_at as "updatedAt"`,
    ["rejected", approverId, comments || null, approvalId, tenantId],
  );

  if (result.rows.length === 0) {
    throw new Error("Approval workflow not found");
  }

  return result.rows[0];
}

/**
 * Request info on a report
 */
export async function requestInfoOnApproval(
  tenantId: string,
  approvalId: string,
  approverId: string,
  comments?: string,
): Promise<ApprovalWorkflow> {
  const result = await query<ApprovalWorkflow>(
    `UPDATE approval_workflows 
    SET status = $1, approver_id = $2, comments = $3, acted_at = NOW()
    WHERE id = $4 AND tenant_id = $5
    RETURNING 
      id, tenant_id as "tenantId", report_id as "reportId",
      current_level as "currentLevel", total_levels as "totalLevels",
      approver_id as "approverId", status, comments,
      acted_at as "actedAt", created_at as "createdAt",
      updated_at as "updatedAt"`,
    ["info_requested", approverId, comments || null, approvalId, tenantId],
  );

  if (result.rows.length === 0) {
    throw new Error("Approval workflow not found");
  }

  return result.rows[0];
}
