import crypto from "crypto";
import { query } from "@/lib/db/client";

type AuthChallengePurpose = "signup" | "password_reset";

const OTP_LENGTH = 6;
const MAX_ATTEMPTS = 5;

let ensureTablePromise: Promise<void> | null = null;

function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

function generateOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function ensureAuthChallengesTable() {
  await query(
    `CREATE TABLE IF NOT EXISTS auth_email_otps (
      id UUID PRIMARY KEY,
      email CITEXT NOT NULL,
      purpose VARCHAR(32) NOT NULL,
      otp_hash TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      expires_at TIMESTAMPTZ NOT NULL,
      consumed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
  );

  await query(
    `CREATE INDEX IF NOT EXISTS idx_auth_email_otps_lookup
     ON auth_email_otps (email, purpose, created_at DESC)
     WHERE consumed_at IS NULL`,
  );
}

async function ensureTableReady() {
  if (!ensureTablePromise) {
    ensureTablePromise = ensureAuthChallengesTable();
  }

  await ensureTablePromise;
}

export async function createEmailOtpChallenge(input: {
  email: string;
  purpose: AuthChallengePurpose;
  ttlMinutes?: number;
  minIntervalSeconds?: number; // optional cooldown between sends
}): Promise<{ otp: string; expiresAt: string }> {
  await ensureTableReady();

  const ttlMinutes = input.ttlMinutes ?? 10;
  // cooldown check: if a previous OTP was created recently, prevent resend
  if (input.minIntervalSeconds && input.minIntervalSeconds > 0) {
    const recent = await query<{ created_at: string }>(
      `SELECT created_at FROM auth_email_otps
       WHERE email = $1 AND purpose = $2
       ORDER BY created_at DESC LIMIT 1`,
      [input.email.toLowerCase(), input.purpose],
    );

    if (recent.rows.length > 0) {
      const last = new Date(recent.rows[0].created_at).getTime();
      const now = Date.now();
      const diff = Math.floor((now - last) / 1000);
      if (diff < input.minIntervalSeconds) {
        const remaining = input.minIntervalSeconds - diff;
        const err = new Error(`COOLDOWN:${remaining}`);
        throw err;
      }
    }
  }

  const otp = generateOtpCode();
  const otpHash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

  await query(
    `UPDATE auth_email_otps
     SET consumed_at = NOW()
     WHERE email = $1
       AND purpose = $2
       AND consumed_at IS NULL`,
    [input.email.toLowerCase(), input.purpose],
  );

  await query(
    `INSERT INTO auth_email_otps
      (id, email, purpose, otp_hash, attempts, expires_at, created_at)
     VALUES ($1, $2, $3, $4, 0, $5, NOW())`,
    [
      crypto.randomUUID(),
      input.email.toLowerCase(),
      input.purpose,
      otpHash,
      expiresAt,
    ],
  );

  return { otp, expiresAt };
}

export async function verifyAndConsumeEmailOtp(input: {
  email: string;
  purpose: AuthChallengePurpose;
  otp: string;
}): Promise<boolean> {
  await ensureTableReady();

  const lookup = await query<{
    id: string;
    otp_hash: string;
    attempts: number;
    expires_at: string;
  }>(
    `SELECT id, otp_hash, attempts, expires_at
     FROM auth_email_otps
     WHERE email = $1
       AND purpose = $2
       AND consumed_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [input.email.toLowerCase(), input.purpose],
  );

  if (lookup.rows.length === 0) {
    return false;
  }

  const row = lookup.rows[0];
  const isExpired = new Date(row.expires_at).getTime() < Date.now();

  if (isExpired || row.attempts >= MAX_ATTEMPTS) {
    await query(
      `UPDATE auth_email_otps SET consumed_at = NOW() WHERE id = $1`,
      [row.id],
    );
    return false;
  }

  const hash = hashOtp(input.otp.trim());

  if (hash !== row.otp_hash) {
    await query(
      `UPDATE auth_email_otps
       SET attempts = attempts + 1
       WHERE id = $1`,
      [row.id],
    );
    return false;
  }

  await query(
    `UPDATE auth_email_otps
     SET consumed_at = NOW(), attempts = attempts + 1
     WHERE id = $1`,
    [row.id],
  );

  return true;
}
