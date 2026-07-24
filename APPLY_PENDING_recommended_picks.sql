-- ============================================================================
-- Recommended picks backfill — the /categories "iGlamHer Recommended" carousel
-- is data-gated on is_recommended AND is_verified, and prod currently has ZERO
-- pros with is_recommended = true, so the carousel renders nothing.
--
-- Flags the four curated picks (mirrors src/lib/data/seed.ts) — all verified,
-- so every card carries the gold check + crown. Idempotent; verified-only
-- guard in the WHERE so an unverified pro can never slip into the shelf.
-- Run with service role (column guard blocks non-privileged writers).
-- ============================================================================

update public.professional_profiles
set is_recommended    = true,
    recommended_at    = coalesce(recommended_at, now()),
    recommended_until = null
where business_name in ('Maya Rose Beauty', 'Dee Styles Studio', 'Simone V Styling', 'Amara Beauty')
  and is_verified
  and is_active
  and not is_recommended;
