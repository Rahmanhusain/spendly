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
  role: "employee" | "manager" | "admin",
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
 * Create user as part of accepting team invite (in transaction)
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
    // Check if user already exists
    const userCheck = await client.query(
      "SELECT id FROM users WHERE email = $1 AND tenant_id = $2",
      [email.toLowerCase(), tenantId],
    );

    if (userCheck.rows.length > 0) {
      throw new Error(
        "A user with this email already exists in this workspace.",
      );
    }

    // Check if invite exists
    const inviteCheck = await client.query<TeamInviteRecord>(
      `SELECT * FROM team_invites 
       WHERE tenant_id = $1 AND email = $2 AND accepted_at IS NULL AND expires_at > NOW()`,
      [tenantId, email.toLowerCase()],
    );

    if (inviteCheck.rows.length === 0) {
      throw new Error("No valid invite found for this email.");
    }

    const invite = inviteCheck.rows[0];

    // Create user
    const userId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 12);

    await client.query(
      `INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name, role, status, timezone, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
      [
        userId,
        tenantId,
        email.toLowerCase(),
        passwordHash,
        firstName,
        lastName || null,
        role,
        "active",
        timezone,
      ],
    );

    // Accept invite
    await acceptTeamInvite(invite.id, userId, client);

    return {
      userId,
      inviteId: invite.id,
    };
  });
}
