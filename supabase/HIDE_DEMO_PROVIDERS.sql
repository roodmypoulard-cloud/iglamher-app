-- =============================================================================
-- iGlamHer — Hide demo providers from public beta (Blocker 3)
-- Run in the Supabase SQL Editor ONLY once real providers are live.
-- SAFE: does not delete anything. Sets is_active=false (the sole visibility gate),
-- so demo pros vanish from discover/search but all their data is preserved for
-- internal testing. Fully reversible (see the un-hide block at the bottom).
-- Requires migration 0015 (is_demo flag) applied first.
-- =============================================================================

-- Preview: which providers will be hidden (expect the 12 seeded demo pros)
select user_id, business_name, is_active, is_demo
from public.professional_profiles
where is_demo = true
order by business_name;

-- HIDE demo providers (reversible)
update public.professional_profiles
   set is_active = false
 where is_demo = true
   and is_active = true;

-- Verify: no demo provider is publicly visible (expect 0)
select count(*) as visible_demo_providers
from public.professional_profiles
where is_demo = true and is_active = true;

-- Verify: real providers are unaffected (expect your approved real pros)
select count(*) as visible_real_providers
from public.professional_profiles
where is_demo = false and is_active = true;

-- ---------------------------------------------------------------------------
-- TO RESTORE demo providers for internal testing (run only if needed):
-- update public.professional_profiles set is_active = true
--  where is_demo = true;
-- ---------------------------------------------------------------------------
