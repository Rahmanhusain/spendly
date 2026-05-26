-- =============================================================================
-- Migration 001: Admin Panel
-- Adds: super_admins, admin_sessions, contact_inquiries, inbound_emails
-- Run this against your existing database to apply the admin panel schema.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Super-admin users (platform-level, not tenant-scoped)
-- Created manually via DB INSERT — no self-registration.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS super_admins (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       CITEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name        VARCHAR(120) NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_super_admins_updated_at
BEFORE UPDATE ON super_admins
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- Admin sessions (separate from tenant user_sessions)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id          UUID NOT NULL REFERENCES super_admins(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  expires_at        TIMESTAMPTZ NOT NULL,
  revoked_at        TIMESTAMPTZ,
  ip_address        INET,
  user_agent        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin
  ON admin_sessions(admin_id, expires_at);

-- -----------------------------------------------------------------------------
-- Contact inquiries (from the public contact form)
-- Replaces the "email to support inbox" approach.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inquiry_status') THEN
    CREATE TYPE inquiry_status AS ENUM ('new', 'in_review', 'reviewed', 'closed');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inquiry_reason') THEN
    CREATE TYPE inquiry_reason AS ENUM (
      'complaint', 'suggestion', 'feedback', 'query', 'support', 'partnership'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS contact_inquiries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_name   VARCHAR(120) NOT NULL,
  sender_email  CITEXT NOT NULL,
  reason        inquiry_reason NOT NULL,
  subject       VARCHAR(200) NOT NULL,
  message       TEXT NOT NULL,
  status        inquiry_status NOT NULL DEFAULT 'new',
  admin_notes   TEXT,
  reviewed_by   UUID REFERENCES super_admins(id) ON DELETE SET NULL,
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_inquiries_status
  ON contact_inquiries(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_inquiries_reason
  ON contact_inquiries(reason);
CREATE INDEX IF NOT EXISTS idx_contact_inquiries_email
  ON contact_inquiries(sender_email);

CREATE TRIGGER trg_contact_inquiries_updated_at
BEFORE UPDATE ON contact_inquiries
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- Inbound emails (stored via Resend webhook from support@spendly.software)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_direction') THEN
    CREATE TYPE email_direction AS ENUM ('inbound', 'outbound');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS inbound_emails (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resend_email_id TEXT UNIQUE,          -- Resend's own email ID for dedup
  direction       email_direction NOT NULL DEFAULT 'inbound',
  from_address    TEXT NOT NULL,
  to_address      TEXT NOT NULL,
  subject         TEXT NOT NULL,
  text_body       TEXT,
  html_body       TEXT,
  raw_payload     JSONB,                -- full Resend webhook payload
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  read_at         TIMESTAMPTZ,
  read_by         UUID REFERENCES super_admins(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbound_emails_is_read
  ON inbound_emails(is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_from
  ON inbound_emails(from_address);

COMMIT;
