-- ============================================================
-- iGlamHer — deterministic seed (categories + promo).
-- Test AUTH accounts + sample professionals are created by
-- scripts/seed.ts (uses the Supabase admin API). See README.
-- ============================================================
insert into public.categories (id, slug, name, description, sort_order) values
  ('11111111-1111-1111-1111-111111111101','hair','Hair','Cuts, silk press, braids, installs, blowouts',1),
  ('11111111-1111-1111-1111-111111111102','makeup','Makeup','Soft glam, full glam, bridal',2),
  ('11111111-1111-1111-1111-111111111103','lashes','Lashes','Classic, hybrid, volume, fills',3),
  ('11111111-1111-1111-1111-111111111104','stylist','Stylist','Personal & event styling, closet edits',4)
on conflict (id) do nothing;

insert into public.promo_codes (code, description, discount_type, discount_value, is_active) values
  ('GLOWUP15','15% off your first booking','percent',15,true)
on conflict (code) do nothing;
