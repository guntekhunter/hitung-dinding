-- ============================================================
-- Rapi Studio — Payment & Subscription Tables
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. orders ────────────────────────────────────────────────
create table if not exists orders (
  id                uuid primary key default gen_random_uuid(),
  merchant_order_id text unique not null,
  user_id           uuid not null,
  amount            integer not null,
  status            text not null default 'PENDING',
  reference         text,
  payment_method    text,
  created_at        timestamptz default now()
);

-- Index for fast status polling by merchant_order_id
create index if not exists idx_orders_merchant_order_id on orders(merchant_order_id);
create index if not exists idx_orders_user_id on orders(user_id);

-- Row-Level Security: hanya user pemilik yang bisa read ordernya sendiri.
-- API routes pakai service_role key (bypass RLS), jadi ini aman.
alter table orders enable row level security;

create policy "Users can view their own orders"
  on orders for select
  using (auth.uid() = user_id);

-- ── 2. subscriptions ─────────────────────────────────────────
create table if not exists subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid unique not null,   -- 1 subscription per user
  plan       text not null default 'PRO',
  expired_at timestamptz not null,
  order_id   text,                   -- merchant_order_id yang mengaktifkan
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_subscriptions_user_id on subscriptions(user_id);

alter table subscriptions enable row level security;

create policy "Users can view their own subscription"
  on subscriptions for select
  using (auth.uid() = user_id);

-- ── Helper: cek apakah user punya active subscription ────────
-- Usage: SELECT is_subscribed('user-uuid-here');
create or replace function is_subscribed(p_user_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from subscriptions
    where user_id = p_user_id
      and expired_at > now()
  );
$$;
