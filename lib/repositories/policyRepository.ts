import crypto from "crypto";
import { query } from "@/lib/db/client";

export interface ExpensePolicyRecord {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  rules: Record<string, unknown>;
  is_default: boolean;
  status: "active" | "inactive" | "suspended";
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export async function getDefaultPolicyForTenant(
  tenantId: string,
): Promise<ExpensePolicyRecord | null> {
  const result = await query<ExpensePolicyRecord>(
    `SELECT *
     FROM expense_policies
     WHERE tenant_id = $1
       AND status = 'active'
     ORDER BY is_default DESC, updated_at DESC
     LIMIT 1`,
    [tenantId],
  );

  return result.rows[0] ?? null;
}

export async function upsertDefaultPolicyForTenant(
  tenantId: string,
  userId: string,
  payload: {
    name: string;
    description?: string;
    rules: Record<string, unknown>;
  },
): Promise<ExpensePolicyRecord> {
  const existing = await getDefaultPolicyForTenant(tenantId);

  if (existing) {
    const result = await query<ExpensePolicyRecord>(
      `UPDATE expense_policies
       SET name = $1,
           description = $2,
           rules = $3::jsonb,
           is_default = TRUE,
           status = 'active',
           version = version + 1,
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [
        payload.name,
        payload.description?.trim() || null,
        JSON.stringify(payload.rules),
        existing.id,
      ],
    );

    return result.rows[0];
  }

  const result = await query<ExpensePolicyRecord>(
    `INSERT INTO expense_policies (
      id,
      tenant_id,
      name,
      description,
      rules,
      is_default,
      status,
      version,
      created_by,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5::jsonb, TRUE, 'active', 1, $6, NOW(), NOW())
    RETURNING *`,
    [
      crypto.randomUUID(),
      tenantId,
      payload.name,
      payload.description?.trim() || null,
      JSON.stringify(payload.rules),
      userId,
    ],
  );

  return result.rows[0];
}
