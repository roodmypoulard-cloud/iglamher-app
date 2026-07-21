-- 0019 — phone verification (Supabase Phone Auth + Twilio Verify)
-- Adds verification flags to profiles. The verified E.164 number is written to
-- profiles.phone by the app only AFTER an OTP is confirmed. Idempotent, additive,
-- no data dropped; RLS on profiles is unchanged (owner-scoped policies already exist).
alter table public.profiles
  add column if not exists phone_verified boolean not null default false,
  add column if not exists phone_verified_at timestamptz;
