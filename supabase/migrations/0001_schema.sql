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
