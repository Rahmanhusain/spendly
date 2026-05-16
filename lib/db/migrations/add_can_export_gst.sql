-- Migration: add can_export_gst permission flag to users
-- Run this once against your database.
--
-- Grants employees (and any role) the ability to access GST export routes
-- when explicitly enabled by an admin or manager.

  ALTER TABLE users
    ADD COLUMN IF NOT EXISTS can_export_gst BOOLEAN NOT NULL DEFAULT FALSE;

  COMMENT ON COLUMN users.can_export_gst IS
    'When true, this user may access GST report and export routes regardless of role. '
    'Only admins and managers can toggle this flag.';
