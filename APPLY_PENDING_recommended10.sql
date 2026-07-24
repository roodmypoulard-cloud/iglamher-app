-- ============================================================================
-- Fill the "iGlamHer Recommended" carousel with 10 real profiles on the LIVE
-- site: mark 10 seeded pros as recommended + verified and give each its unique
-- Higgsfield portrait. One paste does everything. Safe + idempotent.
-- ============================================================================
update public.professional_profiles set is_verified = true, is_recommended = true, recommended_at = now(),
  avatar_url = '/pros/bridal.jpg',      cover_url = '/pros/bridal.jpg'      where business_name = 'Maya Rose Beauty';
update public.professional_profiles set is_verified = true, is_recommended = true, recommended_at = now(),
  avatar_url = '/pros/braids.jpg',      cover_url = '/pros/braids.jpg'      where business_name = 'Dee Styles Studio';
update public.professional_profiles set is_verified = true, is_recommended = true, recommended_at = now(),
  avatar_url = '/pros/naturalhair.jpg', cover_url = '/pros/naturalhair.jpg' where business_name = 'Nina K Hair';
update public.professional_profiles set is_verified = true, is_recommended = true, recommended_at = now(),
  avatar_url = '/pros/stylist.jpg',     cover_url = '/pros/stylist.jpg'     where business_name = 'Simone V Styling';
update public.professional_profiles set is_verified = true, is_recommended = true, recommended_at = now(),
  avatar_url = '/pros/lashes.jpg',      cover_url = '/pros/lashes.jpg'      where business_name = 'Bella Lash Lab';
update public.professional_profiles set is_verified = true, is_recommended = true, recommended_at = now(),
  avatar_url = '/pros/naturalglam.jpg', cover_url = '/pros/naturalglam.jpg' where business_name = 'Jade Glow Makeup';
update public.professional_profiles set is_verified = true, is_recommended = true, recommended_at = now(),
  avatar_url = '/pros/crown.jpg',       cover_url = '/pros/crown.jpg'       where business_name = 'Crown by Tori';
update public.professional_profiles set is_verified = true, is_recommended = true, recommended_at = now(),
  avatar_url = '/pros/hybridlash.jpg',  cover_url = '/pros/hybridlash.jpg'  where business_name = 'Lux Lash Bar';
update public.professional_profiles set is_verified = true, is_recommended = true, recommended_at = now(),
  avatar_url = '/pros/bob.jpg',         cover_url = '/pros/bob.jpg'         where business_name = 'Remy Cuts';
update public.professional_profiles set is_verified = true, is_recommended = true, recommended_at = now(),
  avatar_url = '/pros/bride.jpg',       cover_url = '/pros/bride.jpg'       where business_name = 'Amara Beauty';
