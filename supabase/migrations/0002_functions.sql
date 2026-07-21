-- ============================================================
-- iGlamHer — 0002 functions & triggers
-- ============================================================

-- updated_at maintenance
create or replace function public.set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','customer_profiles','professional_profiles','professional_verifications',
    'services','bookings','payments','payout_records','reviews'
  ] loop
    execute format(
      'create trigger trg_%1$s_updated before update on public.%1$s
       for each row execute function public.set_updated_at();', t);
  end loop;
end $$;

-- admin lookup (security definer so RLS can call it safely)
create or replace function public.is_admin(uid uuid) returns boolean as $$
  select exists (select 1 from public.admin_roles where user_id = uid);
$$ language sql stable security definer set search_path = public;

create or replace function public.is_support_or_admin(uid uuid) returns boolean as $$
  select exists (select 1 from public.admin_roles where user_id = uid);
$$ language sql stable security definer set search_path = public;

-- auto-create profile + customer record for every new auth user (default customer)
create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', 'customer')
  on conflict (id) do nothing;
  insert into public.customer_profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- prevent role escalation. Only service role or existing admins may set admin/support.
-- Customers may self-upgrade to professional (entering pro onboarding) — nothing higher.
create or replace function public.prevent_role_escalation() returns trigger as $$
begin
  if new.role is distinct from old.role then
    if auth.role() = 'service_role' or public.is_admin(auth.uid()) then
      return new;
    end if;
    if old.role = 'customer' and new.role = 'professional' and auth.uid() = new.id then
      return new;
    end if;
    raise exception 'role change not permitted';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_profiles_role_guard on public.profiles;
create trigger trg_profiles_role_guard
  before update on public.profiles
  for each row execute function public.prevent_role_escalation();

-- keep professional rating denormalized
create or replace function public.refresh_professional_rating() returns trigger as $$
declare pid uuid := coalesce(new.professional_id, old.professional_id);
begin
  update public.professional_profiles p set
    rating_average = coalesce((select round(avg(rating)::numeric,2)
                               from public.reviews where professional_id = pid and is_published), 0),
    review_count   = (select count(*) from public.reviews where professional_id = pid and is_published)
  where p.user_id = pid;
  return null;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_review_rating on public.reviews;
create trigger trg_review_rating
  after insert or update or delete on public.reviews
  for each row execute function public.refresh_professional_rating();

-- a review may only exist for a completed booking (server also checks, DB is the guard)
create or replace function public.enforce_review_eligibility() returns trigger as $$
begin
  if not exists (
    select 1 from public.bookings b
    where b.id = new.booking_id and b.status = 'completed'
      and b.customer_id = new.customer_id and b.professional_id = new.professional_id
  ) then
    raise exception 'review allowed only for your completed booking';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_review_eligibility on public.reviews;
create trigger trg_review_eligibility
  before insert on public.reviews
  for each row execute function public.enforce_review_eligibility();
