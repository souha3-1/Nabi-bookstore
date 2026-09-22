// Nabi Books — sends a Telegram message to the shop owner whenever a new order is placed.
// Triggered by a Supabase Database Webhook on INSERT into public.orders (set up in the dashboard,
// see the Phase 11 instructions). Runs after place_order() has already committed the order and its
// items, so it only ever reports something that is already safely in the database — it never decides
// whether an order is valid.
import { formatOrderMessage, type OrderItem, type OrderRecord } from './format.ts';

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID');
const WEBHOOK_SECRET = Deno.env.get('ORDER_WEBHOOK_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  // Only the Supabase Database Webhook (configured with this same secret) may call this function —
  // otherwise anyone who learned the URL could forge a fake "order" and spam the owner's Telegram.
  if (!WEBHOOK_SECRET || req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
    return new Response('Forbidden', { status: 403 });
  }
  if (!BOT_TOKEN || !CHAT_ID || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('notify-new-order: missing one of TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    return new Response('Not configured', { status: 500 });
  }

  let payload: { type?: string; table?: string; record?: OrderRecord & { id?: string } };
  try {
    payload = await req.json();
  } catch {
    return new Response('Bad request', { status: 400 });
  }
  if (payload.type !== 'INSERT' || payload.table !== 'orders' || !payload.record?.id) {
    return new Response('Ignored', { status: 200 });
  }
  const order = payload.record;

  // The webhook payload only carries the order row itself; its lines are fetched with the service
  // role key, which is safe here because this function never returns them to a browser.
  const itemsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/order_items?order_id=eq.${order.id}&select=product_title_snapshot,variant,quantity,line_total&order=line_number.asc`,
    { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` } },
  );
  if (!itemsRes.ok) {
    console.error('notify-new-order: could not load order_items', itemsRes.status, await itemsRes.text());
    return new Response('Failed to load order items', { status: 502 });
  }
  const items = (await itemsRes.json()) as OrderItem[];

  const text = formatOrderMessage(order, items);
  const sendRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'MarkdownV2' }),
  });
  if (!sendRes.ok) {
    console.error('notify-new-order: Telegram rejected the message', sendRes.status, await sendRes.text());
    return new Response('Telegram send failed', { status: 502 });
  }

  return new Response('OK', { status: 200 });
});
