import { query, transaction } from "@/lib/db/client";

let mentionedUserIdsColumnAvailable: boolean | null = null;

async function isMentionedUserIdsColumnAvailable(): Promise<boolean> {
  if (mentionedUserIdsColumnAvailable !== null) {
    return mentionedUserIdsColumnAvailable;
  }

  const result = await query<{ exists: boolean }>(
    `SELECT EXISTS(
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'report_comments'
        AND column_name = 'mentioned_user_ids'
    ) as "exists"`,
  );

  mentionedUserIdsColumnAvailable = Boolean(result.rows[0]?.exists);
  return mentionedUserIdsColumnAvailable;
}

export type ReportComment = {
  id: string;
  tenantId: string;
  reportId: string;
  authorUserId: string;
  authorName?: string | null;
  authorRole?: string | null;
  message: string;
  parentCommentId: string | null;
  isResolved: boolean;
  mentionedUserIds?: string[] | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateCommentInput = {
  message: string;
  parentCommentId?: string | null;
  mentionedUserIds?: string[];
};

/**
 * Create a new comment on a report
 */
export async function createReportComment(
  tenantId: string,
  reportId: string,
  userId: string,
  input: CreateCommentInput,
): Promise<ReportComment> {
  const hasMentions = await isMentionedUserIdsColumnAvailable();

  const result = hasMentions
    ? await query<ReportComment>(
        `WITH inserted AS (
          INSERT INTO report_comments (
            tenant_id, report_id, author_user_id, message,
            parent_comment_id, mentioned_user_ids
          ) VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING
            id, tenant_id as "tenantId", report_id as "reportId",
            author_user_id as "authorUserId", message,
            parent_comment_id as "parentCommentId",
            is_resolved as "isResolved",
            mentioned_user_ids as "mentionedUserIds",
            created_at as "createdAt", updated_at as "updatedAt"
        )
        SELECT
          i.*,
          COALESCE(
            NULLIF(BTRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''),
            u.email
          ) as "authorName",
          u.role as "authorRole"
        FROM inserted i
        JOIN users u ON u.id = i."authorUserId"`,
        [
          tenantId,
          reportId,
          userId,
          input.message,
          input.parentCommentId || null,
          input.mentionedUserIds
            ? JSON.stringify(input.mentionedUserIds)
            : null,
        ],
      )
    : await query<ReportComment>(
        `WITH inserted AS (
          INSERT INTO report_comments (
            tenant_id, report_id, author_user_id, message,
            parent_comment_id
          ) VALUES ($1, $2, $3, $4, $5)
          RETURNING
            id, tenant_id as "tenantId", report_id as "reportId",
            author_user_id as "authorUserId", message,
            parent_comment_id as "parentCommentId",
            is_resolved as "isResolved",
            NULL as "mentionedUserIds",
            created_at as "createdAt", updated_at as "updatedAt"
        )
        SELECT
          i.*,
          COALESCE(
            NULLIF(BTRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''),
            u.email
          ) as "authorName",
          u.role as "authorRole"
        FROM inserted i
        JOIN users u ON u.id = i."authorUserId"`,
        [
          tenantId,
          reportId,
          userId,
          input.message,
          input.parentCommentId || null,
        ],
      );

  return result.rows[0];
}

/**
 * Get all comments for a report (with author details and threading)
 */
export async function getReportComments(
  tenantId: string,
  reportId: string,
): Promise<ReportComment[]> {
  const hasMentions = await isMentionedUserIdsColumnAvailable();

  const result = await query<ReportComment>(
    hasMentions
      ? `SELECT
          rc.id, rc.tenant_id as "tenantId", rc.report_id as "reportId",
          rc.author_user_id as "authorUserId",
          COALESCE(
            NULLIF(BTRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''),
            u.email
          ) as "authorName",
          u.role as "authorRole",
          rc.message, rc.parent_comment_id as "parentCommentId",
          rc.is_resolved as "isResolved",
          rc.mentioned_user_ids as "mentionedUserIds",
          rc.created_at as "createdAt", rc.updated_at as "updatedAt"
        FROM report_comments rc
        LEFT JOIN users u ON rc.author_user_id = u.id
        WHERE rc.tenant_id = $1 AND rc.report_id = $2
        ORDER BY rc.created_at ASC`
      : `SELECT
          rc.id, rc.tenant_id as "tenantId", rc.report_id as "reportId",
          rc.author_user_id as "authorUserId",
          COALESCE(
            NULLIF(BTRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''),
            u.email
          ) as "authorName",
          u.role as "authorRole",
          rc.message, rc.parent_comment_id as "parentCommentId",
          rc.is_resolved as "isResolved",
          NULL as "mentionedUserIds",
          rc.created_at as "createdAt", rc.updated_at as "updatedAt"
        FROM report_comments rc
        LEFT JOIN users u ON rc.author_user_id = u.id
        WHERE rc.tenant_id = $1 AND rc.report_id = $2
        ORDER BY rc.created_at ASC`,
    [tenantId, reportId],
  );

  return result.rows;
}

/**
 * Delete a comment
 */
export async function deleteReportComment(
  tenantId: string,
  commentId: string,
  userId: string,
): Promise<boolean> {
  const result = await query(
    `DELETE FROM report_comments 
    WHERE id = $1 AND tenant_id = $2 AND author_user_id = $3`,
    [commentId, tenantId, userId],
  );

  return (result.rowCount ?? 0) > 0;
}

/**
 * Mark comment as resolved
 */
export async function resolveReportComment(
  tenantId: string,
  commentId: string,
): Promise<boolean> {
  const result = await query(
    `UPDATE report_comments 
    SET is_resolved = true, updated_at = NOW()
    WHERE id = $1 AND tenant_id = $2`,
    [commentId, tenantId],
  );

  return (result.rowCount ?? 0) > 0;
}

/**
 * Get mentioned user details for notifications
 */
export async function getMentionedUsers(
  tenantId: string,
  mentionedUserIds: string[],
): Promise<Array<{ id: string; email: string; firstName: string }>> {
  if (mentionedUserIds.length === 0) {
    return [];
  }

  const result = await query<{ id: string; email: string; firstName: string }>(
    `SELECT id, email, first_name as "firstName"
    FROM users
    WHERE tenant_id = $1 AND id = ANY($2)`,
    [tenantId, mentionedUserIds],
  );

  return result.rows;
}
