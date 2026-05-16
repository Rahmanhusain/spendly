import crypto from "crypto";
import { query, transaction } from "@/lib/db/client";
import type { PoolClient, QueryResultRow } from "pg";
import bcrypt from "bcrypt";

export interface TeamRecord {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TeamMemberRecord {
  id: string;
  tenant_id: string;
  team_id: string;
  user_id: string;
  role: "employee" | "manager" | "admin";
  joined_at: string;
}

export interface TeamInviteRecord {
  id: string;
  tenant_id: string;
  email: string;
  role: "employee" | "manager" | "admin";
  token_hash: string;
  invited_by: string;
  accepted_by: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

/**
 * Create a new team
 */
export async function createTeam(
  tenantId: string,
  createdBy: string,
  name: string,
  description?: string,
): Promise<TeamRecord> {
  const teamId = crypto.randomUUID();

  const result = await query<TeamRecord>(
    `INSERT INTO teams (id, tenant_id, name, description, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
     RETURNING *`,
    [teamId, tenantId, name, description || null, createdBy],
  );

  return result.rows[0];
}

/**
 * Create a team invite with magic token
 */
export async function createTeamInvite(
  tenantId: string,
  invitedBy: string,
  email: string,
  role: "employee",
  expiryMs: number = 604800000, // 7 days default
): Promise<{
  invite: TeamInviteRecord;
  token: string;
}> {
  const inviteId = crypto.randomUUID();
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = await bcrypt.hash(token, 10);
  const expiresAt = new Date(Date.now() + expiryMs).toISOString();

  const result = await query<TeamInviteRecord>(
    `INSERT INTO team_invites (id, tenant_id, email, role, token_hash, invited_by, expires_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     RETURNING *`,
    [
      inviteId,
      tenantId,
      email.toLowerCase(),
      role,
      tokenHash,
      invitedBy,
      expiresAt,
    ],
  );

  return {
    invite: result.rows[0],
    token,
  };
}

/**
 * Find invite by ID and verify token
 */
export async function getInviteAndVerifyToken(
  inviteId: string,
  token: string,
): Promise<TeamInviteRecord | null> {
  const result = await query<TeamInviteRecord>(
    `SELECT * FROM team_invites 
     WHERE id = $1 AND expires_at > NOW() AND accepted_at IS NULL`,
    [inviteId],
  );

  if (result.rows.length === 0) {
    return null;
  }

  const invite = result.rows[0];
  const tokenMatches = await bcrypt.compare(token, invite.token_hash);

  if (!tokenMatches) {
    return null;
  }

  return invite;
}

/**
 * Accept a team invite and optionally create a new user
 */
export async function acceptTeamInvite(
  inviteId: string,
  userId: string,
  client?: PoolClient,
): Promise<TeamInviteRecord> {
  const executeQuery = <T extends QueryResultRow>(
    text: string,
    values?: unknown[],
  ) => (client ? client.query<T>(text, values) : query<T>(text, values));

  const result = await executeQuery<TeamInviteRecord>(
    `UPDATE team_invites 
     SET accepted_by = $1, accepted_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [userId, inviteId],
  );

  return result.rows[0];
}

/**
 * Add user to team
 */
export async function addUserToTeam(
  tenantId: string,
  teamId: string,
  userId: string,
  role: "employee" | "manager" | "admin",
  client?: PoolClient,
): Promise<TeamMemberRecord> {
  const executeQuery = <T extends QueryResultRow>(
    text: string,
    values?: unknown[],
  ) => (client ? client.query<T>(text, values) : query<T>(text, values));

  const memberId = crypto.randomUUID();

  const result = await executeQuery<TeamMemberRecord>(
    `INSERT INTO team_members (id, tenant_id, team_id, user_id, role, joined_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     RETURNING *`,
    [memberId, tenantId, teamId, userId, role],
  );

  return result.rows[0];
}

/**
 * Get all teams for a tenant
 */
export async function getTeamsByTenant(
  tenantId: string,
): Promise<TeamRecord[]> {
  const result = await query<TeamRecord>(
    `SELECT * FROM teams 
     WHERE tenant_id = $1 
     ORDER BY created_at DESC`,
    [tenantId],
  );

  return result.rows;
}

/**
 * Get team members
 */
export async function getTeamMembers(teamId: string): Promise<
  (TeamMemberRecord & {
    email: string;
    first_name: string | null;
    last_name: string | null;
  })[]
> {
  const result = await query<
    TeamMemberRecord & {
      email: string;
      first_name: string | null;
      last_name: string | null;
    }
  >(
    `SELECT tm.*, u.email, u.first_name, u.last_name
     FROM team_members tm
     JOIN users u ON tm.user_id = u.id
     WHERE tm.team_id = $1
     ORDER BY tm.joined_at DESC`,
    [teamId],
  );

  return result.rows;
}

/**
 * Get all workspace members for a tenant directly from the users table.
 * This includes every user who has joined the workspace (via invite or signup),
 * not just those assigned to a named team.
 */
export async function getTeamMembersByTenant(tenantId: string): Promise<
  {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    role: "employee" | "manager" | "admin";
    status: string;
    joined_at: string;
    can_export_gst: boolean;
  }[]
> {
  const result = await query<{
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    role: "employee" | "manager" | "admin";
    status: string;
    joined_at: string;
    can_export_gst: boolean;
  }>(
    `SELECT
       u.id,
       u.email,
       u.first_name,
       u.last_name,
       u.role,
       u.status,
       u.created_at AS joined_at,
       u.can_export_gst
     FROM users u
     WHERE u.tenant_id = $1
       AND u.status = 'active'
     ORDER BY u.created_at ASC`,
    [tenantId],
  );

  return result.rows;
}

/**
 * Update the can_export_gst permission flag for a workspace member.
 * Only admins and managers may call this.
 */
export async function setMemberGstExportPermission(
  tenantId: string,
  memberId: string,
  canExportGst: boolean,
): Promise<void> {
  await query(
    `UPDATE users
     SET can_export_gst = $1, updated_at = NOW()
     WHERE id = $2 AND tenant_id = $3`,
    [canExportGst, memberId, tenantId],
  );
}

/**
 * Get team invites for a tenant
 */
export async function getTeamInvites(
  tenantId: string,
): Promise<TeamInviteRecord[]> {
  const result = await query<TeamInviteRecord>(
    `SELECT * FROM team_invites 
     WHERE tenant_id = $1 AND accepted_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC`,
    [tenantId],
  );

  return result.rows;
}

/**
 * Get invite by ID
 */
export async function getInviteById(
  inviteId: string,
): Promise<TeamInviteRecord | null> {
  const result = await query<TeamInviteRecord>(
    `SELECT * FROM team_invites WHERE id = $1`,
    [inviteId],
  );

  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Create user as part of accepting team invite (in transaction).
 *
 * Handles three cases:
 * 1. Brand-new user — creates the user row and accepts the invite.
 * 2. Previously removed user (status = 'inactive') — reactivates them,
 *    updates their password/name if provided, and accepts the invite.
 * 3. Already-active user with the same email — accepts the invite so they
 *    can log in with their existing credentials (no password change needed).
 */
export async function createUserFromInvite(
  tenantId: string,
  email: string,
  firstName: string,
  lastName: string | null | undefined,
  password: string,
  timezone: string,
  role: "employee" | "manager" | "admin",
): Promise<{ userId: string; inviteId: string }> {
  return transaction(async (client) => {
    // Check if invite exists first
    const inviteCheck = await client.query<TeamInviteRecord>(
      `SELECT * FROM team_invites 
       WHERE tenant_id = $1 AND email = $2 AND accepted_at IS NULL AND expires_at > NOW()`,
      [tenantId, email.toLowerCase()],
    );

    if (inviteCheck.rows.length === 0) {
      throw new Error("No valid invite found for this email.");
    }

    const invite = inviteCheck.rows[0];

    // Check if a user with this email already exists in the tenant
    const userCheck = await client.query<{
      id: string;
      status: string;
    }>(
      "SELECT id, status FROM users WHERE email = $1 AND tenant_id = $2",
      [email.toLowerCase(), tenantId],
    );

    let userId: string;

    if (userCheck.rows.length === 0) {
      // ── Case 1: Brand-new user ──────────────────────────────────────────
      userId = crypto.randomUUID();
      const passwordHash = await bcrypt.hash(password, 12);

      await client.query(
        `INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name, role, status, timezone, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, NOW(), NOW())`,
        [
          userId,
          tenantId,
          email.toLowerCase(),
          passwordHash,
          firstName,
          lastName || null,
          role,
          timezone,
        ],
      );
    } else {
      const existing = userCheck.rows[0];
      userId = existing.id;

      if (existing.status === "inactive") {
        // ── Case 2: Previously removed — reactivate ─────────────────────
        const passwordHash = await bcrypt.hash(password, 12);

        await client.query(
          `UPDATE users
           SET status      = 'active',
               password_hash = $1,
               first_name  = $2,
               last_name   = $3,
               role        = $4,
               updated_at  = NOW()
           WHERE id = $5`,
          [
            passwordHash,
            firstName || null,
            lastName || null,
            role,
            userId,
          ],
        );

        // Revoke any stale sessions from before removal
        await client.query(
          `UPDATE user_sessions SET revoked_at = NOW()
           WHERE user_id = $1 AND revoked_at IS NULL`,
          [userId],
        );
      }
      // ── Case 3: Already active — just accept the invite below ──────────
      // No user-row changes needed; they'll log in with their existing password.
    }

    // Accept invite for all three cases
    await acceptTeamInvite(invite.id, userId, client);

    return { userId, inviteId: invite.id };
  });
}
