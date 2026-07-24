-- 0034 — Close the address-privacy leak at the database, not the client
--
-- The problem 0033 did NOT fix:
--   `0003_rls.sql` grants "pro public read" on professional_profiles for every
--   active pro, and that policy is ROW-level only — it places no restriction on
--   which COLUMNS come back. Application code redacting `studio_address` in
--   `mapPro()` protects the Next.js render path and nothing else: anon or
--   authenticated callers can hit PostgREST directly and
--   `select=studio_address,location_lat,location_lng` for every active pro.
--
-- Why not column GRANTs: the data layer reads with `select *` (PRO_SELECT).
-- Under column-level privileges `SELECT *` fails outright for the restricted
-- role, so revoking columns would break every public listing query.
--
-- The fix instead REMOVES the secrets from the publicly-readable table. A column
-- that does not exist cannot be selected, by any client, through any policy gap.
--   * exact street address + exact coordinates  -> professional_private_locations
--     (own table, own RLS: owner, admin, and customers with a committed booking)
--   * professional_profiles keeps only COARSE coordinates, so distance ranking
--     and radius filtering keep working without pinpointing anyone's home.

-- ---------- 1. Coarsening helper ----------
-- ~0.01 degrees: about 1.1 km of latitude, ~0.9 km of longitude at LA's
-- latitude. Enough to rank and radius-filter, not enough to find a front door.
create or replace function public.coarsen_coord(v double precision)
returns double precision as $$
  select case when v is null then null else round(v::numeric, 2)::double precision end;
$$ language sql immutable;

comment on function public.coarsen_coord(double precision) is
  'Rounds a coordinate to ~1km. Used to keep publicly-readable coords non-identifying.';

-- ---------- 2. Private location table ----------
create table if not exists public.professional_private_locations (
  user_id        uuid primary key references public.professional_profiles(user_id) on delete cascade,
  studio_address text,
  exact_lat      double precision,
  exact_lng      double precision,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.professional_private_locations is
  'Exact address + coordinates. NEVER publicly readable. Readable by the pro who owns it, admins, and customers holding a committed booking with that pro.';

alter table public.professional_private_locations enable row level security;

-- Backfill from the columns we are about to remove/coarsen. Idempotent.
insert into public.professional_private_locations (user_id, studio_address, exact_lat, exact_lng)
select p.user_id, p.studio_address, p.location_lat, p.location_lng
  from public.professional_profiles p
 where p.studio_address is not null
    or p.location_lat is not null
    or p.location_lng is not null
on conflict (user_id) do nothing;

-- ---------- 3. RLS: owner, admin, entitled booking party ----------
drop policy if exists "private location owner read"  on public.professional_private_locations;
drop policy if exists "private location booked read" on public.professional_private_locations;
drop policy if exists "private location owner write" on public.professional_private_locations;
drop policy if exists "private location owner edit"  on public.professional_private_locations;

create policy "private location owner read"
  on public.professional_private_locations for select
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

-- A customer sees the exact address only once their booking with THIS pro is
-- committed. `confirmed` is set by the payment webhook (never by the customer),
-- so reaching these statuses already implies the booking was paid for.
create policy "private location booked read"
  on public.professional_private_locations for select
  using (
    exists (
      select 1 from public.bookings b
       where b.professional_id = professional_private_locations.user_id
         and b.customer_id = auth.uid()
         and b.status in ('confirmed', 'in_progress', 'completed')
    )
  );

-- The pro maintains their own address; admins may correct it.
create policy "private location owner write"
  on public.professional_private_locations for insert
  with check (auth.uid() = user_id or public.is_admin(auth.uid()));

create policy "private location owner edit"
  on public.professional_private_locations for update
  using (auth.uid() = user_id or public.is_admin(auth.uid()))
  with check (auth.uid() = user_id or public.is_admin(auth.uid()));

create index if not exists ppl_user_idx on public.professional_private_locations (user_id);

-- ---------- 4. Coarsen what stays publicly readable ----------
-- Only pros who asked to hide their pin are coarsened; a pro who opted out
-- (hide_exact_pin = false) has consented to publishing their exact location.
update public.professional_profiles
   set location_lat = public.coarsen_coord(location_lat),
       location_lng = public.coarsen_coord(location_lng)
 where hide_exact_pin is true
   and (location_lat is not null or location_lng is not null);

-- `geo` (geography point, 0001) is a second copy of the same secret and is read
-- by no application code — only the pro_geo_gix index. Coarsen it to match so it
-- cannot be used to recover what we just rounded away.
update public.professional_profiles
   set geo = st_setsrid(
               st_makepoint(public.coarsen_coord(location_lng), public.coarsen_coord(location_lat)),
               4326)::geography
 where hide_exact_pin is true
   and geo is not null
   and location_lat is not null
   and location_lng is not null;

-- ---------- 5. Drop the street address from the public table ----------
-- Preserved in professional_private_locations by step 2 above.
alter table public.professional_profiles drop column if exists studio_address;

-- ---------- 6. Keep public coords coarse on every future write ----------
-- Defence in depth: an admin tool, a seed script, or a future import writing
-- exact coordinates onto the public table silently re-opens the leak. Round at
-- the door instead of trusting every writer to remember.
create or replace function public.coarsen_public_pro_coords() returns trigger as $$
begin
  if new.hide_exact_pin is true then
    new.location_lat := public.coarsen_coord(new.location_lat);
    new.location_lng := public.coarsen_coord(new.location_lng);
    if new.location_lat is not null and new.location_lng is not null then
      new.geo := st_setsrid(st_makepoint(new.location_lng, new.location_lat), 4326)::geography;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_coarsen_public_pro_coords on public.professional_profiles;
create trigger trg_coarsen_public_pro_coords
  before insert or update on public.professional_profiles
  for each row execute function public.coarsen_public_pro_coords();
