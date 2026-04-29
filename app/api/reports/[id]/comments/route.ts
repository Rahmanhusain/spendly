import { NextRequest, NextResponse } from "next/server";
import { extractAuthContext } from "@/lib/middleware/auth";
import {
  createReportComment,
  getReportComments,
  deleteReportComment,
  getMentionedUsers,
} from "@/lib/repositories/reportCommentsRepository";
import { createAuditLog } from "@/lib/repositories/auditRepository";
import { getReportById } from "@/lib/repositories/reportRepository";
import {
  hasReportAccess,
  canBeMentioned,
} from "@/lib/repositories/reportAccessRepository";
import { sendNotification } from "@/lib/utils/notifications";
import { randomUUID } from "crypto";

/**
 * GET /api/reports/[id]/comments
 * List all comments for a report
 */
async function handleGet(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authContext = await extractAuthContext(req, randomUUID());
  if (!authContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: reportId } = await params;

  try {
    const report = await getReportById(authContext.tenantId, reportId);
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Check access control for employees
    const hasAccess = await hasReportAccess(
      authContext.tenantId,
      reportId,
      authContext.userId,
      authContext.role,
    );

    if (!hasAccess) {
      return NextResponse.json(
        { error: "You do not have access to this report" },
        { status: 403 },
      );
    }

    const comments = await getReportComments(authContext.tenantId, reportId);

    return NextResponse.json({
      ok: true,
      data: { comments },
    });
  } catch (error) {
    console.error("Failed to fetch comments:", error);
    return NextResponse.json(
      { error: "Failed to fetch comments" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/reports/[id]/comments
 * Add a comment to a report
 */
async function handlePost(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authContext = await extractAuthContext(req, randomUUID());
  if (!authContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: reportId } = await params;

  try {
    const body = await req.json();
    const { message, parentCommentId, mentionedUserIds } = body;

    if (
      !message ||
      typeof message !== "string" ||
      message.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 },
      );
    }

    const report = await getReportById(authContext.tenantId, reportId);
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Check access control for employees
    const hasAccess = await hasReportAccess(
      authContext.tenantId,
      reportId,
      authContext.userId,
      authContext.role,
    );

    if (!hasAccess) {
      return NextResponse.json(
        { error: "You do not have access to this report" },
        { status: 403 },
      );
    }

    // Validate mentioned users - they must be mentionable
    if (mentionedUserIds && mentionedUserIds.length > 0) {
      const mentionPromises = mentionedUserIds.map((userId: string) =>
        canBeMentioned(
          authContext.tenantId,
          reportId,
          userId,
          "employee", // Check assuming they're employee; actual role will be checked
        ).then(async (canMention) => {
          if (!canMention) {
            // Get user details to provide better error message
            return { userId, canMention: false };
          }
          return { userId, canMention: true };
        }),
      );

      const mentionResults = await Promise.all(mentionPromises);
      const failedMentions = mentionResults.filter((m) => !m.canMention);

      if (failedMentions.length > 0) {
        return NextResponse.json(
          {
            error: `Cannot mention ${failedMentions.length} user(s). They must be added to the report access list first.`,
            failedUserIds: failedMentions.map((m) => m.userId),
          },
          { status: 400 },
        );
      }
    }

    // Create comment
    const comment = await createReportComment(
      authContext.tenantId,
      reportId,
      authContext.userId,
      {
        message: message.trim(),
        parentCommentId: parentCommentId || null,
        mentionedUserIds: mentionedUserIds || [],
      },
    );

    // Log audit event
    await createAuditLog(authContext.tenantId, {
      userId: authContext.userId,
      action: "comment_added",
      resourceType: "expense_report",
      resourceId: reportId,
      details: {
        commentId: comment.id,
        mentionedUsers: mentionedUserIds?.length || 0,
      },
    });

    // Send notifications to mentioned users
    if (mentionedUserIds && mentionedUserIds.length > 0) {
      const mentionedUsers = await getMentionedUsers(
        authContext.tenantId,
        mentionedUserIds,
      );

      for (const user of mentionedUsers) {
        await sendNotification({
          tenantId: authContext.tenantId,
          userId: user.id,
          channel: "in_app",
          title: `New mention in report comment`,
          message: message.substring(0, 100),
          // Link the mention notification to the underlying expense report,
          // so the mentioned user can open the report workspace immediately.
          relatedType: "expense_report",
          relatedId: reportId,
        });
      }
    }

    // Notify report owner and approver if different from commenter
    if (report.userId !== authContext.userId) {
      await sendNotification({
        tenantId: authContext.tenantId,
        userId: report.userId,
        channel: "in_app",
        title: `New comment on your report "${report.title}"`,
        message: message.substring(0, 100),
        relatedType: "expense_report",
        relatedId: reportId,
      });
    }

    return NextResponse.json({
      ok: true,
      data: { comment },
    });
  } catch (error) {
    console.error("Failed to create comment:", error);
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/reports/[id]/comments/[commentId]
 * Delete a comment
 */
async function handleDelete(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authContext = await extractAuthContext(req, randomUUID());
  if (!authContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: reportId } = await params;
  const url = new URL(req.url);
  const commentId = url.pathname.split("/").pop();

  if (!commentId) {
    return NextResponse.json(
      { error: "Comment ID is required" },
      { status: 400 },
    );
  }

  try {
    const report = await getReportById(authContext.tenantId, reportId);
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Check access control for employees
    const hasAccess = await hasReportAccess(
      authContext.tenantId,
      reportId,
      authContext.userId,
      authContext.role,
    );

    if (!hasAccess) {
      return NextResponse.json(
        { error: "You do not have access to this report" },
        { status: 403 },
      );
    }

    const deleted = await deleteReportComment(
      authContext.tenantId,
      commentId,
      authContext.userId,
    );

    if (!deleted) {
      return NextResponse.json(
        { error: "Comment not found or unauthorized" },
        { status: 404 },
      );
    }

    // Log audit event
    await createAuditLog(authContext.tenantId, {
      userId: authContext.userId,
      action: "comment_deleted",
      resourceType: "expense_report",
      resourceId: reportId,
      details: { commentId },
    });

    return NextResponse.json({
      ok: true,
      message: "Comment deleted",
    });
  } catch (error) {
    console.error("Failed to delete comment:", error);
    return NextResponse.json(
      { error: "Failed to delete comment" },
      { status: 500 },
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleGet(req, { params });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handlePost(req, { params });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleDelete(req, { params });
}
