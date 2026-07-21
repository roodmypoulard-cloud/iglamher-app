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
