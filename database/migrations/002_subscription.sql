-- Migration 002: Subscription gating
-- Adds subscribed/expired plan states, subscription tracking columns,
-- and a subscription_orders table for Cashfree payment records.

BEGIN;

-- 1. Extend plan_type enum
ALTER TYPE plan_type ADD VALUE IF NOT EXISTS 'subscribed';
ALTER TYPE plan_type ADD VALUE IF NOT EXISTS 'expired';

-- 2. Add subscription columns to tenants
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS subscription_plan       VARCHAR(20),      -- 'monthly' | 'quarterly'
  ADD COLUMN IF NOT EXISTS subscription_starts_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_ends_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_renewed_at TIMESTAMPTZ;

-- 3. Subscription orders (one row per Cashfree order attempt)
CREATE TABLE IF NOT EXISTS subscription_orders (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cashfree_order_id    TEXT        NOT NULL UNIQUE,
  plan                 VARCHAR(20) NOT NULL,           -- 'monthly' | 'quarterly'
  amount               NUMERIC(10,2) NOT NULL,
  status               VARCHAR(30) NOT NULL DEFAULT 'created',  -- created | paid | failed
  payment_session_id   TEXT,
  cashfree_payment_id  TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_orders_tenant
  ON subscription_orders(tenant_id, created_at DESC);

CREATE TRIGGER trg_subscription_orders_updated_at
BEFORE UPDATE ON subscription_orders
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
