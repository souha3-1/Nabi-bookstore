-- Nabi Books — Phase 12: order security hardening.
-- notify_new_order() is a trigger function (fires on orders INSERT via pg_net); it should
-- never be callable directly. Postgres already refuses direct calls to trigger functions,
-- so this changes no behavior — it just removes the unnecessary EXECUTE grant that Supabase's
-- Security Advisor flags ("Public/Signed-In Users Can Execute SECURITY DEFINER Function").
-- Run this file ONCE in the Supabase SQL editor.

revoke execute on function public.notify_new_order() from public, anon, authenticated;
