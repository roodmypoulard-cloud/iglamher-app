-- ============================================================
-- iGlamHer — Storage buckets + policies
-- Run after creating the project. Buckets can also be created in the dashboard;
-- this keeps them reproducible. Storage objects are AES-256 encrypted at rest.
-- ============================================================

-- Private bucket for verification documents (IDs, licenses, insurance, selfies).
insert into storage.buckets (id, name, public)
values ('verification-documents', 'verification-documents', false)
on conflict (id) do nothing;

-- Public bucket for portfolio media (public read, owner write).
insert into storage.buckets (id, name, public)
values ('portfolio', 'portfolio', true)
on conflict (id) do nothing;

-- ---------- verification-documents: NO public read ----------
-- Owners may write only under their own {user_id}/ prefix; reads happen only via
-- admin-minted signed URLs (service role), never a client SELECT.
do $$ begin
  create policy "verif docs owner write" on storage.objects for insert to authenticated
    with check (bucket_id = 'verification-documents' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "verif docs owner read own" on storage.objects for select to authenticated
    using (bucket_id = 'verification-documents' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;
-- Admins read all verification docs.
do $$ begin
  create policy "verif docs admin read" on storage.objects for select to authenticated
    using (bucket_id = 'verification-documents' and public.is_admin(auth.uid()));
exception when duplicate_object then null; end $$;

-- ---------- portfolio: public read, owner write under own prefix ----------
do $$ begin
  create policy "portfolio public read" on storage.objects for select
    using (bucket_id = 'portfolio');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "portfolio owner write" on storage.objects for insert to authenticated
    with check (bucket_id = 'portfolio' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "portfolio owner update" on storage.objects for update to authenticated
    using (bucket_id = 'portfolio' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "portfolio owner delete" on storage.objects for delete to authenticated
    using (bucket_id = 'portfolio' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;
