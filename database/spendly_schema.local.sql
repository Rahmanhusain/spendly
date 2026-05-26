-- Spendly PostgreSQL Schema (local reference)
-- This file is intentionally local-only and ignored by git.
-- Covers full project scope from STORIES.md and IMPLEMENTATION.md.
-- Last updated: 2026-05-26 — added admin panel tables (migration 001)

BEGIN;

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_type') THEN
    CREATE TYPE plan_type AS ENUM ('trial');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('employee', 'manager', 'admin');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'record_status') THEN
    CREATE TYPE record_status AS ENUM ('active', 'inactive', 'suspended');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'receipt_status') THEN
    CREATE TYPE receipt_status AS ENUM ('processing', 'draft', 'verified', 'needs_review', 'archived');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
    CREATE TYPE report_status AS ENUM ('draft', 'submitted', 'info_requested', 'approved', 'rejected', 'paid');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'severity_type') THEN
    CREATE TYPE severity_type AS ENUM ('info', 'warning', 'error');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_status') THEN
    CREATE TYPE job_status AS ENUM ('queued', 'processing', 'completed', 'failed');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_channel') THEN
    CREATE TYPE notification_channel AS ENUM ('in_app', 'email');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reimbursement_method') THEN
    CREATE TYPE reimbursement_method AS ENUM ('upi', 'bank', 'cash', 'other');
  END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- Shared trigger function for updated_at
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- Multi-tenant foundation
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug CITEXT NOT NULL UNIQUE,
  plan plan_type NOT NULL DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '15 days',
  status record_status NOT NULL DEFAULT 'active',
  country_code VARCHAR(2) NOT NULL DEFAULT 'IN',
  gstin VARCHAR(20),
  company_address TEXT,
  receipt_quota_monthly INTEGER NOT NULL DEFAULT 1000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_tenants_updated_at
BEFORE UPDATE ON tenants
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email CITEXT NOT NULL,
  password_hash TEXT NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role user_role NOT NULL DEFAULT 'employee',
  status record_status NOT NULL DEFAULT 'active',
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
  email_summary_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  can_export_gst BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_users_tenant_role ON users(tenant_id, role);
CREATE INDEX IF NOT EXISTS idx_users_tenant_status ON users(tenant_id, status);

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id, expires_at);

CREATE TABLE IF NOT EXISTS auth_email_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT NOT NULL,
  purpose VARCHAR(32) NOT NULL,
  otp_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_email_otps_lookup
ON auth_email_otps (email, purpose, created_at DESC)
WHERE consumed_at IS NULL;

CREATE TABLE IF NOT EXISTS team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email CITEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'employee',
  token_hash TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  accepted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, email, token_hash)
);

CREATE INDEX IF NOT EXISTS idx_team_invites_tenant_email ON team_invites(tenant_id, email);

CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_teams_tenant ON teams(tenant_id);

CREATE TRIGGER trg_teams_updated_at
BEFORE UPDATE ON teams
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'employee',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_tenant_team ON team_members(tenant_id, team_id);

-- -----------------------------------------------------------------------------
-- Policies and validation
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expense_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  rules JSONB NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  status record_status NOT NULL DEFAULT 'active',
  version INTEGER NOT NULL DEFAULT 1,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expense_policies_tenant_status ON expense_policies(tenant_id, status);

CREATE TRIGGER trg_expense_policies_updated_at
BEFORE UPDATE ON expense_policies
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS policy_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  receipt_id UUID,
  report_id UUID,
  policy_id UUID REFERENCES expense_policies(id) ON DELETE SET NULL,
  rule_code VARCHAR(80) NOT NULL,
  severity severity_type NOT NULL DEFAULT 'warning',
  actual_value NUMERIC(14,2),
  limit_value NUMERIC(14,2),
  difference_value NUMERIC(14,2),
  message TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_policy_violations_tenant_resolved ON policy_violations(tenant_id, resolved);

-- -----------------------------------------------------------------------------
-- Receipts and parsing
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  receipt_number VARCHAR(30),
  vendor_name VARCHAR(255),
  amount NUMERIC(14,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  receipt_date DATE NOT NULL,
  category VARCHAR(80),
  description TEXT,
  gst_rate NUMERIC(5,2),
  cgst_rate NUMERIC(5,2),
  igst_rate NUMERIC(5,2),
  sgst_rate NUMERIC(5,2),
  cgst_amount NUMERIC(14,2),
  igst_amount NUMERIC(14,2),
  sgst_amount NUMERIC(14,2),
  tax_amount NUMERIC(14,2),
  vendor_gstin VARCHAR(20),
  file_path TEXT NOT NULL,
  file_name TEXT,
  mime_type VARCHAR(100),
  file_size_bytes BIGINT,
  extracted_text TEXT,
  parsed_data JSONB,
  confidence_score NUMERIC(4,3),
  status receipt_status NOT NULL DEFAULT 'processing',
  is_duplicate BOOLEAN NOT NULL DEFAULT FALSE,
  duplicate_of UUID REFERENCES receipts(id) ON DELETE SET NULL,
  parse_error TEXT,
  submitted_in_report_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (amount >= 0),
  UNIQUE (tenant_id, receipt_number)
);

CREATE INDEX IF NOT EXISTS idx_receipts_tenant_date ON receipts(tenant_id, receipt_date);
CREATE INDEX IF NOT EXISTS idx_receipts_tenant_user ON receipts(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_receipts_tenant_status ON receipts(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_receipts_tenant_amount ON receipts(tenant_id, amount);
CREATE INDEX IF NOT EXISTS idx_receipts_tenant_receipt_number ON receipts(tenant_id, receipt_number);
CREATE INDEX IF NOT EXISTS idx_receipts_tenant_category ON receipts(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_receipts_duplicate ON receipts(tenant_id, vendor_name, amount, receipt_date);

CREATE TRIGGER trg_receipts_updated_at
BEFORE UPDATE ON receipts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS parsing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  queue_name VARCHAR(80) NOT NULL DEFAULT 'receipt-parse-queue',
  status job_status NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parsing_jobs_tenant_status ON parsing_jobs(tenant_id, status);

-- -----------------------------------------------------------------------------
-- Reports, approvals, comments, reimbursements
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expense_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  period_start DATE,
  period_end DATE,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  status report_status NOT NULL DEFAULT 'draft',
  approver_id UUID REFERENCES users(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (total_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_expense_reports_tenant_status ON expense_reports(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_expense_reports_tenant_user ON expense_reports(tenant_id, user_id);

CREATE TRIGGER trg_expense_reports_updated_at
BEFORE UPDATE ON expense_reports
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS expense_report_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  report_id UUID NOT NULL REFERENCES expense_reports(id) ON DELETE CASCADE,
  receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE RESTRICT,
  line_number INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (report_id, receipt_id)
);

CREATE INDEX IF NOT EXISTS idx_report_items_tenant_report ON expense_report_items(tenant_id, report_id);

CREATE TABLE IF NOT EXISTS approval_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  report_id UUID NOT NULL REFERENCES expense_reports(id) ON DELETE CASCADE,
  current_level INTEGER NOT NULL DEFAULT 1,
  total_levels INTEGER NOT NULL DEFAULT 1,
  approver_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status report_status NOT NULL DEFAULT 'submitted',
  comments TEXT,
  acted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_workflows_tenant_approver_status
ON approval_workflows(tenant_id, approver_id, status);

CREATE TRIGGER trg_approval_workflows_updated_at
BEFORE UPDATE ON approval_workflows
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS report_access_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  report_id UUID NOT NULL REFERENCES expense_reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (report_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_report_access_list_tenant_report ON report_access_list(tenant_id, report_id);
CREATE INDEX IF NOT EXISTS idx_report_access_list_user ON report_access_list(tenant_id, user_id);

CREATE TABLE IF NOT EXISTS report_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  report_id UUID NOT NULL REFERENCES expense_reports(id) ON DELETE CASCADE,
  receipt_id UUID REFERENCES receipts(id) ON DELETE SET NULL,
  parent_comment_id UUID REFERENCES report_comments(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  message TEXT NOT NULL,
  mentioned_user_ids JSONB DEFAULT NULL,
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_comments_tenant_report ON report_comments(tenant_id, report_id);

CREATE TRIGGER trg_report_comments_updated_at
BEFORE UPDATE ON report_comments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS receipt_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES receipt_comments(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  message TEXT NOT NULL,
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receipt_comments_tenant_receipt
ON receipt_comments(tenant_id, receipt_id, created_at DESC);

CREATE TRIGGER trg_receipt_comments_updated_at
BEFORE UPDATE ON receipt_comments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS reimbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  report_id UUID NOT NULL UNIQUE REFERENCES expense_reports(id) ON DELETE CASCADE,
  method reimbursement_method,
  reference_number VARCHAR(120),
  amount_paid NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid_by UUID REFERENCES users(id) ON DELETE SET NULL,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_reimbursements_updated_at
BEFORE UPDATE ON reimbursements
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- Compliance and exports
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gst_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  generated_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_cgst NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_sgst NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_igst NUMERIC(14,2) NOT NULL DEFAULT 0,
  file_path TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS idx_gst_exports_tenant_period ON gst_exports(tenant_id, period_start, period_end);

-- -----------------------------------------------------------------------------
-- Notifications and activity tracking
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel notification_channel NOT NULL DEFAULT 'in_app',
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  related_type VARCHAR(80),
  related_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_tenant_user_read ON notifications(tenant_id, user_id, is_read);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(120) NOT NULL,
  resource_type VARCHAR(80) NOT NULL,
  resource_id UUID,
  request_id VARCHAR(100),
  ip_address INET,
  user_agent TEXT,
  before_data JSONB,
  after_data JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_action ON audit_logs(tenant_id, action);

-- -----------------------------------------------------------------------------
-- Optional helper view for dashboard
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_tenant_monthly_spend AS
SELECT
  tenant_id,
  DATE_TRUNC('month', receipt_date)::date AS month_start,
  category,
  SUM(amount) AS total_amount,
  SUM(COALESCE(tax_amount, 0)) AS total_tax,
  COUNT(*) AS receipt_count
FROM receipts
WHERE status IN ('draft', 'verified', 'needs_review', 'archived')
GROUP BY tenant_id, DATE_TRUNC('month', receipt_date)::date, category;

-- -----------------------------------------------------------------------------
-- Row level security foundation (app sets app.tenant_id)
-- -----------------------------------------------------------------------------
-- In API code, set this per request before tenant-scoped queries:
--   SET LOCAL app.tenant_id = '<tenant-uuid>';

CREATE OR REPLACE FUNCTION app_current_tenant_id()
RETURNS UUID AS $$
DECLARE
  tenant_text TEXT;
BEGIN
  tenant_text := current_setting('app.tenant_id', TRUE);
  IF tenant_text IS NULL OR tenant_text = '' THEN
    RETURN NULL;
  END IF;
  RETURN tenant_text::UUID;
END;
$$ LANGUAGE plpgsql STABLE;

-- Enable RLS and add policy for key tables.
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE parsing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_report_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_access_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reimbursements ENABLE ROW LEVEL SECURITY;
ALTER TABLE gst_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'users','user_sessions','team_invites','teams','team_members',
      'expense_policies','policy_violations','receipts','parsing_jobs',
      'expense_reports','expense_report_items','approval_workflows','report_access_list','report_comments','receipt_comments',
      'reimbursements','gst_exports','notifications','audit_logs'
    ])
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS tenant_isolation_%I ON %I', tbl, tbl
    );

    EXECUTE format(
      'CREATE POLICY tenant_isolation_%I ON %I
       USING (tenant_id = app_current_tenant_id())
       WITH CHECK (tenant_id = app_current_tenant_id())',
      tbl, tbl
    );
  END LOOP;
END
$$;

-- Special policy for tenants table itself.
DROP POLICY IF EXISTS tenant_self_access ON tenants;
CREATE POLICY tenant_self_access ON tenants
USING (id = app_current_tenant_id())
WITH CHECK (id = app_current_tenant_id());

COMMIT;

-- =============================================================================
-- Admin Panel Tables (Migration 001)
-- =============================================================================

BEGIN;

-- Super-admin users (platform-level, not tenant-scoped)
CREATE TABLE IF NOT EXISTS super_admins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         CITEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          VARCHAR(120) NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_super_admins_updated_at
BEFORE UPDATE ON super_admins
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Admin sessions
CREATE TABLE IF NOT EXISTS admin_sessions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id           UUID NOT NULL REFERENCES super_admins(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  expires_at         TIMESTAMPTZ NOT NULL,
  revoked_at         TIMESTAMPTZ,
  ip_address         INET,
  user_agent         TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin
  ON admin_sessions(admin_id, expires_at);

-- Inquiry status and reason enums
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
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_direction') THEN
    CREATE TYPE email_direction AS ENUM ('inbound', 'outbound');
  END IF;
END
$$;

-- Contact inquiries (from public contact form)
CREATE TABLE IF NOT EXISTS contact_inquiries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_name  VARCHAR(120) NOT NULL,
  sender_email CITEXT NOT NULL,
  reason       inquiry_reason NOT NULL,
  subject      VARCHAR(200) NOT NULL,
  message      TEXT NOT NULL,
  status       inquiry_status NOT NULL DEFAULT 'new',
  admin_notes  TEXT,
  reviewed_by  UUID REFERENCES super_admins(id) ON DELETE SET NULL,
  reviewed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

-- Inbound emails (via Resend webhook)
CREATE TABLE IF NOT EXISTS inbound_emails (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resend_email_id TEXT UNIQUE,
  direction       email_direction NOT NULL DEFAULT 'inbound',
  from_address    TEXT NOT NULL,
  to_address      TEXT NOT NULL,
  subject         TEXT NOT NULL,
  text_body       TEXT,
  html_body       TEXT,
  raw_payload     JSONB,
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
