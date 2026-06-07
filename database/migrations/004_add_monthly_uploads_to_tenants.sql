-- Migration 004: add monthly upload tracking columns to tenants

BEGIN;

-- Add period start and count columns to tenants to track monthly uploads
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS monthly_upload_period_start DATE NOT NULL DEFAULT date_trunc('month', NOW())::date,
  ADD COLUMN IF NOT EXISTS monthly_upload_count INTEGER NOT NULL DEFAULT 0;

-- Optional backfill: populate current month's counts from receipts.
-- Uncomment and run once if you want to seed counts from existing data.
--
-- UPDATE tenants
-- SET monthly_upload_period_start = date_trunc('month', NOW())::date,
--     monthly_upload_count = COALESCE(sub.cnt, 0)
-- FROM (
--   SELECT r.tenant_id, COUNT(*) AS cnt
--   FROM receipts r
--   WHERE r.created_at >= date_trunc('month', NOW())
--     AND r.created_at < date_trunc('month', NOW()) + INTERVAL '1 month'
--   GROUP BY r.tenant_id
-- ) sub
-- WHERE tenants.id = sub.tenant_id;

COMMIT;
