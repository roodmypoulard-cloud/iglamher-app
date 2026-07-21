-- Two-way reviews: customer↔professional, one per booking per direction.
-- Additive & idempotent. No data dropped. Extends the existing reviews table.

do $$ begin
  create type public.review_direction as enum ('customer_to_pro','pro_to_customer');
exception when duplicate_object then null; end $$;

alter table public.reviews
  add column if not exists direction public.review_direction not null default 'customer_to_pro',
  add column if not exists reviewer_id uuid references public.profiles(id),
  add column if not exists rating_quality         integer check (rating_quality between 1 and 5),
  add column if not exists rating_punctuality     integer check (rating_punctuality between 1 and 5),
  add column if not exists rating_professionalism integer check (rating_professionalism between 1 and 5),
  add column if not exists rating_communication   integer check (rating_communication between 1 and 5),
  add column if not exists rating_respectfulness  integer check (rating_respectfulness between 1 and 5);

-- Was: one review per booking (booking_id unique). Now: one per direction.
alter table public.reviews drop constraint if exists reviews_booking_id_key;
create unique index if not exists reviews_booking_direction_uidx on public.reviews (booking_id, direction);

-- Let the professional insert their (pro→customer) review (customer policy already exists).
do $$ begin
  create policy "reviews professional create" on public.reviews for insert
    with check (auth.uid() = professional_id);
exception when duplicate_object then null; end $$;

-- Eligibility: completed booking + author matches the direction (no impersonation).
create or replace function public.enforce_review_eligibility() returns trigger as $$
begin
  if not exists (
    select 1 from public.bookings b
    where b.id = new.booking_id and b.status = 'completed'
      and b.customer_id = new.customer_id and b.professional_id = new.professional_id
  ) then
    raise exception 'review allowed only for a completed booking you are part of';
  end if;
  if new.direction = 'customer_to_pro' and auth.uid() is not null and auth.uid() <> new.customer_id then
    raise exception 'only the customer can leave a customer review';
  end if;
  if new.direction = 'pro_to_customer' and auth.uid() is not null and auth.uid() <> new.professional_id then
    raise exception 'only the professional can leave a professional review';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Pro public rating reflects CUSTOMER→PRO reviews only.
create or replace function public.refresh_professional_rating() returns trigger as $$
declare pid uuid := coalesce(new.professional_id, old.professional_id);
begin
  update public.professional_profiles p set
    rating_average = coalesce((select round(avg(rating)::numeric,2)
                               from public.reviews
                               where professional_id = pid and is_published and direction = 'customer_to_pro'), 0),
    review_count   = (select count(*) from public.reviews
                      where professional_id = pid and is_published and direction = 'customer_to_pro')
  where p.user_id = pid;
  return null;
end;
$$ language plpgsql security definer set search_path = public;
