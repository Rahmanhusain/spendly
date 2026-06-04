-- Migration 003: add phone number to tenant users
-- Stores a mobile number for payment/contact use only.

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);

COMMENT ON COLUMN users.phone_number IS
  'Mobile number used for payment-related contact only; not for OTP login.';

COMMIT;