-- ============================================================
-- Migration 003: Add must_change_password flag & update pending registrations
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Add must_change_password column to users table (default false for existing users)
alter table users
  add column if not exists must_change_password boolean not null default false;

-- 2. Ensure password_plain in pending_registrations can store generated temporary password or can be nullable
alter table pending_registrations
  alter column password_plain drop not null;
