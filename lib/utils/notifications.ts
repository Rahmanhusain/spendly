import { query } from "@/lib/db/client";

export type NotificationChannel = "in_app" | "email";

export interface SendNotificationInput {
  tenantId: string;
  userId: string;
  channel: NotificationChannel;
  title: string;
  message: string;
  relatedType?: string;
  relatedId?: string;
}

/**
 * Send a notification to a user
 */
export async function sendNotification(input: SendNotificationInput) {
  try {
    const result = await query(
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
        input.relatedType || null,
        input.relatedId || null,
      ],
    );

    return result.rows[0];
  } catch (error) {
    console.error("Failed to send notification:", error);
    throw error;
  }
}

/**
 * Get unread notifications for a user
 */
export async function getUnreadNotifications(tenantId: string, userId: string) {
  const result = await query(
    `SELECT 
      id, title, message, related_type as "relatedType",
      related_id as "relatedId", created_at as "createdAt"
    FROM notifications
    WHERE tenant_id = $1 AND user_id = $2 AND is_read = false
    ORDER BY created_at DESC
    LIMIT 50`,
    [tenantId, userId],
  );

  return result.rows;
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(
  tenantId: string,
  notificationId: string,
) {
  await query(
    `UPDATE notifications 
    SET is_read = true
    WHERE id = $1 AND tenant_id = $2`,
    [notificationId, tenantId],
  );
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(
  tenantId: string,
  userId: string,
) {
  await query(
    `UPDATE notifications 
    SET is_read = true
    WHERE tenant_id = $1 AND user_id = $2 AND is_read = false`,
    [tenantId, userId],
  );
}
