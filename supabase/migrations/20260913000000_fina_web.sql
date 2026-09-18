-- Run in the Supabase SQL editor of Fina's project. Additive and idempotent.

alter table public.profiles
  add column if not exists native_language text,
  add column if not exists tutor_id text,
  add column if not exists ai_consent_at timestamptz,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists pro_status text,
  add column if not exists pro_current_period_end timestamptz;

create index if not exists profiles_stripe_subscription_id_idx on public.profiles (stripe_subscription_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Billing columns on profiles are server-owned.
--
-- Fina mobile writes `profiles` straight from the client, so the project has
-- an "update own row" RLS policy (left untouched here). That policy would also
-- let any signed-in user PATCH `pro_status = 'active'` on their own row and
-- grant themselves Fina Pro. This trigger makes the four billing columns
-- writable only by privileged callers:
--   * the service role (Stripe webhook, verify-purchase, account deletion),
--     detected via the request JWT: auth.role() = 'service_role';
--   * direct database sessions from the SQL editor / dashboard, detected via
--     session_user.
-- For everyone else, INSERT forces the columns to null and UPDATE pins them to
-- their previous values; every other column is written as normal.
--
-- session_user, not current_user: the function is SECURITY DEFINER, and inside
-- a security-definer function current_user is the function *owner* (postgres),
-- which would make every caller look privileged. session_user is the role that
-- opened the connection ('authenticator' for all PostgREST traffic), so it
-- still distinguishes API requests from SQL-editor sessions.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.protect_profile_billing_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role'
     or session_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.pro_status := null;
    new.pro_current_period_end := null;
    new.stripe_customer_id := null;
    new.stripe_subscription_id := null;
  else
    new.pro_status := old.pro_status;
    new.pro_current_period_end := old.pro_current_period_end;
    new.stripe_customer_id := old.stripe_customer_id;
    new.stripe_subscription_id := old.stripe_subscription_id;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_billing_columns on public.profiles;
create trigger protect_profile_billing_columns
  before insert or update on public.profiles
  for each row execute function public.protect_profile_billing_columns();
