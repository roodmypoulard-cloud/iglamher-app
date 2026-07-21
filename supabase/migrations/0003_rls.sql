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
