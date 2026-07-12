-- ============================================================
-- Migration 002: pending_registrations table
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── pending_registrations ────────────────────────────────────
-- Stores pre-payment registration data temporarily.
-- Deleted after the callback successfully creates the account.
create table if not exists pending_registrations (
  id                  uuid primary key default gen_random_uuid(),
  merchant_order_id   text unique not null,
  company_name        text not null,
  admin_name          text not null,
  email               text not null,
  wa_number           text not null,
  password_plain      text not null,   -- temp; deleted after account creation
  created_at          timestamptz default now()
);

-- Auto-expire old pending rows after 24h (matches Duitku expiry)
-- Requires pg_cron extension or manual cleanup. This is just a comment reminder.
-- Alternative: delete rows older than 24h in a cron job.

create index if not exists idx_pending_reg_order_id
  on pending_registrations(merchant_order_id);

-- No RLS needed — only accessed via service_role key in API routes

-- ── Add wa_number to users table (if not exists) ─────────────
alter table users
  add column if not exists wa_number text;
