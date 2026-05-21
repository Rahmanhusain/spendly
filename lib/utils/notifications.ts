/**
 * notifications.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Central notification utility for Spendly.
 *
 * ALL in-app and email notification writes go through this file.
 * Do NOT write raw INSERT INTO notifications SQL in route handlers —
 * use the helpers exported here instead.
 *
 * Supported channels:
 *   • "in_app"  — stored in the notifications table, shown in the bell menu
 *   • "email"   — stored for audit + triggers sendEmail() best-effort
 *
 * Notification events (grouped by domain):
 *
 *   RECEIPTS
 *     notifyReceiptUploaded          → uploader self-confirm
 *     notifyManagersReceiptUploaded  → all managers/admins on new upload
 *     notifyReceiptReviewed          → employee when receipt approved/rejected
 *     notifyDuplicateReceiptDetected → employee when duplicate is flagged
 *     notifyPolicyViolationDetected  → employee when policy rule is broken
 *
 *   EXPENSE REPORTS
 *     notifyReportSubmitted          → all managers/admins when submitted
 *     notifyReportApproved           → employee when approved
 *     notifyReportRejected           → employee when rejected
 *     notifyReportInfoRequested      → employee when more info is needed
 *     notifyReportResubmitted        → manager who requested info when employee resubmits
 *     notifyReportPaid               → employee when reimbursement is processed
 *
 *   REPORT ACCESS
 *     notifyReportAccessGranted      → employee added to a report
 *     notifyReportAccessRevoked      → employee removed from a report
 *
 *   TEAM / INVITES
 *     notifyInviteSent               → invited person (email only)
 *     notifyInviteAccepted           → admin/manager who sent the invite
 *
 *   POLICIES
 *     notifyPolicyUpdated            → all active employees in the workspace
 *
 *   GST EXPORTS
 *     notifyGstExportCompleted       → user who triggered the export
 *
 * Low-level primitive:
 *     sendNotification               → raw insert, used by all helpers above
 *     sendNotificationSafe           → same but never throws (fire-and-forget)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { query } from "@/lib/db/client";
import { sendEmail } from "@/lib/utils/mailer";
import logger from "@/lib/utils/logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationChannel = "in_app" | "email";

export interface SendNotificationInput {
  tenantId: string;
  userId: string;
  channel: NotificationChannel;
  title: string;
  message: string;
  /** e.g. "receipt", "expense_report" */
  relatedType?: string;
  /** UUID of the related entity */
  relatedId?: string;
}

// ─── Low-level primitive ──────────────────────────────────────────────────────

/**
 * Insert a single notification row.
 * Throws on DB error — callers that want fire-and-forget should use
 * sendNotificationSafe() instead.
 */
export async function sendNotification(
  input: SendNotificationInput,
): Promise<{ id: string }> {
  const result = await query<{ id: string }>(
    `INSERT INTO notifications (
       tenant_id, user_id, channel, title, message,
       related_type, related_id, sent_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     RETURNING id`,
    [
      input.tenantId,
      input.userId,
      input.channel,
      input.title,
      input.message,
      input.relatedType ?? null,
      input.relatedId ?? null,
    ],
  );
  return result.rows[0];
}

/**
 * Fire-and-forget wrapper — logs errors but never throws.
 * Use this inside route handlers so a notification failure never
 * causes the main operation to fail.
 */
export async function sendNotificationSafe(
  input: SendNotificationInput,
  context?: string,
): Promise<void> {
  try {
    await sendNotification(input);
  } catch (err) {
    logger.error(
      `[notifications] sendNotificationSafe failed${context ? ` (${context})` : ""}`,
      {
        error: err instanceof Error ? err.message : String(err),
        userId: input.userId,
        title: input.title,
      },
    );
  }
}

// ─── Read helpers ─────────────────────────────────────────────────────────────

/** Fetch unread in-app notifications for a user (max 50). */
export async function getUnreadNotifications(tenantId: string, userId: string) {
  const result = await query(
    `SELECT
       id, title, message,
       related_type AS "relatedType",
       related_id   AS "relatedId",
       created_at   AS "createdAt"
     FROM notifications
     WHERE tenant_id = $1 AND user_id = $2
       AND channel = 'in_app' AND is_read = FALSE
     ORDER BY created_at DESC
     LIMIT 50`,
    [tenantId, userId],
  );
  return result.rows;
}

/** Mark a single notification as read. */
export async function markNotificationAsRead(
  tenantId: string,
  notificationId: string,
): Promise<void> {
  await query(
    `UPDATE notifications
     SET is_read = TRUE
     WHERE id = $1 AND tenant_id = $2`,
    [notificationId, tenantId],
  );
}

/** Mark all in-app notifications as read for a user. */
export async function markAllNotificationsAsRead(
  tenantId: string,
  userId: string,
): Promise<void> {
  await query(
    `UPDATE notifications
     SET is_read = TRUE
     WHERE tenant_id = $1 AND user_id = $2
       AND channel = 'in_app' AND is_read = FALSE`,
    [tenantId, userId],
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RECEIPT NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Notify the uploader that their receipt was saved successfully.
 * Sent immediately after a successful upload.
 */
export async function notifyReceiptUploaded(input: {
  tenantId: string;
  userId: string;
  receiptId: string;
  vendorName: string | null;
  amount: number;
  status: "draft" | "needs_review" | string;
}): Promise<void> {
  const statusMsg =
    input.status === "needs_review"
      ? "Needs review by a manager."
      : "Ready to add to a report.";

  await sendNotificationSafe(
    {
      tenantId: input.tenantId,
      userId: input.userId,
      channel: "in_app",
      title: "Receipt uploaded",
      message: `${input.vendorName || "Receipt"} (₹${input.amount.toFixed(2)}) — ${statusMsg}`,
      relatedType: "receipt",
      relatedId: input.receiptId,
    },
    "notifyReceiptUploaded",
  );
}

/**
 * Notify all managers/admins (except the uploader) about a new receipt.
 * Includes reasons if the receipt needs review (low confidence, policy
 * violation, or duplicate flag).
 */
export async function notifyManagersReceiptUploaded(input: {
  tenantId: string;
  uploaderId: string;
  uploaderName: string;
  receiptId: string;
  vendorName: string | null;
  amount: number;
  status: string;
  reasons: string[]; // e.g. ["Low confidence", "Policy violation"]
}): Promise<void> {
  // Fetch all managers and admins in the tenant (excluding the uploader)
  const result = await query<{ id: string }>(
    `SELECT id FROM users
     WHERE tenant_id = $1
       AND role IN ('manager', 'admin')
       AND status = 'active'
       AND id != $2`,
    [input.tenantId, input.uploaderId],
  );

  if (result.rows.length === 0) return;

  const title =
    input.status === "needs_review"
      ? "New receipt uploaded (needs review)"
      : "New receipt uploaded";

  const base = `${input.uploaderName || "A team member"} uploaded ${input.vendorName || "a receipt"} (₹${input.amount.toFixed(2)}).`;
  const message =
    input.reasons.length > 0
      ? `${base} ${input.reasons.join(", ")}.`
      : `${base} Ready for approval workflow.`;

  await Promise.all(
    result.rows.map((manager) =>
      sendNotificationSafe(
        {
          tenantId: input.tenantId,
          userId: manager.id,
          channel: "in_app",
          title,
          message,
          relatedType: "receipt",
          relatedId: input.receiptId,
        },
        "notifyManagersReceiptUploaded",
      ),
    ),
  );
}

/**
 * Notify the employee who uploaded a receipt when a manager approves or
 * rejects it.
 */
export async function notifyReceiptReviewed(input: {
  tenantId: string;
  ownerId: string;
  receiptId: string;
  vendorName: string | null;
  amount: number;
  decision: "approve" | "reject";
}): Promise<void> {
  const title =
    input.decision === "approve" ? "Receipt approved" : "Receipt rejected";
  const message =
    input.decision === "approve"
      ? `Your receipt from ${input.vendorName || "vendor"} (₹${input.amount}) has been approved.`
      : `Your receipt from ${input.vendorName || "vendor"} (₹${input.amount}) has been rejected and archived.`;

  await sendNotificationSafe(
    {
      tenantId: input.tenantId,
      userId: input.ownerId,
      channel: "in_app",
      title,
      message,
      relatedType: "receipt",
      relatedId: input.receiptId,
    },
    "notifyReceiptReviewed",
  );
}

/**
 * Warn the uploader that their receipt looks like a duplicate of an
 * existing one. Sent when the upload proceeds despite the duplicate flag
 * (i.e. allowDuplicate=true was passed).
 */
export async function notifyDuplicateReceiptDetected(input: {
  tenantId: string;
  userId: string;
  receiptId: string;
  vendorName: string | null;
  amount: number;
  duplicateOfId: string;
}): Promise<void> {
  await sendNotificationSafe(
    {
      tenantId: input.tenantId,
      userId: input.userId,
      channel: "in_app",
      title: "Duplicate receipt warning",
      message: `Your receipt from ${input.vendorName || "vendor"} (₹${input.amount.toFixed(2)}) was flagged as a potential duplicate. It has been saved but marked for review.`,
      relatedType: "receipt",
      relatedId: input.receiptId,
    },
    "notifyDuplicateReceiptDetected",
  );
}

/**
 * Warn the uploader that their receipt violates one or more expense
 * policy rules. Sent when the upload proceeds despite the policy flag
 * (i.e. allowPolicyOverride=true was passed).
 */
export async function notifyPolicyViolationDetected(input: {
  tenantId: string;
  userId: string;
  receiptId: string;
  vendorName: string | null;
  amount: number;
  reasons: string[];
}): Promise<void> {
  const reasonSummary = input.reasons.slice(0, 2).join("; ");

  await sendNotificationSafe(
    {
      tenantId: input.tenantId,
      userId: input.userId,
      channel: "in_app",
      title: "Policy violation on receipt",
      message: `Your receipt from ${input.vendorName || "vendor"} (₹${input.amount.toFixed(2)}) violates policy rules: ${reasonSummary}. It has been saved but marked for review.`,
      relatedType: "receipt",
      relatedId: input.receiptId,
    },
    "notifyPolicyViolationDetected",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPENSE REPORT NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Notify all managers/admins when an employee submits a report for review.
 * Also sends an email to each manager.
 *
 * When the report was previously in "info_requested" state, we additionally
 * notify the specific manager who requested the info (see notifyReportResubmitted).
 */
export async function notifyReportSubmitted(input: {
  tenantId: string;
  reportId: string;
  reportTitle: string;
  submitterId: string;
}): Promise<void> {
  const result = await query<{ id: string; email: string }>(
    `SELECT id::text AS id, email
     FROM users
     WHERE tenant_id = $1
       AND role IN ('manager', 'admin')
       AND status = 'active'`,
    [input.tenantId],
  );

  await Promise.all(
    result.rows.map(async (manager) => {
      await sendNotificationSafe(
        {
          tenantId: input.tenantId,
          userId: manager.id,
          channel: "in_app",
          title: `Report submitted: "${input.reportTitle}"`,
          message: "An expense report was submitted and needs review.",
          relatedType: "expense_report",
          relatedId: input.reportId,
        },
        "notifyReportSubmitted:in_app",
      );

      // Best-effort email
      if (manager.email) {
        try {
          await sendEmail({
            to: manager.email,
            subject: `Expense report submitted: ${input.reportTitle}`,
            text: `Your team has a new expense report awaiting approval: "${input.reportTitle}".`,
          });
        } catch (err) {
          logger.warn("[notifications] notifyReportSubmitted email failed", {
            error: err instanceof Error ? err.message : String(err),
            managerId: manager.id,
          });
        }
      }
    }),
  );
}

/**
 * Notify the employee who owns a report that it was approved.
 * Also sends a best-effort email.
 */
export async function notifyReportApproved(input: {
  tenantId: string;
  ownerId: string;
  ownerEmail: string | null;
  reportId: string;
  reportTitle: string;
}): Promise<void> {
  await sendNotificationSafe(
    {
      tenantId: input.tenantId,
      userId: input.ownerId,
      channel: "in_app",
      title: `Approved: "${input.reportTitle}"`,
      message: "Your expense report was approved by your manager.",
      relatedType: "expense_report",
      relatedId: input.reportId,
    },
    "notifyReportApproved:in_app",
  );

  if (input.ownerEmail) {
    try {
      await sendEmail({
        to: input.ownerEmail,
        subject: `Expense report approved: ${input.reportTitle}`,
        text: `Your expense report "${input.reportTitle}" has been approved.`,
      });
    } catch (err) {
      logger.warn("[notifications] notifyReportApproved email failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

/**
 * Notify the employee who owns a report that it was rejected.
 * Also sends a best-effort email.
 */
export async function notifyReportRejected(input: {
  tenantId: string;
  ownerId: string;
  ownerEmail: string | null;
  reportId: string;
  reportTitle: string;
  reason: string;
}): Promise<void> {
  await sendNotificationSafe(
    {
      tenantId: input.tenantId,
      userId: input.ownerId,
      channel: "in_app",
      title: `Rejected: "${input.reportTitle}"`,
      message: `Your expense report was rejected. Reason: ${input.reason.slice(0, 120)}`,
      relatedType: "expense_report",
      relatedId: input.reportId,
    },
    "notifyReportRejected:in_app",
  );

  if (input.ownerEmail) {
    try {
      await sendEmail({
        to: input.ownerEmail,
        subject: `Expense report rejected: ${input.reportTitle}`,
        text: `Your expense report "${input.reportTitle}" was rejected. Reason: ${input.reason}`,
      });
    } catch (err) {
      logger.warn("[notifications] notifyReportRejected email failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

/**
 * Notify the employee that a manager needs more information before
 * approving their report.
 */
export async function notifyReportInfoRequested(input: {
  tenantId: string;
  ownerId: string;
  reportId: string;
  reportTitle: string;
  reason: string;
}): Promise<void> {
  await sendNotificationSafe(
    {
      tenantId: input.tenantId,
      userId: input.ownerId,
      channel: "in_app",
      title: `Additional information requested for "${input.reportTitle}"`,
      message: input.reason.substring(0, 160),
      relatedType: "expense_report",
      relatedId: input.reportId,
    },
    "notifyReportInfoRequested",
  );
}

/**
 * Notify the manager who originally requested info that the employee has
 * resubmitted the report. Only fires when the previous status was
 * "info_requested" and the approver_id is known.
 */
export async function notifyReportResubmitted(input: {
  tenantId: string;
  /** The manager/admin who requested info — from approval_workflows.approver_id */
  requesterId: string;
  reportId: string;
  reportTitle: string;
  submitterName: string;
}): Promise<void> {
  await sendNotificationSafe(
    {
      tenantId: input.tenantId,
      userId: input.requesterId,
      channel: "in_app",
      title: `Report resubmitted: "${input.reportTitle}"`,
      message: `${input.submitterName || "The employee"} has resubmitted the report after your information request.`,
      relatedType: "expense_report",
      relatedId: input.reportId,
    },
    "notifyReportResubmitted",
  );
}

/**
 * Notify the employee that their report has been marked as paid and
 * reimbursement has been processed.
 */
export async function notifyReportPaid(input: {
  tenantId: string;
  ownerId: string;
  reportId: string;
  reportTitle: string;
  totalAmount: number;
  method: string;
}): Promise<void> {
  await sendNotificationSafe(
    {
      tenantId: input.tenantId,
      userId: input.ownerId,
      channel: "in_app",
      title: `Your expense report "${input.reportTitle}" has been paid`,
      message: `Reimbursement of ₹${input.totalAmount} via ${input.method.toUpperCase()} has been processed.`,
      relatedType: "expense_report",
      relatedId: input.reportId,
    },
    "notifyReportPaid",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORT ACCESS NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Notify an employee that they have been granted access to a report
 * (can now view comments and be mentioned).
 */
export async function notifyReportAccessGranted(input: {
  tenantId: string;
  userId: string;
  reportId: string;
  reportTitle: string;
}): Promise<void> {
  await sendNotificationSafe(
    {
      tenantId: input.tenantId,
      userId: input.userId,
      channel: "in_app",
      title: `You were added to "${input.reportTitle}"`,
      message:
        "You can now view comments and be mentioned in this expense report.",
      relatedType: "expense_report",
      relatedId: input.reportId,
    },
    "notifyReportAccessGranted",
  );
}

/**
 * Notify an employee that their access to a report has been revoked.
 */
export async function notifyReportAccessRevoked(input: {
  tenantId: string;
  userId: string;
  reportId: string;
  reportTitle: string;
}): Promise<void> {
  await sendNotificationSafe(
    {
      tenantId: input.tenantId,
      userId: input.userId,
      channel: "in_app",
      title: `Your access to "${input.reportTitle}" was removed`,
      message:
        "You no longer have access to view or be mentioned in this expense report.",
      relatedType: "expense_report",
      relatedId: input.reportId,
    },
    "notifyReportAccessRevoked",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TEAM / INVITE NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send an invite email to the invited person.
 * This is email-only — the invitee has no account yet so there is no
 * in_app row to write.
 */
export async function notifyInviteSent(input: {
  toEmail: string;
  inviteLink: string;
  orgName: string;
  inviterName: string;
}): Promise<void> {
  try {
    await sendEmail({
      to: input.toEmail,
      subject: `You've been invited to join ${input.orgName} on Spendly`,
      templateName: "invite",
      templateData: {
        inviteLink: input.inviteLink,
        orgName: input.orgName,
        inviterName: input.inviterName || "A workspace admin",
        expiryDays: 7,
      },
      // plaintext fallback for simple clients
      text: [
        `Hi,`,
        ``,
        `${input.inviterName || "A workspace admin"} has invited you to join ${input.orgName} on Spendly.`,
        ``,
        `Click the link below to accept your invitation:`,
        input.inviteLink,
        ``,
        `This link expires in 7 days.`,
        ``,
        `— The Spendly team`,
      ].join("\n"),
    });
  } catch (err) {
    logger.warn("[notifications] notifyInviteSent email failed", {
      error: err instanceof Error ? err.message : String(err),
      toEmail: input.toEmail,
    });
  }
}

/**
 * Notify the admin/manager who sent an invite that it has been accepted.
 */
export async function notifyInviteAccepted(input: {
  tenantId: string;
  inviterId: string;
  acceptedByEmail: string;
  acceptedByName: string;
}): Promise<void> {
  await sendNotificationSafe(
    {
      tenantId: input.tenantId,
      userId: input.inviterId,
      channel: "in_app",
      title: "Invite accepted",
      message: `${input.acceptedByName || input.acceptedByEmail} has accepted your invitation and joined the workspace.`,
      relatedType: "team",
      relatedId: undefined,
    },
    "notifyInviteAccepted",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// POLICY NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Notify all active employees in the workspace that the expense policy
 * has been created or updated. Managers/admins are excluded since they
 * made the change.
 */
export async function notifyPolicyUpdated(input: {
  tenantId: string;
  updatedById: string;
  policyName: string;
  isNew: boolean;
}): Promise<void> {
  const result = await query<{ id: string }>(
    `SELECT id FROM users
     WHERE tenant_id = $1
       AND role = 'employee'
       AND status = 'active'`,
    [input.tenantId],
  );

  if (result.rows.length === 0) return;

  const title = input.isNew
    ? "New expense policy published"
    : "Expense policy updated";
  const message = input.isNew
    ? `A new expense policy "${input.policyName}" is now active. Review the rules before submitting receipts.`
    : `The expense policy "${input.policyName}" has been updated. Review the new rules before submitting receipts.`;

  await Promise.all(
    result.rows.map((employee) =>
      sendNotificationSafe(
        {
          tenantId: input.tenantId,
          userId: employee.id,
          channel: "in_app",
          title,
          message,
          relatedType: "policy",
          relatedId: undefined,
        },
        "notifyPolicyUpdated",
      ),
    ),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GST EXPORT NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Notify the user who triggered a GST export that it completed successfully.
 */
export async function notifyGstExportCompleted(input: {
  tenantId: string;
  userId: string;
  periodStart: string;
  periodEnd: string;
  format: string;
  receiptCount: number;
}): Promise<void> {
  await sendNotificationSafe(
    {
      tenantId: input.tenantId,
      userId: input.userId,
      channel: "in_app",
      title: "GST export completed",
      message: `Your ${input.format.toUpperCase()} export for ${input.periodStart} → ${input.periodEnd} is ready (${input.receiptCount} receipts).`,
      relatedType: "gst_export",
      relatedId: undefined,
    },
    "notifyGstExportCompleted",
  );
}
