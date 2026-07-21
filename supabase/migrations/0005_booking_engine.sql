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
