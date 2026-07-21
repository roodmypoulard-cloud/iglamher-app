-- Phase 13 beta sprint — provider onboarding review state + demo-provider flag.
--
-- Blocker 2 (onboarding): every new provider self-creates a professional_profiles
--   row (already permitted by the "pro self insert" RLS policy + the role trigger
--   that lets a customer self-upgrade to professional). This adds an explicit
--   review_status so a provider is `pending_review` after submitting and can only
--   become publicly bookable when an ADMIN approves (approval flips is_active,
--   which is the sole visibility gate). Providers cannot self-approve.
-- Blocker 3 (demo data): a single is_demo flag distinguishes seeded demo pros from
--   real ones, without deleting anything. Hiding them is a separate, reversible
--   operator command (see supabase/HIDE_DEMO_PROVIDERS.sql) run only once real
--   providers exist.
--
-- Additive & idempotent. No data dropped. Changes no existing visibility behavior
-- on its own (it does NOT hide demo providers — that is a deliberate later step).

-- ---------- review state ----------
do $$ begin
  create type public.professional_review_status as enum ('draft','pending_review','approved','rejected');
exception when duplicate_object then null; end $$;

alter table public.professional_profiles
  add column if not exists review_status public.professional_review_status not null default 'draft';

alter table public.professional_profiles
  add column if not exists is_demo boolean not null default false;

-- admin review queue lookup
create index if not exists pro_review_status_idx
  on public.professional_profiles (review_status)
  where review_status = 'pending_review';

-- ---------- flag the 12 seeded demo providers (blocker 3) ----------
-- Marks demo data without touching visibility. Real providers default is_demo=false.
update public.professional_profiles
   set is_demo = true
 where user_id in (
   'a0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000004',
   'a0000000-0000-4000-8000-000000000005','a0000000-0000-4000-8000-000000000006',
   'a0000000-0000-4000-8000-000000000007','a0000000-0000-4000-8000-000000000008',
   'a0000000-0000-4000-8000-000000000009','a0000000-0000-4000-8000-00000000000a',
   'a0000000-0000-4000-8000-00000000000b','a0000000-0000-4000-8000-00000000000c'
 );

-- ---------- providers cannot self-approve ----------
-- Extend the existing column guard so a non-privileged writer (the provider
-- themselves) may move review_status draft<->pending_review, but only an admin /
-- service-role may set it to approved or rejected. is_active remains admin-only
-- (already guarded), so approval + visibility stay in admin hands.
create or replace function public.guard_professional_profile_columns() returns trigger as $$
begin
  if public.is_privileged_writer() then
    return new;
  end if;

  if new.is_active     is distinct from old.is_active
  or new.is_verified   is distinct from old.is_verified
  or new.is_featured   is distinct from old.is_featured
  or new.take_rate_bps is distinct from old.take_rate_bps then
    raise exception 'approval, verification, featuring and take rate are set by admins only';
  end if;

  if new.review_status is distinct from old.review_status
     and new.review_status in ('approved','rejected') then
    raise exception 'approval decisions are set by admins only';
  end if;

  if new.is_demo is distinct from old.is_demo then
    raise exception 'demo flag is set by admins only';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;
