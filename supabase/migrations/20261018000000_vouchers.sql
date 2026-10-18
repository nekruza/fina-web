-- Run in the Supabase SQL editor of Fina's project, after
-- 20260913000000_fina_web.sql. Additive and idempotent.
--
-- Voucher codes grant Fina Pro for a fixed number of days (a year by default)
-- without going through Stripe: no card, and no renewal when the period ends.

create table if not exists public.voucher_codes (
  id uuid primary key default gen_random_uuid(),
  -- Stored normalized (upper case); redeem_voucher upper-cases its input.
  code text not null unique check (code ~ '^[A-Z0-9_-]{4,40}$'),
  description text check (char_length(description) <= 200),
  duration_days integer not null default 365 check (duration_days between 1 and 3650),
  -- null = unlimited uses.
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  redemption_count integer not null default 0 check (redemption_count >= 0),
  starts_at timestamptz,
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at is null or expires_at is null or expires_at > starts_at)
);

create table if not exists public.voucher_redemptions (
  id uuid primary key default gen_random_uuid(),
  -- restrict: a code that has been used can be deactivated, not deleted, so
  -- the record of who redeemed it is kept.
  voucher_id uuid not null references public.voucher_codes (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete cascade,
  pro_until timestamptz not null,
  redeemed_at timestamptz not null default now(),
  unique (voucher_id, user_id)
);

create index if not exists voucher_redemptions_user_id_idx on public.voucher_redemptions (user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Both tables are server-only. RLS on with no policies means anon and
-- authenticated callers can neither read nor write them (so codes cannot be
-- listed from the browser); the service role bypasses RLS. The revokes are
-- defence in depth against Supabase's default table grants.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.voucher_codes enable row level security;
alter table public.voucher_redemptions enable row level security;

revoke all on public.voucher_codes from anon, authenticated;
revoke all on public.voucher_redemptions from anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- redeem_voucher: validate a code and grant Pro in one transaction.
--
-- The voucher row is locked FOR UPDATE, so two users racing for the last use
-- of a limited code are serialized and the limit cannot be overshot. The
-- profile row is locked too, so one user cannot redeem two codes at once.
--
-- Returns {"status": ..., "pro_until": ...}. status is 'ok' or one of:
-- invalid, not_started, expired, exhausted, already_redeemed, already_pro,
-- has_subscription, no_profile.
--
-- Only the service role may execute it (the /api/vouchers/redeem route passes
-- the authenticated user's id). The profile write passes the billing-column
-- trigger because auth.role() is 'service_role' for those requests.
--
-- A live Stripe subscription blocks redemption: granting Pro on top of it
-- would leave the user billed for something they no longer need. Redeeming
-- clears stripe_subscription_id (keeping stripe_customer_id), so a late
-- webhook for an old, ended subscription cannot match the profile by id.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.redeem_voucher(p_code text, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.voucher_codes%rowtype;
  p public.profiles%rowtype;
  v_until timestamptz;
begin
  select * into v
    from public.voucher_codes
   where code = upper(btrim(p_code))
     for update;

  if not found or not v.active then
    return jsonb_build_object('status', 'invalid');
  end if;
  if v.starts_at is not null and now() < v.starts_at then
    return jsonb_build_object('status', 'not_started');
  end if;
  if v.expires_at is not null and now() >= v.expires_at then
    return jsonb_build_object('status', 'expired');
  end if;
  if exists (
    select 1 from public.voucher_redemptions
     where voucher_id = v.id and user_id = p_user_id
  ) then
    return jsonb_build_object('status', 'already_redeemed');
  end if;
  if v.max_redemptions is not null and v.redemption_count >= v.max_redemptions then
    return jsonb_build_object('status', 'exhausted');
  end if;

  select * into p from public.profiles where id = p_user_id for update;
  if not found then
    return jsonb_build_object('status', 'no_profile');
  end if;
  if p.stripe_subscription_id is not null
     and p.pro_status in ('active', 'trialing', 'past_due') then
    return jsonb_build_object('status', 'has_subscription');
  end if;
  if p.pro_status in ('active', 'trialing')
     and (p.pro_current_period_end is null or p.pro_current_period_end > now()) then
    return jsonb_build_object('status', 'already_pro');
  end if;

  v_until := now() + make_interval(days => v.duration_days);

  insert into public.voucher_redemptions (voucher_id, user_id, pro_until)
  values (v.id, p_user_id, v_until);

  update public.voucher_codes
     set redemption_count = redemption_count + 1,
         updated_at = now()
   where id = v.id;

  update public.profiles
     set pro_status = 'active',
         pro_current_period_end = v_until,
         stripe_subscription_id = null
   where id = p_user_id;

  return jsonb_build_object('status', 'ok', 'pro_until', v_until);
end;
$$;

revoke all on function public.redeem_voucher(text, uuid) from public, anon, authenticated;
grant execute on function public.redeem_voucher(text, uuid) to service_role;
