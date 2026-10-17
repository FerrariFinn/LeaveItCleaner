-- Leave it cleaner — migration: remove all public (anon) access.
-- The backend now uses the secret key (service_role), which bypasses RLS.
-- With RLS enabled and no policies, the publishable key can read or write nothing.
-- Run this once in the Supabase SQL editor.

drop policy if exists "read categories"    on categories;
drop policy if exists "read sessions"      on sessions;
drop policy if exists "read session_items" on session_items;
drop policy if exists "read summaries"     on summaries;
drop policy if exists "insert summaries"   on summaries;

revoke execute on function log_session(text, text, text, text, jsonb) from public, anon, authenticated;
grant  execute on function log_session(text, text, text, text, jsonb) to service_role;

revoke all on session_overview from anon, authenticated;
