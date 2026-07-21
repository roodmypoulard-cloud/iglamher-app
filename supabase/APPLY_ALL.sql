-- iGlamHer APPLY ALL (fresh DB).

-- ===== supabase/migrations/0001_schema.sql =====
-- ============================================================
-- iGlamHer — 0001 schema: types, tables, indexes, constraints
-- UUID PKs, UTC timestamptz, money in integer cents.
-- ============================================================
create extension if not exists "pgcrypto";
create extension if not exists btree_gist;   -- exclusion constraint for no double-booking
create extension if not exists postgis;      -- geography(point) for "near you"

-- ---------- ENUMS ----------
create type public.user_role as enum ('customer','professional','admin','support');
create type public.location_type as enum ('studio','mobile','both');
create type public.media_kind as enum ('image','video','instagram');
create type public.verification_status as enum ('unsubmitted','pending','approved','rejected');
create type public.booking_status as enum (
  'pending_payment','confirmed','change_requested','in_progress',
  'completed','cancelled_customer','cancelled_professional','refunded','disputed','no_show'
);
create type public.payment_status as enum ('requires_payment','processing','succeeded','failed','refunded','partially_refunded');
create type public.payout_status as enum ('pending','in_transit','paid','failed','reversed');
create type public.notif_type as enum ('booking','message','review','payout','system','promo');
create type public.admin_role_kind as enum ('admin','support');

-- ---------- IDENTITY ----------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        public.user_role not null default 'customer',
  full_name   text,
  avatar_url  text,
  phone       text,                          -- private; never exposed cross-party
  timezone    text not null default 'America/Los_Angeles',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.customer_profiles (
  user_id            uuid primary key references public.profiles(id) on delete cascade,
  default_address_id uuid,                    -- FK added after addresses exists
  notif_email        boolean not null default true,
  notif_sms          boolean not null default true,
  notif_push         boolean not null default true,
  onboarding_complete boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table public.professional_profiles (
  user_id             uuid primary key references public.profiles(id) on delete cascade,
  slug                text unique not null,
  business_name       text not null,
  headline            text,
  bio                 text,
  location_type       public.location_type not null default 'mobile',
  studio_address      text,
  geo                 geography(point),
  service_radius_miles numeric(6,2) default 15,
  instagram_handle    text,
  ig_follower_count   text,
  cover_url           text,
  location_lat        double precision,
  location_lng        double precision,
  cancellation_policy jsonb not null default '{}'::jsonb,
  onboarding_step     integer not null default 0,   -- save-and-continue
  onboarding_complete boolean not null default false,
  is_active           boolean not null default false, -- gated by onboarding + admin approval
  is_verified         boolean not null default false,
  is_featured         boolean not null default false,
  take_rate_bps       integer not null default 1500,  -- 15% platform fee
  stripe_account_id   text unique,
  rating_average      numeric(3,2) not null default 0,
  review_count        integer not null default 0,
  jobs_completed      integer not null default 0,
  starting_price_cents integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index professional_active_idx on public.professional_profiles(is_active) where is_active;

create table public.professional_verifications (
  id            uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(user_id) on delete cascade,
  status        public.verification_status not null default 'unsubmitted',
  id_document_url text,
  license_url   text,
  notes         text,
  reviewed_by   uuid references public.profiles(id),
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index verifications_pro_idx on public.professional_verifications(professional_id);

-- ---------- CATALOG ----------
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  description text,
  image_url   text,
  is_active   boolean not null default true,
  sort_order  integer not null default 0
);

create table public.services (
  id            uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(user_id) on delete cascade,
  category_id   uuid references public.categories(id),
  name          text not null,
  description   text,
  duration_minutes integer not null check (duration_minutes > 0),
  price_cents   integer not null check (price_cents >= 0),
  price_is_from boolean not null default false,
  deposit_type  text not null default 'full',
  deposit_value integer,
  location_type public.location_type not null default 'mobile',
  buffer_before_minutes integer not null default 0,
  buffer_after_minutes  integer not null default 0,
  is_active     boolean not null default true,
  deleted_at    timestamptz,                    -- soft-delete (historical bookings)
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index services_pro_idx on public.services(professional_id) where deleted_at is null;
create index services_category_idx on public.services(category_id);

create table public.service_addons (
  id            uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(user_id) on delete cascade,
  name          text not null,
  price_cents   integer not null check (price_cents >= 0),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);
create index addons_pro_idx on public.service_addons(professional_id);

create table public.professional_portfolio_items (
  id            uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(user_id) on delete cascade,
  kind          public.media_kind not null,
  url           text,
  thumb_url     text,
  ig_permalink  text,
  caption       text,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now()
);
create index portfolio_pro_idx on public.professional_portfolio_items(professional_id);

-- ---------- AVAILABILITY ----------
create table public.availability_rules (
  id            uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(user_id) on delete cascade,
  weekday       smallint not null check (weekday between 0 and 6),
  start_minute  smallint not null check (start_minute between 0 and 1440),
  end_minute    smallint not null check (end_minute between 0 and 1440),
  check (end_minute > start_minute)
);
create index avail_rules_pro_idx on public.availability_rules(professional_id);

create table public.availability_exceptions (
  id            uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(user_id) on delete cascade,
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  is_available  boolean not null default false,  -- false = blocked, true = extra hours
  reason        text,
  check (ends_at > starts_at)
);
create index avail_exc_pro_idx on public.availability_exceptions(professional_id, starts_at);

-- ---------- ADDRESSES / FAVORITES ----------
create table public.addresses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  label         text,
  line1         text not null,
  line2         text,
  city          text not null,
  state         text,
  postal_code   text,
  country       char(2) not null default 'US',
  lat           double precision,
  lng           double precision,
  is_default    boolean not null default false,
  created_at    timestamptz not null default now()
);
create index addresses_user_idx on public.addresses(user_id);
alter table public.customer_profiles
  add constraint customer_default_address_fk
  foreign key (default_address_id) references public.addresses(id) on delete set null;

create table public.favorites (
  customer_id   uuid not null references public.profiles(id) on delete cascade,
  professional_id uuid not null references public.professional_profiles(user_id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (customer_id, professional_id)
);

-- ---------- BOOKINGS ----------
create table public.bookings (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.profiles(id) on delete restrict,
  professional_id uuid not null references public.professional_profiles(user_id) on delete restrict,
  service_id    uuid not null references public.services(id),
  status        public.booking_status not null default 'pending_payment',
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  timezone      text not null,
  location_type public.location_type not null,
  address_id    uuid references public.addresses(id),
  currency      char(3) not null default 'USD',
  -- snapshotted pricing (immutable if service later edited)
  service_name_snapshot text not null,
  subtotal_cents integer not null,
  addons_cents  integer not null default 0,
  onsite_upcharge_cents integer not null default 0,
  fees_cents    integer not null default 0,
  tax_cents     integer not null default 0,
  discount_cents integer not null default 0,
  tip_cents     integer not null default 0,
  total_cents   integer not null,
  amount_due_now_cents integer not null,
  platform_fee_cents integer not null default 0,
  stripe_payment_intent_id text unique,
  cancellation_policy_snapshot jsonb not null default '{}'::jsonb,
  customer_notes text,
  reserves_time boolean not null default true,   -- for overlap exclusion
  time_range    tstzrange generated always as (tstzrange(starts_at, ends_at, '[)')) stored,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index bookings_pro_start_idx on public.bookings(professional_id, starts_at);
create index bookings_customer_start_idx on public.bookings(customer_id, starts_at);
create index bookings_status_idx on public.bookings(status);
-- no double-booking: same pro cannot have two time-reserving bookings that overlap
alter table public.bookings add constraint bookings_no_overlap
  exclude using gist (
    professional_id with =,
    time_range with &&
  ) where (reserves_time and status in
    ('pending_payment','confirmed','change_requested','in_progress'));

create table public.booking_line_items (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null references public.bookings(id) on delete cascade,
  kind          text not null,               -- service | addon | fee | tax | discount | tip | upcharge
  label         text not null,
  amount_cents  integer not null,
  metadata      jsonb not null default '{}'::jsonb
);
create index line_items_booking_idx on public.booking_line_items(booking_id);

create table public.booking_status_events (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null references public.bookings(id) on delete cascade,
  status        public.booking_status not null,
  actor_id      uuid references public.profiles(id),
  note          text,
  created_at    timestamptz not null default now()
);
create index status_events_booking_idx on public.booking_status_events(booking_id, created_at);

-- ---------- PAYMENTS ----------
create table public.payments (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null references public.bookings(id) on delete restrict,
  status        public.payment_status not null default 'requires_payment',
  amount_cents  integer not null,
  currency      char(3) not null default 'USD',
  stripe_payment_intent_id text unique,
  stripe_charge_id text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index payments_booking_idx on public.payments(booking_id);

create table public.refunds (
  id            uuid primary key default gen_random_uuid(),
  payment_id    uuid not null references public.payments(id) on delete restrict,
  booking_id    uuid not null references public.bookings(id),
  amount_cents  integer not null,
  reason        text,
  stripe_refund_id text unique,
  issued_by     uuid references public.profiles(id),
  created_at    timestamptz not null default now()
);
create index refunds_booking_idx on public.refunds(booking_id);

create table public.payout_records (
  id            uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(user_id) on delete restrict,
  booking_id    uuid references public.bookings(id),
  amount_cents  integer not null,
  status        public.payout_status not null default 'pending',
  stripe_transfer_id text unique,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index payouts_pro_idx on public.payout_records(professional_id);

-- ---------- REVIEWS ----------
create table public.reviews (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid unique not null references public.bookings(id),
  customer_id   uuid not null references public.profiles(id),
  professional_id uuid not null references public.professional_profiles(user_id),
  rating        integer not null check (rating between 1 and 5),
  body          text,
  professional_response text,
  is_published  boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index reviews_pro_idx on public.reviews(professional_id) where is_published;

-- ---------- MESSAGING ----------
create table public.conversations (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid unique references public.bookings(id) on delete cascade,
  last_message_at timestamptz,
  created_at    timestamptz not null default now()
);
create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  primary key (conversation_id, user_id)
);
create table public.messages (
  id            uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id     uuid not null references public.profiles(id),
  body          text,
  attachment_url text,
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index messages_convo_idx on public.messages(conversation_id, created_at);

-- ---------- NOTIFICATIONS ----------
create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  type          public.notif_type not null,
  title         text not null,
  body          text,
  data          jsonb not null default '{}'::jsonb,
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id, read_at);

-- ---------- PROMOS ----------
create table public.promo_codes (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,
  description   text,
  discount_type text not null default 'percent',  -- percent | fixed
  discount_value integer not null,
  max_redemptions integer,
  redemption_count integer not null default 0,
  starts_at     timestamptz,
  ends_at       timestamptz,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);
create table public.promo_redemptions (
  id            uuid primary key default gen_random_uuid(),
  promo_id      uuid not null references public.promo_codes(id) on delete cascade,
  customer_id   uuid not null references public.profiles(id) on delete cascade,
  booking_id    uuid references public.bookings(id),
  created_at    timestamptz not null default now(),
  unique (promo_id, customer_id)
);

-- ---------- ADMIN ----------
create table public.admin_roles (
  user_id       uuid primary key references public.profiles(id) on delete cascade,
  kind          public.admin_role_kind not null,
  granted_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now()
);

create table public.audit_logs (
  id            uuid primary key default gen_random_uuid(),
  actor_id      uuid references public.profiles(id),
  action        text not null,
  entity        text not null,
  entity_id     uuid,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index audit_actor_idx on public.audit_logs(actor_id, created_at);

-- ===== supabase/migrations/0002_functions.sql =====
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

-- ===== supabase/migrations/0003_rls.sql =====
-- ============================================================
-- iGlamHer — 0003 Row Level Security
-- Ownership + role enforced in the DB. Admin/support data is
-- unreachable via client keys (RLS on, no client policy = deny).
-- ============================================================
alter table public.profiles                    enable row level security;
alter table public.customer_profiles            enable row level security;
alter table public.professional_profiles        enable row level security;
alter table public.professional_verifications   enable row level security;
alter table public.categories                   enable row level security;
alter table public.services                     enable row level security;
alter table public.service_addons               enable row level security;
alter table public.professional_portfolio_items enable row level security;
alter table public.availability_rules           enable row level security;
alter table public.availability_exceptions      enable row level security;
alter table public.addresses                    enable row level security;
alter table public.favorites                    enable row level security;
alter table public.bookings                     enable row level security;
alter table public.booking_line_items           enable row level security;
alter table public.booking_status_events        enable row level security;
alter table public.payments                     enable row level security;
alter table public.refunds                      enable row level security;
alter table public.payout_records               enable row level security;
alter table public.reviews                      enable row level security;
alter table public.conversations                enable row level security;
alter table public.conversation_members         enable row level security;
alter table public.messages                     enable row level security;
alter table public.notifications                enable row level security;
alter table public.promo_codes                  enable row level security;
alter table public.promo_redemptions            enable row level security;
alter table public.admin_roles                  enable row level security;  -- no client policies = deny
alter table public.audit_logs                   enable row level security;  -- no client policies = deny

-- ---------- PROFILES ----------
create policy "profiles self read"    on public.profiles for select using (auth.uid() = id or public.is_admin(auth.uid()));
create policy "profiles self update"  on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- ---------- CUSTOMER PROFILES ----------
create policy "customer own"          on public.customer_profiles for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- PROFESSIONAL PROFILES ----------
create policy "pro public read"       on public.professional_profiles for select
  using (is_active or auth.uid() = user_id or public.is_admin(auth.uid()));
create policy "pro self insert"       on public.professional_profiles for insert with check (auth.uid() = user_id);
create policy "pro self update"       on public.professional_profiles for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- VERIFICATIONS (private) ----------
create policy "verif owner read"      on public.professional_verifications for select
  using (auth.uid() = professional_id or public.is_admin(auth.uid()));
create policy "verif owner write"     on public.professional_verifications for insert with check (auth.uid() = professional_id);
create policy "verif owner update"    on public.professional_verifications for update using (auth.uid() = professional_id);

-- ---------- CATEGORIES ----------
create policy "categories public"     on public.categories for select using (is_active or public.is_admin(auth.uid()));

-- ---------- SERVICES ----------
create policy "services public read"  on public.services for select using (
  (is_active and deleted_at is null and exists (
    select 1 from public.professional_profiles p where p.user_id = professional_id and p.is_active))
  or auth.uid() = professional_id or public.is_admin(auth.uid()));
create policy "services owner write"  on public.services for insert with check (auth.uid() = professional_id);
create policy "services owner update" on public.services for update using (auth.uid() = professional_id);
create policy "services owner delete" on public.services for delete using (auth.uid() = professional_id);

-- ---------- ADD-ONS ----------
create policy "addons public read"    on public.service_addons for select
  using (is_active or auth.uid() = professional_id);
create policy "addons owner write"    on public.service_addons for all
  using (auth.uid() = professional_id) with check (auth.uid() = professional_id);

-- ---------- PORTFOLIO ----------
create policy "portfolio public read" on public.professional_portfolio_items for select using (true);
create policy "portfolio owner write" on public.professional_portfolio_items for all
  using (auth.uid() = professional_id) with check (auth.uid() = professional_id);

-- ---------- AVAILABILITY ----------
create policy "avail rules read"      on public.availability_rules for select using (true);
create policy "avail rules owner"     on public.availability_rules for all
  using (auth.uid() = professional_id) with check (auth.uid() = professional_id);
create policy "avail exc read"        on public.availability_exceptions for select using (true);
create policy "avail exc owner"       on public.availability_exceptions for all
  using (auth.uid() = professional_id) with check (auth.uid() = professional_id);

-- ---------- ADDRESSES / FAVORITES ----------
create policy "addresses own"         on public.addresses for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "favorites own"         on public.favorites for all
  using (auth.uid() = customer_id) with check (auth.uid() = customer_id);

-- ---------- BOOKINGS ----------
create policy "bookings parties read" on public.bookings for select
  using (auth.uid() = customer_id or auth.uid() = professional_id or public.is_admin(auth.uid()));
create policy "bookings customer create" on public.bookings for insert with check (auth.uid() = customer_id);
create policy "bookings parties update"  on public.bookings for update
  using (auth.uid() = customer_id or auth.uid() = professional_id);

create policy "line items parties read" on public.booking_line_items for select using (
  exists (select 1 from public.bookings b where b.id = booking_id
          and (b.customer_id = auth.uid() or b.professional_id = auth.uid())));
create policy "status events parties read" on public.booking_status_events for select using (
  exists (select 1 from public.bookings b where b.id = booking_id
          and (b.customer_id = auth.uid() or b.professional_id = auth.uid())));

-- ---------- PAYMENTS (sensitive) ----------
create policy "payments party read"   on public.payments for select using (
  exists (select 1 from public.bookings b where b.id = booking_id
          and (b.customer_id = auth.uid() or b.professional_id = auth.uid()))
  or public.is_admin(auth.uid()));
create policy "refunds party read"    on public.refunds for select using (
  exists (select 1 from public.bookings b where b.id = booking_id
          and (b.customer_id = auth.uid() or b.professional_id = auth.uid()))
  or public.is_admin(auth.uid()));
create policy "payouts pro read"      on public.payout_records for select
  using (auth.uid() = professional_id or public.is_admin(auth.uid()));

-- ---------- REVIEWS ----------
create policy "reviews public read"   on public.reviews for select
  using (is_published or auth.uid() = customer_id or auth.uid() = professional_id);
create policy "reviews customer create" on public.reviews for insert with check (auth.uid() = customer_id);
create policy "reviews respond"       on public.reviews for update
  using (auth.uid() = professional_id or auth.uid() = customer_id)
  with check (auth.uid() = professional_id or auth.uid() = customer_id);

-- ---------- MESSAGING ----------
create policy "convo members read"    on public.conversations for select using (
  exists (select 1 from public.conversation_members m where m.conversation_id = id and m.user_id = auth.uid()));
create policy "convo membership read" on public.conversation_members for select
  using (user_id = auth.uid() or exists (
    select 1 from public.conversation_members m2 where m2.conversation_id = conversation_id and m2.user_id = auth.uid()));
create policy "messages members read" on public.messages for select using (
  exists (select 1 from public.conversation_members m where m.conversation_id = conversation_id and m.user_id = auth.uid()));
create policy "messages members send" on public.messages for insert with check (
  sender_id = auth.uid() and exists (
    select 1 from public.conversation_members m where m.conversation_id = conversation_id and m.user_id = auth.uid()));

-- ---------- NOTIFICATIONS ----------
create policy "notif own read"        on public.notifications for select using (auth.uid() = user_id);
create policy "notif own update"      on public.notifications for update using (auth.uid() = user_id);

-- ---------- PROMOS ----------
create policy "promo public read"     on public.promo_codes for select using (is_active);
create policy "promo redemption own"  on public.promo_redemptions for select using (auth.uid() = customer_id);

-- ===== supabase/migrations/0004_marketplace.sql =====
-- ============================================================
-- iGlamHer — 0004 Marketplace (Phase 3)
-- Profile enrichment, portfolio moderation, recently-viewed,
-- search/trigram/FTS indexes, and tightened public-read RLS.
-- Append-only: assumes 0001–0003 already applied.
-- ============================================================

create extension if not exists pg_trgm;

-- ---------- professional_profiles: public-profile fields ----------
alter table public.professional_profiles
  add column if not exists avatar_url        text,
  add column if not exists primary_specialty text,
  add column if not exists specialties       text[] not null default '{}',
  add column if not exists years_experience  integer check (years_experience is null or years_experience >= 0),
  add column if not exists languages         text[] not null default '{}',
  add column if not exists city              text,
  add column if not exists postal_code       text,
  add column if not exists instant_book      boolean not null default false,
  add column if not exists timezone          text not null default 'America/Los_Angeles',
  add column if not exists min_notice_minutes integer not null default 120,
  add column if not exists max_window_days    integer not null default 60,
  add column if not exists last_active_at    timestamptz not null default now();

-- Full-text search document. Generated => always consistent, never stale.
--
-- A generated column requires a strictly IMMUTABLE expression. Two things in
-- the obvious formulation are not:
--   * a bare 'simple' literal resolves to to_tsvector(text), which is STABLE
--     (it depends on default_text_search_config) -- hence the ::regconfig cast;
--   * array_to_string(anyarray, text) is marked STABLE because element output
--     functions may be, even though it is effectively immutable for text[].
-- Wrapping the whole expression in an IMMUTABLE SQL function is the standard
-- resolution and keeps the column definition readable.
create or replace function public.professional_search_document(
  business_name     text,
  primary_specialty text,
  headline          text,
  specialties       text[],
  city              text,
  bio               text
) returns tsvector as $$
  select setweight(to_tsvector('simple'::regconfig, coalesce(business_name, '')), 'A') ||
         setweight(to_tsvector('simple'::regconfig, coalesce(primary_specialty, '')), 'B') ||
         setweight(to_tsvector('simple'::regconfig, coalesce(headline, '')), 'B') ||
         setweight(to_tsvector('simple'::regconfig, coalesce(array_to_string(specialties, ' '), '')), 'B') ||
         setweight(to_tsvector('simple'::regconfig, coalesce(city, '')), 'C') ||
         setweight(to_tsvector('simple'::regconfig, coalesce(bio, '')), 'D');
$$ language sql immutable;

alter table public.professional_profiles
  add column if not exists search_document tsvector
  generated always as (
    public.professional_search_document(
      business_name, primary_specialty, headline, specialties, city, bio
    )
  ) stored;

-- ---------- services: buffer sanity + instant-book + travel fee ----------
alter table public.services
  add column if not exists instant_book      boolean not null default false,
  add column if not exists travel_fee_cents  integer check (travel_fee_cents is null or travel_fee_cents >= 0);

do $$ begin
  alter table public.services
    add constraint services_buffer_before_sane check (buffer_before_minutes between 0 and 240);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.services
    add constraint services_buffer_after_sane check (buffer_after_minutes between 0 and 240);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.services
    add constraint services_duration_sane check (duration_minutes between 1 and 1440);
exception when duplicate_object then null; end $$;

-- ---------- portfolio: moderation, cover, association ----------
alter table public.professional_portfolio_items
  add column if not exists is_hidden   boolean not null default false,   -- admin can hide
  add column if not exists is_cover    boolean not null default false,
  add column if not exists service_id  uuid references public.services(id) on delete set null,
  add column if not exists category_id uuid references public.categories(id) on delete set null,
  add column if not exists width        integer,
  add column if not exists height       integer;

-- At most one cover per professional.
create unique index if not exists portfolio_one_cover_per_pro
  on public.professional_portfolio_items (professional_id)
  where is_cover;

-- ---------- recently viewed ----------
create table if not exists public.recently_viewed (
  customer_id     uuid not null references public.profiles(id) on delete cascade,
  professional_id uuid not null references public.professional_profiles(user_id) on delete cascade,
  viewed_at       timestamptz not null default now(),
  primary key (customer_id, professional_id)
);
create index if not exists recently_viewed_by_time
  on public.recently_viewed (customer_id, viewed_at desc);

alter table public.recently_viewed enable row level security;
do $$ begin
  create policy "recently_viewed own" on public.recently_viewed for all
    using (auth.uid() = customer_id) with check (auth.uid() = customer_id);
exception when duplicate_object then null; end $$;

-- ---------- search + filter indexes (no unindexed scans under load) ----------
create index if not exists pro_search_fts     on public.professional_profiles using gin (search_document);
create index if not exists pro_business_trgm   on public.professional_profiles using gin (business_name gin_trgm_ops);
create index if not exists pro_city_trgm       on public.professional_profiles using gin (city gin_trgm_ops);
create index if not exists pro_active_idx       on public.professional_profiles (is_active) where is_active;
create index if not exists pro_featured_idx     on public.professional_profiles (is_featured) where is_featured;
create index if not exists pro_rating_idx       on public.professional_profiles (rating_average desc);
create index if not exists pro_geo_gix          on public.professional_profiles using gist (geo);

create index if not exists services_name_trgm   on public.services using gin (name gin_trgm_ops);
create index if not exists services_pro_idx      on public.services (professional_id) where is_active and deleted_at is null;
create index if not exists services_category_idx on public.services (category_id) where is_active and deleted_at is null;
create index if not exists portfolio_pro_idx     on public.professional_portfolio_items (professional_id) where not is_hidden;
create index if not exists favorites_pro_idx     on public.favorites (professional_id);

-- ---------- tighten portfolio public read: active pro + not hidden ----------
drop policy if exists "portfolio public read" on public.professional_portfolio_items;
create policy "portfolio public read" on public.professional_portfolio_items for select
  using (
    not is_hidden and exists (
      select 1 from public.professional_profiles p
      where p.user_id = professional_id and p.is_active
    )
    or auth.uid() = professional_id
    or public.is_admin(auth.uid())
  );

-- ===== supabase/migrations/0005_booking_engine.sql =====
-- ============================================================
-- iGlamHer — 0005 Booking engine, payments, messaging gate
-- Atomic booking creation (no double-booking), saved payment methods,
-- disputes, cancellation reasons, and pre-payment messaging lock.
-- Append-only: assumes 0001–0004 applied.
-- ============================================================

-- ---------- new enums ----------
do $$ begin
  create type public.dispute_status as enum ('open','under_review','resolved_refund','resolved_declined','cancelled');
exception when duplicate_object then null; end $$;

-- ---------- bookings: cancellation reason ----------
alter table public.bookings
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists confirmed_at timestamptz,
  add column if not exists completed_at timestamptz;

-- ---------- saved payment methods (Stripe PM references only) ----------
create table if not exists public.saved_payment_methods (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.profiles(id) on delete cascade,
  stripe_payment_method_id text not null,
  brand         text,
  last4         char(4),
  exp_month     smallint,
  exp_year      smallint,
  is_default    boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (customer_id, stripe_payment_method_id)
);
alter table public.saved_payment_methods enable row level security;
do $$ begin
  create policy "payment methods own" on public.saved_payment_methods for all
    using (auth.uid() = customer_id) with check (auth.uid() = customer_id);
exception when duplicate_object then null; end $$;

-- ---------- disputes ----------
create table if not exists public.disputes (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null references public.bookings(id) on delete cascade,
  opened_by     uuid not null references public.profiles(id),
  reason        text not null,
  detail        text,
  status        public.dispute_status not null default 'open',
  resolution    text,
  resolved_by   uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.disputes enable row level security;
do $$ begin
  create policy "disputes parties read" on public.disputes for select using (
    public.is_admin(auth.uid()) or exists (
      select 1 from public.bookings b
      where b.id = booking_id and (b.customer_id = auth.uid() or b.professional_id = auth.uid())
    )
  );
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "disputes party open" on public.disputes for insert with check (
    auth.uid() = opened_by and exists (
      select 1 from public.bookings b
      where b.id = booking_id and (b.customer_id = auth.uid() or b.professional_id = auth.uid())
    )
  );
exception when duplicate_object then null; end $$;

-- ---------- messaging gate: unlock only after payment ----------
alter table public.conversations
  add column if not exists is_unlocked boolean not null default false;
alter table public.messages
  add column if not exists flagged boolean not null default false,
  add column if not exists blocked boolean not null default false,
  add column if not exists redacted_body text;

-- ---------- indexes ----------
create index if not exists bookings_customer_idx     on public.bookings (customer_id, starts_at desc);
create index if not exists bookings_pro_idx          on public.bookings (professional_id, starts_at desc);
create index if not exists bookings_status_active_idx on public.bookings (status, starts_at) where status in ('pending_payment','confirmed','in_progress');
create index if not exists bookings_starts_idx       on public.bookings (starts_at);
create index if not exists payments_booking_idx      on public.payments (booking_id);
create index if not exists payouts_pro_idx           on public.payout_records (professional_id, created_at desc);
create index if not exists messages_convo_idx        on public.messages (conversation_id, created_at desc);
create index if not exists disputes_booking_idx      on public.disputes (booking_id);
create index if not exists saved_pm_customer_idx     on public.saved_payment_methods (customer_id);

-- ============================================================
-- Atomic booking creation. The exclusion constraint bookings_no_overlap
-- (on professional_id + time_range where reserves_time) makes concurrent
-- double-booking impossible: the losing transaction gets exclusion_violation,
-- which we surface as a friendly, catchable error.
-- ============================================================
create or replace function public.create_booking(
  p_customer      uuid,
  p_professional  uuid,
  p_service       uuid,
  p_starts_at     timestamptz,
  p_ends_at       timestamptz,
  p_timezone      text,
  p_location_type public.location_type,
  p_service_name  text,
  p_subtotal      integer,
  p_addons        integer,
  p_travel        integer,
  p_tax           integer,
  p_discount      integer,
  p_tip           integer,
  p_fees          integer,
  p_total         integer,
  p_due_now       integer,
  p_platform_fee  integer,
  p_line_items    jsonb,
  p_address       uuid default null,
  p_notes         text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking uuid;
  v_item jsonb;
begin
  -- Only the customer themselves (or an admin) may create their booking.
  if auth.uid() is not null and auth.uid() <> p_customer and not public.is_admin(auth.uid()) then
    raise exception 'not authorized to book for another user';
  end if;

  begin
    insert into public.bookings (
      customer_id, professional_id, service_id, status, starts_at, ends_at,
      timezone, location_type, address_id, service_name_snapshot,
      subtotal_cents, addons_cents, onsite_upcharge_cents, tax_cents,
      discount_cents, tip_cents, fees_cents, total_cents, amount_due_now_cents,
      platform_fee_cents, customer_notes
    ) values (
      p_customer, p_professional, p_service, 'pending_payment', p_starts_at, p_ends_at,
      p_timezone, p_location_type, p_address, p_service_name,
      p_subtotal, p_addons, p_travel, p_tax,
      p_discount, p_tip, p_fees, p_total, p_due_now,
      p_platform_fee, p_notes
    ) returning id into v_booking;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN' using hint = 'That time was just booked. Please pick another slot.';
  end;

  for v_item in select * from jsonb_array_elements(coalesce(p_line_items, '[]'::jsonb)) loop
    insert into public.booking_line_items (booking_id, kind, label, amount_cents)
    values (v_booking, v_item->>'kind', v_item->>'label', (v_item->>'amountCents')::integer);
  end loop;

  insert into public.booking_status_events (booking_id, status, actor_id, note)
  values (v_booking, 'pending_payment', p_customer, 'Booking created');

  return v_booking;
end;
$$;

revoke all on function public.create_booking(uuid,uuid,uuid,timestamptz,timestamptz,text,public.location_type,text,integer,integer,integer,integer,integer,integer,integer,integer,integer,integer,jsonb,uuid,text) from public;
grant execute on function public.create_booking(uuid,uuid,uuid,timestamptz,timestamptz,text,public.location_type,text,integer,integer,integer,integer,integer,integer,integer,integer,integer,integer,jsonb,uuid,text) to authenticated;

-- ===== supabase/migrations/0005_column_guards.sql =====
-- ============================================================================
-- 0005_column_guards.sql
--
-- RLS grants or denies whole ROWS, never columns. Every policy of the form
-- `using (auth.uid() = owner_id)` therefore hands the owner *every* column in
-- that row -- including privilege and money columns the server actions are
-- careful never to write. Supabase exposes PostgREST directly to any holder of
-- the anon key, so the server action is not the only door to these tables.
--
-- These BEFORE UPDATE triggers close that gap, following the idiom already
-- established by public.prevent_role_escalation() in 0002_functions.sql.
-- Privileged writes remain available to the service-role client (used only by
-- src/lib/admin/actions.ts behind requireAdmin()) and to admins.
-- ============================================================================

-- Shared predicate: is the current caller allowed to write privileged columns?
create or replace function public.is_privileged_writer() returns boolean as $$
  select auth.role() = 'service_role' or public.is_admin(auth.uid());
$$ language sql stable security definer set search_path = public;


-- ---------- PROFESSIONAL PROFILES ----------
-- Guards approval (is_active), trust signals (is_verified, is_featured) and the
-- platform's revenue share (take_rate_bps). Without this a customer can PATCH
-- their own row to go live, self-verify, self-feature and set the fee to zero,
-- which also renders the entire /admin approval flow advisory.
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

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_pro_profile_column_guard on public.professional_profiles;
create trigger trg_pro_profile_column_guard
  before update on public.professional_profiles
  for each row execute function public.guard_professional_profile_columns();


-- ---------- BOOKINGS ----------
-- Snapshotted pricing is documented as immutable in 0001_schema.sql; nothing
-- enforced it. Either party could set total_cents/amount_due_now_cents to 0
-- before paying, or flip status to 'completed' (which additionally satisfies
-- the enforce_review_eligibility trigger).
create or replace function public.guard_booking_columns() returns trigger as $$
begin
  if public.is_privileged_writer() then
    return new;
  end if;

  if new.subtotal_cents        is distinct from old.subtotal_cents
  or new.addons_cents          is distinct from old.addons_cents
  or new.onsite_upcharge_cents is distinct from old.onsite_upcharge_cents
  or new.fees_cents            is distinct from old.fees_cents
  or new.tax_cents             is distinct from old.tax_cents
  or new.discount_cents        is distinct from old.discount_cents
  or new.tip_cents             is distinct from old.tip_cents
  or new.total_cents           is distinct from old.total_cents
  or new.amount_due_now_cents  is distinct from old.amount_due_now_cents
  or new.platform_fee_cents    is distinct from old.platform_fee_cents
  or new.currency              is distinct from old.currency
  or new.stripe_payment_intent_id is distinct from old.stripe_payment_intent_id
  or new.cancellation_policy_snapshot is distinct from old.cancellation_policy_snapshot
  or new.service_name_snapshot is distinct from old.service_name_snapshot then
    raise exception 'booking pricing is snapshotted and immutable';
  end if;

  -- Settlement states are reached through payment/completion flows on the
  -- server, never by a party PATCHing the row. Cancellation stays available.
  if new.status is distinct from old.status
     and new.status in ('confirmed', 'in_progress', 'completed', 'refunded', 'disputed') then
    raise exception 'booking status % is set by the platform only', new.status;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_booking_column_guard on public.bookings;
create trigger trg_booking_column_guard
  before update on public.bookings
  for each row execute function public.guard_booking_columns();


-- ---------- REVIEWS ----------
-- The "reviews respond" policy intends to let a professional write
-- professional_response, but RLS cannot scope to a column: it also allowed them
-- to rewrite rating, blank body, or unpublish criticism -- after which the
-- refresh_professional_rating trigger recomputes the average from the forged
-- values.
create or replace function public.guard_review_columns() returns trigger as $$
begin
  if public.is_privileged_writer() then
    return new;
  end if;

  -- Publication state is never author-controlled (neither party may bury or
  -- resurrect a review).
  if new.is_published is distinct from old.is_published then
    raise exception 'review publication state is controlled by the platform';
  end if;

  -- The subject of a review may only append their response.
  if auth.uid() = old.professional_id then
    if new.rating      is distinct from old.rating
    or new.body        is distinct from old.body
    or new.customer_id is distinct from old.customer_id
    or new.booking_id  is distinct from old.booking_id then
      raise exception 'a professional may only write professional_response';
    end if;
  end if;

  -- The author may revise their own rating/body, but not answer for the pro.
  if auth.uid() = old.customer_id and auth.uid() is distinct from old.professional_id then
    if new.professional_response is distinct from old.professional_response then
      raise exception 'only the professional may write professional_response';
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_review_column_guard on public.reviews;
create trigger trg_review_column_guard
  before update on public.reviews
  for each row execute function public.guard_review_columns();


-- ---------- AVAILABILITY (tighten `using (true)`) ----------
-- 0003_rls.sql:79,82 exposed the full schedules of unapproved, suspended and
-- soft-deleted professionals. Mirrors the portfolio policy from
-- 0004_marketplace.sql:101-110.
drop policy if exists "avail rules read" on public.availability_rules;
create policy "avail rules read" on public.availability_rules for select
  using (
    exists (
      select 1 from public.professional_profiles p
      where p.user_id = availability_rules.professional_id
        and (p.is_active or auth.uid() = p.user_id or public.is_admin(auth.uid()))
    )
  );

drop policy if exists "avail exc read" on public.availability_exceptions;
create policy "avail exc read" on public.availability_exceptions for select
  using (
    exists (
      select 1 from public.professional_profiles p
      where p.user_id = availability_exceptions.professional_id
        and (p.is_active or auth.uid() = p.user_id or public.is_admin(auth.uid()))
    )
  );


-- ---------- PROMO CODES ----------
-- `using (is_active)` let anonymous users enumerate every live promo code.
drop policy if exists "promo public read" on public.promo_codes;
create policy "promo read" on public.promo_codes for select
  using (public.is_admin(auth.uid()));

-- ===== supabase/migrations/0006_trust_safety.sql =====
-- ============================================================
-- iGlamHer — 0006 Trust, Safety & Operations
-- Verification, multi-dimension reviews, reports/moderation, blocks,
-- privacy, fraud flags, dispute evidence/timeline, reliability metrics.
-- Append-only: assumes 0001–0005 applied.
-- ============================================================

-- ---------- enum extensions ----------
alter type public.verification_status add value if not exists 'more_info_requested';
alter type public.verification_status add value if not exists 'suspended';
alter type public.verification_status add value if not exists 'revoked';

alter type public.dispute_status add value if not exists 'awaiting_response';
alter type public.dispute_status add value if not exists 'under_investigation';
alter type public.dispute_status add value if not exists 'closed';

-- ---------- new enums ----------
do $$ begin
  create type public.report_reason as enum
    ('harassment','fraud','spam','inappropriate','fake_profile','safety','copyright','other');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.report_status as enum ('open','reviewing','actioned','dismissed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.fraud_status as enum ('flagged','reviewing','cleared','actioned');
exception when duplicate_object then null; end $$;

-- ---------- provider verification (documents + trust flags) ----------
alter table public.professional_verifications
  add column if not exists selfie_url           text,
  add column if not exists business_license_url text,
  add column if not exists insurance_url        text,
  add column if not exists license_verified     boolean not null default false,
  add column if not exists insured              boolean not null default false,
  add column if not exists background_checked   boolean not null default false,
  add column if not exists requested_info       text,
  add column if not exists expires_at           timestamptz;

-- ---------- reliability + safety flags on profiles ----------
alter table public.professional_profiles
  add column if not exists reliability_score        integer not null default 80,
  add column if not exists acceptance_rate          numeric(5,2),
  add column if not exists completion_rate          numeric(5,2),
  add column if not exists cancellation_rate        numeric(5,2),
  add column if not exists require_verified_customers boolean not null default false,
  add column if not exists is_frozen                boolean not null default false,
  add column if not exists payouts_frozen           boolean not null default false;

alter table public.customer_profiles
  add column if not exists is_id_verified     boolean not null default false,
  add column if not exists verification_status public.verification_status not null default 'unsubmitted',
  add column if not exists id_document_url    text,
  add column if not exists selfie_url         text,
  add column if not exists reliability_score  integer not null default 80,
  add column if not exists cancellation_rate  numeric(5,2),
  add column if not exists is_frozen          boolean not null default false;

-- ---------- multi-dimension reviews ----------
alter table public.reviews
  add column if not exists professionalism smallint check (professionalism between 1 and 5),
  add column if not exists communication   smallint check (communication between 1 and 5),
  add column if not exists punctuality     smallint check (punctuality between 1 and 5),
  add column if not exists cleanliness     smallint check (cleanliness between 1 and 5),
  add column if not exists accuracy        smallint check (accuracy between 1 and 5),
  add column if not exists photo_urls      text[] not null default '{}',
  add column if not exists helpful_count   integer not null default 0,
  add column if not exists is_reported     boolean not null default false;

create table if not exists public.review_helpful_votes (
  review_id uuid not null references public.reviews(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);
alter table public.review_helpful_votes enable row level security;
do $$ begin
  create policy "helpful own" on public.review_helpful_votes for all
    using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- ---------- content reports / moderation queue ----------
create table if not exists public.content_reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null,      -- user | professional | message | review | portfolio
  target_id   uuid not null,
  reason      public.report_reason not null,
  detail      text,
  status      public.report_status not null default 'open',
  resolved_by uuid references public.profiles(id),
  resolution  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.content_reports enable row level security;
do $$ begin
  create policy "reports insert own" on public.content_reports for insert with check (auth.uid() = reporter_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "reports read own or admin" on public.content_reports for select
    using (auth.uid() = reporter_id or public.is_admin(auth.uid()));
exception when duplicate_object then null; end $$;

-- ---------- blocks ----------
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;
do $$ begin
  create policy "blocks by blocker" on public.blocks for all
    using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);
exception when duplicate_object then null; end $$;
-- A user may also read blocks where they are the blocked party (to enforce).
do $$ begin
  create policy "blocks read as blocked" on public.blocks for select using (auth.uid() = blocked_id);
exception when duplicate_object then null; end $$;

-- ---------- privacy settings ----------
create table if not exists public.privacy_settings (
  user_id            uuid primary key references public.profiles(id) on delete cascade,
  profile_visibility text not null default 'public',   -- public | verified_only | private
  allow_messages     boolean not null default true,
  allow_calls        boolean not null default true,
  mute_notifications boolean not null default false,
  updated_at         timestamptz not null default now()
);
alter table public.privacy_settings enable row level security;
do $$ begin
  create policy "privacy own" on public.privacy_settings for all
    using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- ---------- fraud flags (admin/service-role only; RLS on, no client policy = deny) ----------
create table if not exists public.fraud_flags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null,
  score      integer not null default 0,
  severity   text not null default 'low',
  detail     jsonb not null default '{}'::jsonb,
  status     public.fraud_status not null default 'flagged',
  created_at timestamptz not null default now()
);
alter table public.fraud_flags enable row level security;

-- ---------- dispute evidence + timeline ----------
create table if not exists public.dispute_evidence (
  id          uuid primary key default gen_random_uuid(),
  dispute_id  uuid not null references public.disputes(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  url         text not null,
  kind        text not null default 'photo',   -- photo | screenshot | document
  created_at  timestamptz not null default now()
);
create table if not exists public.dispute_events (
  id         uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes(id) on delete cascade,
  actor_id   uuid references public.profiles(id),
  action     text not null,
  note       text,
  created_at timestamptz not null default now()
);
alter table public.dispute_evidence enable row level security;
alter table public.dispute_events enable row level security;
do $$ begin
  create policy "dispute evidence parties" on public.dispute_evidence for select using (
    public.is_admin(auth.uid()) or exists (
      select 1 from public.disputes d join public.bookings b on b.id = d.booking_id
      where d.id = dispute_id and (b.customer_id = auth.uid() or b.professional_id = auth.uid())
    )
  );
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "dispute evidence upload" on public.dispute_evidence for insert with check (auth.uid() = uploaded_by);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "dispute events parties" on public.dispute_events for select using (
    public.is_admin(auth.uid()) or exists (
      select 1 from public.disputes d join public.bookings b on b.id = d.booking_id
      where d.id = dispute_id and (b.customer_id = auth.uid() or b.professional_id = auth.uid())
    )
  );
exception when duplicate_object then null; end $$;

-- ---------- indexes ----------
create index if not exists audit_entity_idx        on public.audit_logs (entity, entity_id);
create index if not exists audit_actor_idx         on public.audit_logs (actor_id, created_at desc);
create index if not exists reports_status_idx      on public.content_reports (status, created_at desc);
create index if not exists reports_target_idx      on public.content_reports (target_type, target_id);
create index if not exists fraud_status_idx        on public.fraud_flags (status, score desc);
create index if not exists verifications_status_idx on public.professional_verifications (status);
create index if not exists blocks_blocked_idx      on public.blocks (blocked_id);
create index if not exists pro_reliability_idx     on public.professional_profiles (reliability_score desc);

-- ===== supabase/migrations/0007_jobs.sql =====
-- ============================================================
-- iGlamHer — 0007 Background jobs (SQL routines + pg_cron schedules)
-- Self-contained maintenance runs; reminder/payout jobs that need Stripe or
-- push are handled by edge functions (see supabase/functions/*), scheduled the
-- same way. Requires pg_cron (+ pg_net for edge invocation) enabled in Supabase.
-- Append-only: assumes 0001–0006 applied.
-- ============================================================

-- ---------- routines ----------

-- Abandoned-booking cleanup: release slots held by unpaid drafts after 30 min.
create or replace function public.expire_stale_pending_bookings() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with expired as (
    update public.bookings
       set status = 'cancelled_customer',
           cancelled_at = now(),
           cancellation_reason = 'Abandoned — payment not completed'
     where status = 'pending_payment'
       and created_at < now() - interval '30 minutes'
    returning id
  )
  insert into public.booking_status_events (booking_id, status, note)
  select id, 'cancelled_customer', 'Auto-cancelled: abandoned booking' from expired;
  get diagnostics n = row_count;
  return n;
end; $$;

-- Verification expiry: flag verifications whose expires_at has passed.
create or replace function public.expire_verifications() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update public.professional_verifications
     set status = 'more_info_requested',
         requested_info = 'Verification expired — please re-submit documents',
         updated_at = now()
   where status = 'approved' and expires_at is not null and expires_at < now();
  get diagnostics n = row_count;
  update public.professional_profiles p set is_verified = false
   from public.professional_verifications v
   where v.professional_id = p.user_id and v.status = 'more_info_requested' and v.expires_at < now();
  return n;
end; $$;

-- Reliability rescore: recompute cancellation_rate + reliability_score from bookings.
create or replace function public.recompute_reliability() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with stats as (
    select professional_id,
           count(*) filter (where status = 'completed')::numeric as completed,
           count(*) filter (where status in ('cancelled_professional'))::numeric as pro_cancelled,
           count(*) filter (where status in ('completed','cancelled_professional','no_show','confirmed','in_progress'))::numeric as total
    from public.bookings group by professional_id
  )
  update public.professional_profiles p
     set cancellation_rate = case when s.total > 0 then round(100 * s.pro_cancelled / s.total, 2) else 0 end,
         completion_rate    = case when s.total > 0 then round(100 * s.completed / s.total, 2) else 0 end,
         reliability_score  = greatest(0, least(100,
            round(80
                  + (case when s.total > 0 then 20 * s.completed / s.total else 0 end)
                  - (case when s.total > 0 then 40 * s.pro_cancelled / s.total else 0 end))::int))
    from stats s where s.professional_id = p.user_id;
  get diagnostics n = row_count;
  return n;
end; $$;

-- ---------- schedules (no-op if pg_cron is not installed) ----------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('expire-stale-bookings', '*/10 * * * *', 'select public.expire_stale_pending_bookings();');
    perform cron.schedule('expire-verifications',  '0 3 * * *',    'select public.expire_verifications();');
    perform cron.schedule('recompute-reliability', '0 * * * *',    'select public.recompute_reliability();');
  end if;
exception when others then
  raise notice 'pg_cron not available; schedule these jobs manually or via edge functions.';
end $$;

-- ===== supabase/migrations/0008_growth.sql =====
-- ============================================================
-- iGlamHer — 0008 Growth engine
-- Loyalty (iGlam Rewards), referrals, marketing campaigns, analytics events,
-- account credits. Append-only: assumes 0001–0007 applied.
-- ============================================================

-- ---------- analytics events (server-side event log for the funnel) ----------
create table if not exists public.analytics_events (
  id         bigint generated always as identity primary key,
  user_id    uuid references public.profiles(id) on delete set null,
  event      text not null,
  props      jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists analytics_events_event_idx on public.analytics_events (event, created_at desc);
create index if not exists analytics_events_user_idx  on public.analytics_events (user_id, created_at desc);
alter table public.analytics_events enable row level security;
do $$ begin
  create policy "analytics insert self" on public.analytics_events for insert
    with check (user_id is null or auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "analytics admin read" on public.analytics_events for select using (public.is_admin(auth.uid()));
exception when duplicate_object then null; end $$;

-- ---------- loyalty (iGlam Rewards) ----------
create table if not exists public.loyalty_accounts (
  user_id         uuid primary key references public.profiles(id) on delete cascade,
  points          integer not null default 0 check (points >= 0),
  lifetime_points integer not null default 0 check (lifetime_points >= 0),
  tier            text not null default 'bronze',
  updated_at      timestamptz not null default now()
);
create table if not exists public.loyalty_transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  points_delta integer not null,
  reason       text not null,        -- earn_booking | milestone | birthday | redeem | referral
  booking_id   uuid references public.bookings(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists loyalty_tx_user_idx on public.loyalty_transactions (user_id, created_at desc);
alter table public.loyalty_accounts enable row level security;
alter table public.loyalty_transactions enable row level security;
do $$ begin
  create policy "loyalty acct own read" on public.loyalty_accounts for select using (auth.uid() = user_id or public.is_admin(auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "loyalty tx own read" on public.loyalty_transactions for select using (auth.uid() = user_id or public.is_admin(auth.uid()));
exception when duplicate_object then null; end $$;
-- writes happen via service role (server) only.

-- ---------- account credits (referral rewards, redemptions, goodwill) ----------
create table if not exists public.account_credits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  amount_cents integer not null,          -- positive = credit granted, negative = spent
  reason      text not null,
  created_at  timestamptz not null default now()
);
create index if not exists account_credits_user_idx on public.account_credits (user_id, created_at desc);
alter table public.account_credits enable row level security;
do $$ begin
  create policy "credits own read" on public.account_credits for select using (auth.uid() = user_id or public.is_admin(auth.uid()));
exception when duplicate_object then null; end $$;

-- ---------- referrals ----------
create table if not exists public.referral_codes (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  code       text unique not null,
  kind       text not null default 'customer',   -- customer | professional
  created_at timestamptz not null default now()
);
create index if not exists referral_codes_code_idx on public.referral_codes (code);
create table if not exists public.referrals (
  id          uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null references public.profiles(id) on delete cascade,
  code        text not null,
  kind        text not null default 'customer',
  status      text not null default 'pending',   -- pending | qualified | rewarded | rejected
  rewarded_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (referred_id)                            -- a user can only be referred once
);
create index if not exists referrals_referrer_idx on public.referrals (referrer_id, created_at desc);
alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
do $$ begin
  create policy "referral code own" on public.referral_codes for all
    using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "referrals party read" on public.referrals for select
    using (auth.uid() = referrer_id or auth.uid() = referred_id or public.is_admin(auth.uid()));
exception when duplicate_object then null; end $$;

-- ---------- marketing campaigns ----------
create table if not exists public.campaigns (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  type          text not null,                -- coupon | seasonal | geo | abandoned_booking | influencer
  discount_type text not null,                -- percent | fixed
  discount_value integer not null,
  is_active     boolean not null default true,
  starts_at     timestamptz,
  ends_at       timestamptz,
  cities        text[] not null default '{}',
  min_subtotal_cents integer,
  ab_treatment_fraction numeric(4,3),
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now()
);
create index if not exists campaigns_active_idx on public.campaigns (is_active) where is_active;
create table if not exists public.campaign_redemptions (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  booking_id  uuid references public.bookings(id) on delete set null,
  discount_cents integer not null,
  created_at  timestamptz not null default now()
);
create index if not exists campaign_redemptions_campaign_idx on public.campaign_redemptions (campaign_id);
alter table public.campaigns enable row level security;
alter table public.campaign_redemptions enable row level security;
do $$ begin
  create policy "campaigns public read active" on public.campaigns for select
    using (is_active or public.is_admin(auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "campaign redemptions own read" on public.campaign_redemptions for select
    using (auth.uid() = user_id or public.is_admin(auth.uid()));
exception when duplicate_object then null; end $$;

-- ===== supabase/migrations/0009_launch_ops.sql =====
-- ============================================================
-- iGlamHer — 0009 Launch operations
-- Webhook idempotency, platform runtime settings (beta/maintenance/shutdown),
-- Stripe Connect payout fields + earnings ledger, beta access codes.
-- Append-only, safe on fresh/staging/production. No data destruction.
-- ============================================================

-- ---------- webhook idempotency / duplicate-event protection ----------
-- The webhook records every Stripe event id here BEFORE processing side effects.
-- A duplicate/retried event conflicts on the PK and is skipped → exactly-once.
create table if not exists public.stripe_events (
  id           text primary key,          -- Stripe event id (evt_...)
  type         text not null,
  processed_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;  -- server/service-role only

-- ---------- platform runtime settings (single source of truth) ----------
create table if not exists public.platform_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);
alter table public.platform_settings enable row level security;
do $$ begin
  create policy "settings public read" on public.platform_settings for select using (true);
exception when duplicate_object then null; end $$;
-- writes via service role (admin actions) only.
insert into public.platform_settings (key, value) values
  ('maintenance_mode', '{"enabled": false, "message": ""}'::jsonb),
  ('bookings_paused',  '{"enabled": false}'::jsonb),
  ('payments_paused',  '{"enabled": false}'::jsonb),
  ('beta',             '{"enabled": false, "invite_only": false, "capacity": null}'::jsonb)
on conflict (key) do nothing;

-- ---------- Stripe Connect payout state on the professional ----------
alter table public.professional_profiles
  add column if not exists connect_details_submitted boolean not null default false,
  add column if not exists connect_charges_enabled   boolean not null default false,
  add column if not exists connect_payouts_enabled   boolean not null default false,
  add column if not exists connect_onboarded_at       timestamptz;

-- ---------- provider earnings ledger (pending → available → paid) ----------
create table if not exists public.earnings_ledger (
  id              uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(user_id) on delete cascade,
  booking_id      uuid references public.bookings(id) on delete set null,
  kind            text not null,          -- earning | refund_adjustment | payout
  amount_cents    integer not null,       -- signed: +earning, -refund/-payout
  status          text not null default 'pending',   -- pending | available | paid
  available_at    timestamptz,
  created_at      timestamptz not null default now(),
  unique (booking_id, kind)               -- one earning/adjustment per booking+kind (idempotent)
);
create index if not exists earnings_pro_idx on public.earnings_ledger (professional_id, status, created_at desc);
alter table public.earnings_ledger enable row level security;
do $$ begin
  create policy "earnings own read" on public.earnings_ledger for select
    using (auth.uid() = professional_id or public.is_admin(auth.uid()));
exception when duplicate_object then null; end $$;

-- ---------- beta access codes ----------
create table if not exists public.beta_access_codes (
  code        text primary key,
  note        text,
  max_uses    integer not null default 1,
  uses        integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table public.beta_access_codes enable row level security;  -- validated server-side only

create table if not exists public.beta_invites (
  id         uuid primary key default gen_random_uuid(),
  email      text,
  code       text references public.beta_access_codes(code),
  user_id    uuid references public.profiles(id),
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.beta_invites enable row level security;
do $$ begin
  create policy "beta invite own read" on public.beta_invites for select
    using (auth.uid() = user_id or public.is_admin(auth.uid()));
exception when duplicate_object then null; end $$;

-- ===== supabase/migrations/0010_mobile.sql =====
-- ============================================================
-- iGlamHer — 0010 Mobile (push device tokens + notification preferences)
-- Backend the native iOS/Android apps register against. Append-only, safe.
-- ============================================================

-- ---------- push device tokens (APNs / FCM / Web Push) ----------
create table if not exists public.device_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  token      text not null,
  platform   text not null,               -- ios | android | web
  device_name text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, token)
);
create index if not exists device_tokens_user_idx on public.device_tokens (user_id);
alter table public.device_tokens enable row level security;
do $$ begin
  create policy "device tokens own" on public.device_tokens for all
    using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- ---------- notification preferences (granular per-channel/type) ----------
create table if not exists public.notification_preferences (
  user_id            uuid primary key references public.profiles(id) on delete cascade,
  push_enabled       boolean not null default true,
  email_enabled      boolean not null default true,
  sms_enabled        boolean not null default false,
  booking_updates    boolean not null default true,
  messages           boolean not null default true,
  reminders          boolean not null default true,
  promotions         boolean not null default true,
  payout_updates     boolean not null default true,
  updated_at         timestamptz not null default now()
);
alter table public.notification_preferences enable row level security;
do $$ begin
  create policy "notif prefs own" on public.notification_preferences for all
    using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- ===== supabase/seed.sql =====
-- ============================================================
-- iGlamHer — deterministic seed (categories + promo).
-- Test AUTH accounts + sample professionals are created by
-- scripts/seed.ts (uses the Supabase admin API). See README.
-- ============================================================
insert into public.categories (id, slug, name, description, sort_order) values
  ('11111111-1111-1111-1111-111111111101','hair','Hair','Cuts, silk press, braids, installs, blowouts',1),
  ('11111111-1111-1111-1111-111111111102','makeup','Makeup','Soft glam, full glam, bridal',2),
  ('11111111-1111-1111-1111-111111111103','lashes','Lashes','Classic, hybrid, volume, fills',3),
  ('11111111-1111-1111-1111-111111111104','stylist','Stylist','Personal & event styling, closet edits',4)
on conflict (id) do nothing;

insert into public.promo_codes (code, description, discount_type, discount_value, is_active) values
  ('GLOWUP15','15% off your first booking','percent',15,true)
on conflict (code) do nothing;

-- ===== supabase/storage-policies.sql =====
-- ============================================================
-- iGlamHer — Storage buckets + policies
-- Run after creating the project. Buckets can also be created in the dashboard;
-- this keeps them reproducible. Storage objects are AES-256 encrypted at rest.
-- ============================================================

-- Private bucket for verification documents (IDs, licenses, insurance, selfies).
insert into storage.buckets (id, name, public)
values ('verification-documents', 'verification-documents', false)
on conflict (id) do nothing;

-- Public bucket for portfolio media (public read, owner write).
insert into storage.buckets (id, name, public)
values ('portfolio', 'portfolio', true)
on conflict (id) do nothing;

-- ---------- verification-documents: NO public read ----------
-- Owners may write only under their own {user_id}/ prefix; reads happen only via
-- admin-minted signed URLs (service role), never a client SELECT.
do $$ begin
  create policy "verif docs owner write" on storage.objects for insert to authenticated
    with check (bucket_id = 'verification-documents' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "verif docs owner read own" on storage.objects for select to authenticated
    using (bucket_id = 'verification-documents' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;
-- Admins read all verification docs.
do $$ begin
  create policy "verif docs admin read" on storage.objects for select to authenticated
    using (bucket_id = 'verification-documents' and public.is_admin(auth.uid()));
exception when duplicate_object then null; end $$;

-- ---------- portfolio: public read, owner write under own prefix ----------
do $$ begin
  create policy "portfolio public read" on storage.objects for select
    using (bucket_id = 'portfolio');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "portfolio owner write" on storage.objects for insert to authenticated
    with check (bucket_id = 'portfolio' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "portfolio owner update" on storage.objects for update to authenticated
    using (bucket_id = 'portfolio' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "portfolio owner delete" on storage.objects for delete to authenticated
    using (bucket_id = 'portfolio' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;



-- ===== supabase/migrations/0011_phase10_fixes.sql =====
-- Phase 10 — production hardening.
-- 1) Atomic loyalty redemption (removes the read-check-write race / double-spend).
-- 2) Referral audit log for fraud decisions.

-- ---------- atomic loyalty redemption ----------
-- Conditional debit: the UPDATE ... WHERE points >= cost row-locks the account,
-- so two concurrent redemptions can never both succeed — the second sees the
-- already-decremented balance and fails the guard. All three writes commit as
-- one transaction (function body), so credit is only granted if the debit stuck.
create or replace function public.redeem_loyalty_points(
  p_user uuid,
  p_cost integer,
  p_credit_cents integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining integer;
begin
  if p_cost <= 0 or p_credit_cents <= 0 then
    return false;
  end if;

  update public.loyalty_accounts
     set points = points - p_cost,
         updated_at = now()
   where user_id = p_user
     and points >= p_cost
  returning points into v_remaining;

  if not found then
    return false; -- insufficient points (or no account) — nothing changed
  end if;

  insert into public.loyalty_transactions (user_id, points_delta, reason)
    values (p_user, -p_cost, 'redeem');

  insert into public.account_credits (user_id, amount_cents, reason)
    values (p_user, p_credit_cents, 'loyalty_redemption');

  return true;
end;
$$;

revoke all on function public.redeem_loyalty_points(uuid, integer, integer) from public;
-- Only the service-role (server) may invoke it; app calls it via the admin client.
do $$ begin
  revoke all on function public.redeem_loyalty_points(uuid, integer, integer) from anon, authenticated;
exception when undefined_object then null; end $$;

-- ---------- referral fraud audit log ----------
create table if not exists public.referral_audit (
  id          uuid primary key default gen_random_uuid(),
  referred_id uuid references public.profiles(id) on delete set null,
  referrer_id uuid references public.profiles(id) on delete set null,
  code        text,
  ip          text,
  decision    text not null,                 -- accepted | rejected
  reasons     text[] not null default '{}',
  created_at  timestamptz not null default now()
);
create index if not exists referral_audit_referrer_idx on public.referral_audit (referrer_id, created_at desc);
create index if not exists referral_audit_ip_idx on public.referral_audit (ip, created_at desc);
alter table public.referral_audit enable row level security;
do $$ begin
  create policy "referral audit admin read" on public.referral_audit for select using (public.is_admin(auth.uid()));
exception when duplicate_object then null; end $$;
-- writes happen via service role (server) only.


-- ===== supabase/migrations/0012_payout_transfers.sql =====
-- Phase 11 — Stripe Connect payout transfers.
-- Tracks each transfer of a professional's net earning to their connected account
-- (separate charges + transfers model). One row per booking (idempotent), with
-- status/failure tracking for reconciliation and failed-payout recovery.

create table if not exists public.payout_transfers (
  id                 uuid primary key default gen_random_uuid(),
  booking_id         uuid not null references public.bookings(id) on delete cascade,
  professional_id    uuid not null references public.professional_profiles(user_id) on delete cascade,
  stripe_transfer_id text unique,
  amount_cents       integer not null check (amount_cents >= 0),
  status             text not null default 'pending',   -- pending | paid | failed | reversed
  failure_reason     text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (booking_id)                                    -- exactly one payout per booking
);
create index if not exists payout_transfers_pro_idx on public.payout_transfers (professional_id, created_at desc);
create index if not exists payout_transfers_status_idx on public.payout_transfers (status, created_at desc);

alter table public.payout_transfers enable row level security;
do $$ begin
  create policy "payout_transfers own read" on public.payout_transfers
    for select using (auth.uid() = professional_id or public.is_admin(auth.uid()));
exception when duplicate_object then null; end $$;
-- All writes happen via the service-role (server) only — webhook + retry action.


-- ===== supabase/migrations/0013_fix_messaging_rls.sql =====
-- Phase 12 — fix infinite recursion (Postgres 42P17) in messaging RLS.
--
-- The original "convo membership read" policy on conversation_members referenced
-- conversation_members inside its own USING clause, so evaluating it re-triggered
-- itself → infinite recursion. That error propagated to the conversations and
-- messages policies (whose subqueries read conversation_members), which meant
-- ALL messaging reads failed at runtime for authenticated users.
--
-- A member only needs to read their OWN membership rows; the app resolves the
-- other party from the booking (customer_id / professional_id), never from other
-- members' rows. So the correct, non-recursive policy is simply user_id = auth.uid().

drop policy if exists "convo membership read" on public.conversation_members;

do $$ begin
  create policy "convo membership read" on public.conversation_members
    for select using (user_id = auth.uid());
exception when duplicate_object then null; end $$;


-- ============================================================
-- 0014_create_conversation_on_booking.sql
-- ============================================================
-- Phase 12 — make messaging reachable: auto-create a conversation per booking.
--
-- ROOT CAUSE (found during Phase 12 live verification):
--   The messaging feature was fully built EXCEPT the step that creates the
--   conversation. Schema (conversations/conversation_members/messages), RLS,
--   the unlock-on-payment webhook, sendMessageAction, and the /messages UI all
--   exist — but nothing ever INSERTs a conversation row. create_booking() does
--   not create one, and there was no trigger. Result: 0 conversations in prod,
--   so no user could ever start or receive a message even though every other
--   layer works. (Verified: with a conversation present, send+read+RLS all pass
--   end-to-end on the live app.)
--
-- FIX: one conversation per booking, created automatically when the booking is
-- inserted, with both parties as members. This matches the existing design —
-- conversations.booking_id is UNIQUE, and the webhook already flips is_unlocked
-- on payment. Pre-payment contact is still gated by sendMessageAction's guard.
--
-- Safe: additive only. No table/data is dropped. Idempotent (on conflict do
-- nothing + create-or-replace). Includes a backfill for bookings that predate
-- this migration.

-- ---------- trigger function ----------
create or replace function public.create_booking_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_convo uuid;
begin
  -- one conversation per booking (booking_id is unique)
  insert into public.conversations (booking_id)
    values (new.id)
    on conflict (booking_id) do nothing
    returning id into v_convo;

  if v_convo is null then
    select id into v_convo from public.conversations where booking_id = new.id;
  end if;

  -- both parties are members. professional_id references professional_profiles
  -- (user_id), which is itself a profiles.id, so it is a valid member user_id.
  insert into public.conversation_members (conversation_id, user_id)
    values (v_convo, new.customer_id),
           (v_convo, new.professional_id)
    on conflict (conversation_id, user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_booking_conversation on public.bookings;
create trigger trg_booking_conversation
  after insert on public.bookings
  for each row execute function public.create_booking_conversation();

-- ---------- backfill existing bookings ----------
-- create a conversation for every booking that lacks one
insert into public.conversations (booking_id)
select b.id
from public.bookings b
left join public.conversations c on c.booking_id = b.id
where c.id is null
on conflict (booking_id) do nothing;

-- ensure both members exist on every booking's conversation
insert into public.conversation_members (conversation_id, user_id)
select c.id, b.customer_id
from public.conversations c
join public.bookings b on b.id = c.booking_id
on conflict (conversation_id, user_id) do nothing;

insert into public.conversation_members (conversation_id, user_id)
select c.id, b.professional_id
from public.conversations c
join public.bookings b on b.id = c.booking_id
on conflict (conversation_id, user_id) do nothing;

-- unlock conversations whose booking is already paid/confirmed (mirrors the
-- webhook, which only fires on NEW payments and would miss backfilled rows)
update public.conversations c
   set is_unlocked = true
  from public.bookings b
 where b.id = c.booking_id
   and c.is_unlocked = false
   and b.status in ('confirmed', 'completed');
