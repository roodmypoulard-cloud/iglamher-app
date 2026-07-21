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
