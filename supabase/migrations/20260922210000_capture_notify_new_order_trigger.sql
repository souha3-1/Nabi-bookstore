-- Nabi Books — Phase 11 (retroactive capture).
-- notify_new_order() and its trigger were created directly in the Supabase SQL editor when
-- Phase 11 shipped and were never saved as a migration. This file is a record of what is
-- already live — running it changes nothing, it just brings the repo in sync with the database.
-- (The EXECUTE lockdown for this function is handled separately, in
-- 20260922200000_lock_down_notify_trigger.sql.)

create or replace function public.notify_new_order()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform net.http_post(
    url := 'https://eujlmyemhourknlozrod.supabase.co/functions/v1/notify-new-order',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret',
      (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'ORDER_WEBHOOK_SECRET'
        limit 1
      )
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'orders',
      'record', to_jsonb(NEW)
    ),
    timeout_milliseconds := 5000
  );

  return NEW;
end;
$$;

drop trigger if exists notify_new_order_trigger on public.orders;
create trigger notify_new_order_trigger
  after insert on public.orders
  for each row execute function notify_new_order();
