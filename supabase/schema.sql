-- iGlamHer conceptual starter schema.
-- Claude must convert this into ordered Supabase migrations and expand indexes/RLS.

create extension if not exists "pgcrypto";

create type public.user_role as enum ('customer', 'professional', 'admin', 'support');
create type public.booking_status as enum (
  'pending_payment',
  'confirmed',
  'change_requested',
  'in_progress',
  'completed',
  'cancelled_customer',
  'cancelled_professional',
  'refunded',
  'disputed',
  'no_show'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'customer',
  full_name text,
  avatar_url text,
  phone text,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.professional_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  slug text unique not null,
  business_name text not null,
  bio text,
  is_active boolean not null default false,
  is_verified boolean not null default false,
  service_radius_miles numeric(6,2),
  stripe_account_id text unique,
  rating_average numeric(3,2) not null default 0,
  review_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  image_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(user_id),
  category_id uuid references public.categories(id),
  name text not null,
  description text,
  duration_minutes integer not null check (duration_minutes > 0),
  price_cents integer not null check (price_cents >= 0),
  deposit_type text not null default 'full',
  deposit_value integer,
  location_type text not null default 'studio',
  buffer_before_minutes integer not null default 0,
  buffer_after_minutes integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id),
  professional_id uuid not null references public.professional_profiles(user_id),
  service_id uuid not null references public.services(id),
  status public.booking_status not null default 'pending_payment',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null,
  currency char(3) not null default 'USD',
  subtotal_cents integer not null,
  fees_cents integer not null default 0,
  tax_cents integer not null default 0,
  discount_cents integer not null default 0,
  total_cents integer not null,
  amount_due_now_cents integer not null,
  stripe_payment_intent_id text unique,
  cancellation_policy_snapshot jsonb not null default '{}'::jsonb,
  customer_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.booking_line_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  kind text not null,
  label text not null,
  amount_cents integer not null,
  metadata jsonb not null default '{}'::jsonb
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid unique not null references public.bookings(id),
  customer_id uuid not null references public.profiles(id),
  professional_id uuid not null references public.professional_profiles(user_id),
  rating integer not null check (rating between 1 and 5),
  body text,
  professional_response text,
  created_at timestamptz not null default now()
);

create index bookings_professional_start_idx
  on public.bookings(professional_id, starts_at);

create index bookings_customer_start_idx
  on public.bookings(customer_id, starts_at);

-- Production implementation must prevent overlapping active bookings.
-- Recommended: a tstzrange generated column plus exclusion constraint,
-- scoped to statuses that reserve time, or a transaction-safe availability lock.

alter table public.profiles enable row level security;
alter table public.professional_profiles enable row level security;
alter table public.services enable row level security;
alter table public.bookings enable row level security;
alter table public.reviews enable row level security;

-- Claude must implement explicit RLS policies in migrations and test them.
