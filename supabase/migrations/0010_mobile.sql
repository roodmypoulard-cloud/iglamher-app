-- ============================================================
-- iGlamHer — 0010 Mobile (push device tokens + notification preferences)
-- Backend the native iOS/Android apps register against. Append-only, safe.
-- ============================================================

-- ---------- push device tokens (APNs / FCM / Web Push) ----------
create table if not exists public.device_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  token      text not null,
  platform   text not null,               -- ios | android | web
  device_name text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, token)
);
create index if not exists device_tokens_user_idx on public.device_tokens (user_id);
alter table public.device_tokens enable row level security;
do $$ begin
  create policy "device tokens own" on public.device_tokens for all
    using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- ---------- notification preferences (granular per-channel/type) ----------
create table if not exists public.notification_preferences (
  user_id            uuid primary key references public.profiles(id) on delete cascade,
  push_enabled       boolean not null default true,
  email_enabled      boolean not null default true,
  sms_enabled        boolean not null default false,
  booking_updates    boolean not null default true,
  messages           boolean not null default true,
  reminders          boolean not null default true,
  promotions         boolean not null default true,
  payout_updates     boolean not null default true,
  updated_at         timestamptz not null default now()
);
alter table public.notification_preferences enable row level security;
do $$ begin
  create policy "notif prefs own" on public.notification_preferences for all
    using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
