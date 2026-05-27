import bcrypt from "bcrypt";
import crypto from "crypto";
import { query } from "../db/client";

export interface SuperAdminRecord {
  id: string;
  email: string;
  name: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminSessionRecord {
  id: string;
  admin_id: string;
  refresh_token_hash: string;
  expires_at: string;
  revoked_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export type InquiryStatus = "new" | "in_review" | "reviewed" | "closed";
export type InquiryReason =
  | "complaint"
  | "suggestion"
  | "feedback"
  | "query"
  | "support"
  | "partnership";

export interface ContactInquiryRecord {
  id: string;
  sender_name: string;
  sender_email: string;
  reason: InquiryReason;
  subject: string;
  message: string;
  status: InquiryStatus;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InboundEmailRecord {
  id: string;
  resend_email_id: string | null;
  direction: "inbound" | "outbound";
  from_address: string;
  to_address: string;
  subject: string;
  text_body: string | null;
  html_body: string | null;
  raw_payload: Record<string, unknown> | null;
  is_read: boolean;
  read_at: string | null;
  read_by: string | null;
  created_at: string;
}

export interface RecentInquirySummary {
  id: string;
  sender_name: string;
  subject: string;
  reason: InquiryReason;
  status: InquiryStatus;
  created_at: string;
}

export interface DashboardStats {
  inquiries: {
    total: number;
    new: number;
  };
  emails: {
    total: number;
    unread: number;
  };
  tenants: {
    total: number;
    active: number;
  };
  users: {
    total: number;
    active: number;
  };
  recentInquiries: RecentInquirySummary[];
}

export async function getSuperAdminByEmail(
  email: string,
): Promise<(SuperAdminRecord & { password_hash: string }) | null> {
  const result = await query<SuperAdminRecord & { password_hash: string }>(
    `SELECT * FROM super_admins WHERE email = $1 AND is_active = TRUE`,
    [email.toLowerCase()],
  );
  return result.rows[0] ?? null;
}

export async function getSuperAdminById(
  id: string,
): Promise<SuperAdminRecord | null> {
  const result = await query<SuperAdminRecord>(
    `SELECT id, email, name, is_active, last_login_at, created_at, updated_at
     FROM super_admins WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function updateAdminLastLogin(id: string): Promise<void> {
  await query(`UPDATE super_admins SET last_login_at = NOW() WHERE id = $1`, [
    id,
  ]);
}

export async function createAdminSession(
  adminId: string,
  refreshTokenHash: string,
  expiresAt: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<AdminSessionRecord> {
  const sessionId = crypto.randomUUID();
  const result = await query<AdminSessionRecord>(
    `INSERT INTO admin_sessions
       (id, admin_id, refresh_token_hash, expires_at, ip_address, user_agent, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     RETURNING *`,
    [
      sessionId,
      adminId,
      refreshTokenHash,
      expiresAt,
      ipAddress ?? null,
      userAgent ?? null,
    ],
  );
  return result.rows[0];
}

export async function getValidAdminSession(
  sessionId: string,
): Promise<AdminSessionRecord | null> {
  const result = await query<AdminSessionRecord>(
    `SELECT * FROM admin_sessions
     WHERE id = $1 AND revoked_at IS NULL AND expires_at > NOW()`,
    [sessionId],
  );
  return result.rows[0] ?? null;
}

export async function revokeAdminSession(sessionId: string): Promise<void> {
  await query(`UPDATE admin_sessions SET revoked_at = NOW() WHERE id = $1`, [
    sessionId,
  ]);
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [inquiries, emails, tenants, users, recentInquiries] =
    await Promise.all([
      query<{ total: string; new_count: string }>(
        `SELECT COUNT(*)::text AS total,
              COUNT(*) FILTER (WHERE status = 'new')::text AS new_count
         FROM contact_inquiries`,
      ),
      query<{ total: string; unread: string }>(
        `SELECT COUNT(*)::text AS total,
              COUNT(*) FILTER (WHERE is_read = FALSE)::text AS unread
         FROM inbound_emails`,
      ),
      query<{ total: string; active_count: string }>(
        `SELECT COUNT(*)::text AS total,
              COUNT(*) FILTER (WHERE status = 'active')::text AS active_count
         FROM tenants`,
      ),
      query<{ total: string; active: string }>(
        `SELECT COUNT(*)::text AS total,
              COUNT(*) FILTER (WHERE status = 'active')::text AS active
         FROM users`,
      ),
      query<RecentInquirySummary>(
        `SELECT id, sender_name, subject, reason, status, created_at
         FROM contact_inquiries
         ORDER BY created_at DESC
         LIMIT 5`,
      ),
    ]);

  return {
    inquiries: {
      total: parseInt(inquiries.rows[0]?.total ?? "0", 10),
      new: parseInt(inquiries.rows[0]?.new_count ?? "0", 10),
    },
    emails: {
      total: parseInt(emails.rows[0]?.total ?? "0", 10),
      unread: parseInt(emails.rows[0]?.unread ?? "0", 10),
    },
    tenants: {
      total: parseInt(tenants.rows[0]?.total ?? "0", 10),
      active: parseInt(tenants.rows[0]?.active_count ?? "0", 10),
    },
    users: {
      total: parseInt(users.rows[0]?.total ?? "0", 10),
      active: parseInt(users.rows[0]?.active ?? "0", 10),
    },
    recentInquiries: recentInquiries.rows,
  };
}

export interface InquiryListOptions {
  status?: InquiryStatus;
  reason?: InquiryReason;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export async function listInquiries(opts: InquiryListOptions = {}): Promise<{
  rows: ContactInquiryRecord[];
  total: number;
}> {
  const limit = Math.min(opts.limit ?? 20, 100);
  const offset = opts.offset ?? 0;
  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (opts.status) {
    conditions.push(`status = $${idx++}`);
    values.push(opts.status);
  }
  if (opts.reason) {
    conditions.push(`reason = $${idx++}`);
    values.push(opts.reason);
  }
  if (opts.dateFrom) {
    conditions.push(`created_at >= $${idx++}`);
    values.push(opts.dateFrom);
  }
  if (opts.dateTo) {
    conditions.push(`created_at <= $${idx++}`);
    values.push(opts.dateTo);
  }
  if (opts.search) {
    conditions.push(
      `(id::text ILIKE $${idx} OR sender_email ILIKE $${idx} OR subject ILIKE $${idx})`,
    );
    values.push(`%${opts.search}%`);
    idx++;
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM contact_inquiries ${where}`,
    values,
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const rows = await query<ContactInquiryRecord>(
    `SELECT * FROM contact_inquiries ${where}
     ORDER BY created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...values, limit, offset],
  );

  return { rows: rows.rows, total };
}

export async function getInquiryById(
  id: string,
): Promise<ContactInquiryRecord | null> {
  const result = await query<ContactInquiryRecord>(
    `SELECT * FROM contact_inquiries WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function updateInquiryStatus(
  id: string,
  status: InquiryStatus,
  adminId: string,
  adminNotes?: string,
): Promise<ContactInquiryRecord | null> {
  const result = await query<ContactInquiryRecord>(
    `UPDATE contact_inquiries
     SET status = $1,
         admin_notes = COALESCE($2, admin_notes),
         reviewed_by = $3,
         reviewed_at = NOW(),
         updated_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [status, adminNotes ?? null, adminId, id],
  );
  return result.rows[0] ?? null;
}

export async function upsertInboundEmail(data: {
  resend_email_id?: string;
  direction?: "inbound" | "outbound";
  from_address: string;
  to_address: string;
  subject: string;
  text_body?: string;
  html_body?: string;
  raw_payload?: Record<string, unknown>;
}): Promise<InboundEmailRecord> {
  const id = crypto.randomUUID();
  const result = await query<InboundEmailRecord>(
    `INSERT INTO inbound_emails
       (id, resend_email_id, direction, from_address, to_address, subject,
        text_body, html_body, raw_payload, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
     ON CONFLICT (resend_email_id) DO NOTHING
     RETURNING *`,
    [
      id,
      data.resend_email_id ?? null,
      data.direction ?? "inbound",
      data.from_address,
      data.to_address,
      data.subject,
      data.text_body ?? null,
      data.html_body ?? null,
      data.raw_payload ? JSON.stringify(data.raw_payload) : null,
    ],
  );

  if (result.rows.length === 0 && data.resend_email_id) {
    const existing = await query<InboundEmailRecord>(
      `SELECT * FROM inbound_emails WHERE resend_email_id = $1`,
      [data.resend_email_id],
    );
    return existing.rows[0];
  }
  return result.rows[0];
}

export interface EmailListOptions {
  isRead?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function listInboundEmails(opts: EmailListOptions = {}): Promise<{
  rows: InboundEmailRecord[];
  total: number;
  unreadCount: number;
}> {
  const limit = Math.min(opts.limit ?? 20, 100);
  const offset = opts.offset ?? 0;
  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (opts.isRead !== undefined) {
    conditions.push(`is_read = $${idx++}`);
    values.push(opts.isRead);
  }
  if (opts.search) {
    conditions.push(`(from_address ILIKE $${idx} OR subject ILIKE $${idx})`);
    values.push(`%${opts.search}%`);
    idx++;
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const [countResult, unreadResult, rows] = await Promise.all([
    query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM inbound_emails ${where}`,
      values,
    ),
    query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM inbound_emails WHERE is_read = FALSE`,
      [],
    ),
    query<InboundEmailRecord>(
      `SELECT * FROM inbound_emails ${where}
       ORDER BY created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, limit, offset],
    ),
  ]);

  return {
    rows: rows.rows,
    total: parseInt(countResult.rows[0].count, 10),
    unreadCount: parseInt(unreadResult.rows[0].count, 10),
  };
}

export async function markEmailRead(
  id: string,
  adminId: string,
): Promise<void> {
  await query(
    `UPDATE inbound_emails
     SET is_read = TRUE, read_at = NOW(), read_by = $1
     WHERE id = $2 AND is_read = FALSE`,
    [adminId, id],
  );
}

export interface TenantWithStats {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  country_code: string;
  trial_ends_at: string | null;
  created_at: string;
  user_count: number;
  active_user_count: number;
}

export interface AdminUserRecord {
  id: string;
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  status: string;
  created_at: string;
}

export async function listTenants(opts: {
  search?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ rows: TenantWithStats[]; total: number }> {
  const limit = Math.min(opts.limit ?? 20, 100);
  const offset = opts.offset ?? 0;
  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (opts.status) {
    conditions.push(`t.status = $${idx++}`);
    values.push(opts.status);
  }
  if (opts.search) {
    conditions.push(`(t.name ILIKE $${idx} OR t.slug ILIKE $${idx})`);
    values.push(`%${opts.search}%`);
    idx++;
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM tenants t ${where}`,
    values,
  );

  const rows = await query<TenantWithStats>(
    `SELECT
       t.id, t.name, t.slug, t.plan, t.status, t.country_code,
       t.trial_ends_at, t.created_at,
       COUNT(u.id)::int AS user_count,
       COUNT(u.id) FILTER (WHERE u.status = 'active')::int AS active_user_count
     FROM tenants t
     LEFT JOIN users u ON u.tenant_id = t.id
     ${where}
     GROUP BY t.id
     ORDER BY t.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...values, limit, offset],
  );

  return { rows: rows.rows, total: parseInt(countResult.rows[0].count, 10) };
}

export async function listUsersForTenant(
  tenantId: string,
  opts: { search?: string; limit?: number; offset?: number },
): Promise<{ rows: AdminUserRecord[]; total: number }> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = opts.offset ?? 0;
  const conditions: string[] = ["u.tenant_id = $1"];
  const values: unknown[] = [tenantId];
  let idx = 2;

  if (opts.search) {
    conditions.push(
      `(u.email ILIKE $${idx} OR u.first_name ILIKE $${idx} OR u.last_name ILIKE $${idx})`,
    );
    values.push(`%${opts.search}%`);
    idx++;
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM users u ${where}`,
    values,
  );

  const rows = await query<AdminUserRecord>(
    `SELECT
       u.id, u.tenant_id, t.name AS tenant_name, t.slug AS tenant_slug,
       u.email, u.first_name, u.last_name, u.role, u.status, u.created_at
     FROM users u
     JOIN tenants t ON t.id = u.tenant_id
     ${where}
     ORDER BY u.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...values, limit, offset],
  );

  return { rows: rows.rows, total: parseInt(countResult.rows[0].count, 10) };
}

export async function setTenantStatus(
  tenantId: string,
  status: "active" | "inactive" | "suspended",
): Promise<void> {
  await query(
    `UPDATE tenants SET status = $1, updated_at = NOW() WHERE id = $2`,
    [status, tenantId],
  );
  if (status !== "active") {
    await query(
      `UPDATE user_sessions
       SET revoked_at = NOW()
       WHERE tenant_id = $1 AND revoked_at IS NULL`,
      [tenantId],
    );
  }
}

export async function setUserStatus(
  userId: string,
  status: "active" | "inactive" | "suspended",
): Promise<void> {
  await query(
    `UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2`,
    [status, userId],
  );
  if (status !== "active") {
    await query(
      `UPDATE user_sessions SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId],
    );
  }
}

export async function resetUserPassword(
  userId: string,
  newPassword: string,
): Promise<void> {
  const hash = await bcrypt.hash(newPassword, 12);
  await query(
    `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
    [hash, userId],
  );
  await query(
    `UPDATE user_sessions SET revoked_at = NOW()
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId],
  );
}
