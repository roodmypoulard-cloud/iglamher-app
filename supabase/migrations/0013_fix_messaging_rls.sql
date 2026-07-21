-- Phase 12 — fix infinite recursion (Postgres 42P17) in messaging RLS.
--
-- The original "convo membership read" policy on conversation_members referenced
-- conversation_members inside its own USING clause, so evaluating it re-triggered
-- itself → infinite recursion. That error propagated to the conversations and
-- messages policies (whose subqueries read conversation_members), which meant
-- ALL messaging reads failed at runtime for authenticated users.
--
-- A member only needs to read their OWN membership rows; the app resolves the
-- other party from the booking (customer_id / professional_id), never from other
-- members' rows. So the correct, non-recursive policy is simply user_id = auth.uid().

drop policy if exists "convo membership read" on public.conversation_members;

do $$ begin
  create policy "convo membership read" on public.conversation_members
    for select using (user_id = auth.uid());
exception when duplicate_object then null; end $$;
