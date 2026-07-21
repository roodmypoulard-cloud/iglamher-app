-- =============================================================================
-- iGlamHer — Migration 0014: auto-create a conversation per booking
-- Run ONCE in the Supabase SQL Editor (production), AFTER 0011/0012/0013.
--
-- WHY: Phase 12 live verification proved every messaging layer works (schema,
-- RLS, send action, read UI, unlock-on-payment) EXCEPT conversation creation —
-- nothing ever inserts a conversation, so prod had 0 conversations and no user
-- could start or receive a message. This adds the missing step + backfills
-- existing bookings. Additive & idempotent; no data dropped.
-- =============================================================================

-- ============================ SQL TO RUN =====================================
begin;

create or replace function public.create_booking_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_convo uuid;
begin
  insert into public.conversations (booking_id)
    values (new.id)
    on conflict (booking_id) do nothing
    returning id into v_convo;

  if v_convo is null then
    select id into v_convo from public.conversations where booking_id = new.id;
  end if;

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

-- backfill conversations for existing bookings
insert into public.conversations (booking_id)
select b.id
from public.bookings b
left join public.conversations c on c.booking_id = b.id
where c.id is null
on conflict (booking_id) do nothing;

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

update public.conversations c
   set is_unlocked = true
  from public.bookings b
 where b.id = c.booking_id
   and c.is_unlocked = false
   and b.status in ('confirmed', 'completed');

commit;

-- ========================= VERIFICATION QUERIES ==============================

-- V1) trigger exists on bookings
select tgname from pg_trigger
where tgrelid = 'public.bookings'::regclass and tgname = 'trg_booking_conversation';

-- V2) every booking now has exactly one conversation
select
  (select count(*) from public.bookings)      as bookings,
  (select count(*) from public.conversations) as conversations;

-- V3) every conversation has both members (should return 0 rows = no gaps)
select c.id, count(m.user_id) as members
from public.conversations c
left join public.conversation_members m on m.conversation_id = c.id
group by c.id
having count(m.user_id) <> 2;

-- ========================= EXPECTED RESULTS ==================================
-- V1 -> 1 row: trg_booking_conversation
-- V2 -> bookings == conversations
-- V3 -> 0 rows (every conversation has exactly 2 members)
-- =============================================================================
