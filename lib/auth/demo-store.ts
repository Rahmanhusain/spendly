import crypto from "crypto";
import bcrypt from "bcrypt";
import { createAuthTokens, hashToken } from "@/lib/auth/tokens";
import type { LoginInput, SignupInput } from "@/lib/validators/auth";

type TenantRecord = {
  id: string;
  name: string;
  slug: string;
  plan: "trial";
  trialEndsAt: string;
  status: "active";
  countryCode: string;
  gstin?: string | null;
  companyAddress?: string | null;
  receiptQuotaMonthly: number;
};

type UserRecord = {
  id: string;
  tenantId: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: "admin" | "manager" | "employee";
  status: "active";
  timezone: string;
};

type SessionRecord = {
  id: string;
  tenantId: string;
  userId: string;
  refreshTokenHash: string;
  createdAt: string;
  expiresAt: string;
};

const tenants = new Map<string, TenantRecord>();
const users = new Map<string, UserRecord>();
const sessions = new Map<string, SessionRecord>();

function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function buildWorkspaceSnapshot(tenant: TenantRecord, user: UserRecord) {
  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      plan: tenant.plan,
      countryCode: tenant.countryCode,
    },
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      timezone: user.timezone,
    },
  };
}

export async function createTenantAccount(input: SignupInput) {
  const email = normalizeEmail(input.email);
  const duplicateTenant = [...tenants.values()].some(
    (tenant) => tenant.slug === input.companySlug,
  );

  if (duplicateTenant) {
    throw new Error("A workspace with this slug already exists.");
  }

  const duplicateEmail = [...users.values()].some(
    (user) => user.email === email,
  );

  if (duplicateEmail) {
    throw new Error("An account with this email already exists.");
  }

  const tenantId = createId("tenant");
  const userId = createId("user");
  const sessionId = createId("session");
  const passwordHash = await bcrypt.hash(input.password, 12);

  const tenant: TenantRecord = {
    id: tenantId,
    name: input.companyName,
    slug: input.companySlug,
    plan: "trial",
    trialEndsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 15).toISOString(),
    status: "active",
    countryCode: input.countryCode,
    gstin: input.gstin || null,
    companyAddress: input.companyAddress || null,
    receiptQuotaMonthly: 999999,
  };

  const user: UserRecord = {
    id: userId,
    tenantId,
    email,
    passwordHash,
    firstName: input.firstName,
    lastName: input.lastName,
    role: "admin",
    status: "active",
    timezone: input.timezone,
  };

  tenants.set(tenantId, tenant);
  users.set(userId, user);

  const tokens = await createAuthTokens({
    userId,
    tenantId,
    tenantSlug: tenant.slug,
    role: user.role,
    sessionId,
  });

  sessions.set(sessionId, {
    id: sessionId,
    tenantId,
    userId,
    refreshTokenHash: await hashToken(tokens.refreshToken),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
  });

  return {
    tokens,
    workspace: buildWorkspaceSnapshot(tenant, user),
    defaultPolicies: [
      {
        name: "Meal policy",
        rule: "Warn when meal spend exceeds the configured limit.",
      },
      {
        name: "Duplicate detection",
        rule: "Flag the same vendor, amount, and date within the last 7 days.",
      },
    ],
  };
}

export async function loginWithCredentials(input: LoginInput) {
  const email = normalizeEmail(input.email);
  const user = [...users.values()].find(
    (candidate) => candidate.email === email,
  );

  if (!user) {
    throw new Error("Invalid email or password.");
  }

  const passwordMatches = await bcrypt.compare(
    input.password,
    user.passwordHash,
  );

  if (!passwordMatches) {
    throw new Error("Invalid email or password.");
  }

  const tenant = tenants.get(user.tenantId);

  if (!tenant) {
    throw new Error("Workspace not found for this account.");
  }

  const sessionId = createId("session");
  const tokens = await createAuthTokens({
    userId: user.id,
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    role: user.role,
    sessionId,
  });

  sessions.set(sessionId, {
    id: sessionId,
    tenantId: tenant.id,
    userId: user.id,
    refreshTokenHash: await hashToken(tokens.refreshToken),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
  });

  return {
    tokens,
    workspace: buildWorkspaceSnapshot(tenant, user),
    session: {
      id: sessionId,
      tenantId: tenant.id,
      userId: user.id,
      role: user.role,
    },
  };
}

export function getDemoState() {
  return {
    tenants: [...tenants.values()],
    users: [...users.values()],
    sessions: [...sessions.values()],
  };
}
