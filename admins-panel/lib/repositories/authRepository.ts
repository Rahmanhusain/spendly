import bcrypt from "bcrypt";
import { query, transaction } from "../db/client";
import crypto from "crypto";

export interface TenantRecord {
  id: string;
  name: string;
  slug: string;
  plan: "trial";
  trial_ends_at: string | null;
  status: "active" | "inactive" | "suspended";
  country_code: string;
  gstin: string | null;
  company_address: string | null;
  receipt_quota_monthly: number;
  created_at: string;
  updated_at: string;
}

export interface UserRecord {
  id: string;
  tenant_id: string;
  email: string;
  password_hash: string;
  first_name: string | null;
  last_name: string | null;
  role: "employee" | "manager" | "admin";
  status: "active" | "inactive" | "suspended";
  timezone: string;
  email_summary_enabled: boolean;
  can_export_gst: boolean;
  created_at: string;
  updated_at: string;
}

export interface SessionRecord {
  id: string;
  tenant_id: string;
  user_id: string;
  refresh_token_hash: string;
  expires_at: string;
  revoked_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export async function getTenantById(
  tenantId: string,
): Promise<TenantRecord | null> {
  const result = await query<TenantRecord>(
    "SELECT * FROM tenants WHERE id = $1",
    [tenantId],
  );

  return result.rows.length > 0 ? result.rows[0] : null;
}

export async function getUsersByTenant(
  tenantId: string,
): Promise<UserRecord[]> {
  const result = await query<UserRecord>(
    `SELECT * FROM users
     WHERE tenant_id = $1
     ORDER BY created_at DESC`,
    [tenantId],
  );

  return result.rows;
}

export async function getValidSession(
  sessionId: string,
): Promise<SessionRecord | null> {
  const result = await query<SessionRecord>(
    `SELECT * FROM user_sessions 
     WHERE id = $1 AND revoked_at IS NULL AND expires_at > NOW()`,
    [sessionId],
  );

  return result.rows.length > 0 ? result.rows[0] : null;
}

export async function createTenantAccount(
  tenantData: {
    name: string;
    slug: string;
    plan: "trial";
    country_code: string;
    gstin?: string;
    company_address?: string;
  },
  userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    timezone: string;
  },
  sessionData: {
    refreshTokenHash: string;
    expiresAt: string;
  },
): Promise<{
  tenant: TenantRecord;
  user: UserRecord;
  session: SessionRecord;
}> {
  return transaction(async (client) => {
    const slugCheck = await client.query(
      "SELECT id FROM tenants WHERE slug = $1",
      [tenantData.slug.toLowerCase()],
    );

    if (slugCheck.rows.length > 0) {
      throw new Error("A workspace with this slug already exists.");
    }

    const emailCheck = await client.query(
      "SELECT id FROM users WHERE email = $1",
      [userData.email.toLowerCase()],
    );

    if (emailCheck.rows.length > 0) {
      throw new Error("An account with this email already exists.");
    }

    const tenantId = crypto.randomUUID();
    const quotaMonthly = 999999;

    const tenantResult = await client.query<TenantRecord>(
      `INSERT INTO tenants (id, name, slug, plan, trial_ends_at, status, country_code, gstin, company_address, receipt_quota_monthly, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '15 days', $5, $6, $7, $8, $9, NOW(), NOW())
       RETURNING *`,
      [
        tenantId,
        tenantData.name,
        tenantData.slug.toLowerCase(),
        tenantData.plan,
        "active",
        tenantData.country_code.toUpperCase(),
        tenantData.gstin || null,
        tenantData.company_address || null,
        quotaMonthly,
      ],
    );

    const tenant = tenantResult.rows[0];
    const passwordHash = await bcrypt.hash(userData.password, 12);

    const userId = crypto.randomUUID();
    const userResult = await client.query<UserRecord>(
      `INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name, role, status, timezone, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       RETURNING *`,
      [
        userId,
        tenantId,
        userData.email.toLowerCase(),
        passwordHash,
        userData.firstName,
        userData.lastName,
        "admin",
        "active",
        userData.timezone,
      ],
    );

    const user = userResult.rows[0];

    const sessionId = crypto.randomUUID();
    const sessionResult = await client.query<SessionRecord>(
      `INSERT INTO user_sessions (id, tenant_id, user_id, refresh_token_hash, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [
        sessionId,
        tenantId,
        userId,
        sessionData.refreshTokenHash,
        sessionData.expiresAt,
      ],
    );

    const session = sessionResult.rows[0];

    return { tenant, user, session };
  });
}

export async function getUserByEmailAndVerifyPassword(
  email: string,
  password: string,
): Promise<{ user: UserRecord; tenant: TenantRecord } | null> {
  const result = await query<{
    id: string;
    tenant_id: string;
    email: string;
    password_hash: string;
    first_name: string | null;
    last_name: string | null;
    role: "employee" | "manager" | "admin";
    status: "active" | "inactive" | "suspended";
    timezone: string;
    can_export_gst: boolean;
    email_summary_enabled: boolean;
    created_at: string;
    updated_at: string;
    tenant_id_fk: string;
    tenant_name: string;
    tenant_slug: string;
    tenant_plan: "trial";
    tenant_trial_ends_at: string | null;
    tenant_status: "active" | "inactive" | "suspended";
    tenant_country_code: string;
    tenant_gstin: string | null;
    tenant_company_address: string | null;
    tenant_receipt_quota_monthly: number;
    tenant_created_at: string;
    tenant_updated_at: string;
  }>(
    `SELECT u.*, 
            t.id as tenant_id_fk, t.name as tenant_name, t.slug as tenant_slug, 
          t.plan as tenant_plan, t.trial_ends_at as tenant_trial_ends_at,
          t.status as tenant_status, t.country_code as tenant_country_code,
            t.gstin as tenant_gstin, t.company_address as tenant_company_address, 
            t.receipt_quota_monthly as tenant_receipt_quota_monthly, t.created_at as tenant_created_at, 
            t.updated_at as tenant_updated_at
     FROM users u
     JOIN tenants t ON u.tenant_id = t.id
     WHERE u.email = $1 AND u.status = 'active'`,
    [email.toLowerCase()],
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  const passwordMatches = await bcrypt.compare(password, row.password_hash);

  if (!passwordMatches) {
    return null;
  }

  const user: UserRecord = {
    id: row.id,
    tenant_id: row.tenant_id,
    email: row.email,
    password_hash: row.password_hash,
    first_name: row.first_name,
    last_name: row.last_name,
    role: row.role,
    status: row.status,
    timezone: row.timezone,
    can_export_gst: row.can_export_gst,
    email_summary_enabled: row.email_summary_enabled,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };

  const tenant: TenantRecord = {
    id: row.tenant_id_fk,
    name: row.tenant_name,
    slug: row.tenant_slug,
    plan: row.tenant_plan,
    trial_ends_at: row.tenant_trial_ends_at,
    status: row.tenant_status,
    country_code: row.tenant_country_code,
    gstin: row.tenant_gstin,
    company_address: row.tenant_company_address,
    receipt_quota_monthly: row.tenant_receipt_quota_monthly,
    created_at: row.tenant_created_at,
    updated_at: row.tenant_updated_at,
  };

  return { user, tenant };
}
