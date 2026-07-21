-- Customer tips after a completed booking. One tip per booking (idempotent).
-- Additive & idempotent. No data dropped.

create table if not exists public.tips (
  id                        uuid primary key default gen_random_uuid(),
  booking_id                uuid not null references public.bookings(id) on delete cascade,
  customer_id               uuid not null references public.profiles(id),
  professional_id           uuid not null references public.professional_profiles(user_id) on delete cascade,
  amount_cents              integer not null check (amount_cents > 0),
  currency                  char(3) not null default 'USD',
  stripe_payment_intent_id  text unique,
  status                    text not null default 'succeeded',   -- succeeded | pending | failed
  created_at                timestamptz not null default now(),
  unique (booking_id)                                            -- one tip per booking
);
create index if not exists tips_professional_idx on public.tips (professional_id, created_at desc);

alter table public.tips enable row level security;
-- Customer sees their own tips; professional sees tips to them.
do $$ begin
  create policy "tips participant read" on public.tips for select
    using (auth.uid() = customer_id or auth.uid() = professional_id);
exception when duplicate_object then null; end $$;
-- Writes go through the service-role (server action after Stripe confirms) only.
