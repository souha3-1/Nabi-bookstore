-- Nabi Books — Phase 12: contact messages and newsletter subscribers.
-- Both forms are open to any visitor (guest-only site, same as checkout): the browser may
-- insert a row directly, but can never read, update or delete afterwards. Nobody browses
-- these tables from the storefront; they are for the shop owner to check by hand later
-- (a dedicated admin view can follow in a later phase, the same way orders did).
-- Run this file ONCE, e.g. via `supabase db push` or the Supabase SQL editor.

create table public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 2 and 80),
  email       text not null check (char_length(email) <= 120 and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  topic       text not null default 'Something else'
              check (topic in ('Book recommendation', 'Order question', 'Shop visit', 'Something else')),
  message     text not null check (char_length(btrim(message)) between 1 and 2000),
  created_at  timestamptz not null default now()
);

create index contact_messages_created_at_idx on public.contact_messages (created_at desc);

alter table public.contact_messages enable row level security;
-- No select/update/delete policies on purpose, same pattern as orders: visitors can send a
-- message but never read the list back.
revoke all on public.contact_messages from anon, authenticated;
grant insert on public.contact_messages to anon, authenticated;

create policy "Anyone can send a contact message"
  on public.contact_messages for insert
  to anon, authenticated
  with check (true);

create table public.newsletter_subscribers (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique check (char_length(email) <= 120 and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  created_at  timestamptz not null default now()
);

alter table public.newsletter_subscribers enable row level security;
revoke all on public.newsletter_subscribers from anon, authenticated;
grant insert on public.newsletter_subscribers to anon, authenticated;

create policy "Anyone can subscribe to the newsletter"
  on public.newsletter_subscribers for insert
  to anon, authenticated
  with check (true);
