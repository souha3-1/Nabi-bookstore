// Pure text-building logic, kept separate from index.ts so it can be tested with plain Node/Deno
// (no network, no Supabase, no Telegram) — see format.test.ts.

export type OrderItem = { product_title_snapshot: string; variant: string | null; quantity: number; line_total: number };
export type OrderRecord = {
  order_number: number;
  customer_name: string;
  customer_phone: string;
  wilaya: string;
  commune: string;
  delivery_method: 'home' | 'stop_desk';
  delivery_address: string | null;
  notes: string | null;
  subtotal: number;
  shipping_fee: number;
  total: number;
};

const money = (n: number) => `${new Intl.NumberFormat('fr-FR').format(n)} DA`;

// Telegram's "MarkdownV2" requires these characters to be escaped wherever they appear in plain text.
const escape = (text: string) => text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');

export function formatOrderMessage(order: OrderRecord, items: OrderItem[]): string {
  const lines: string[] = [];
  lines.push(`🛍️ *New order \\#${order.order_number}*`);
  lines.push('');
  lines.push(`👤 ${escape(order.customer_name)}`);
  lines.push(`📞 ${escape(order.customer_phone)}`);
  lines.push(
    order.delivery_method === 'home'
      ? `🚚 Home delivery — ${escape(order.delivery_address ?? '')}, ${escape(order.commune)}, ${escape(order.wilaya)}`
      : `📦 Stop desk — ${escape(order.commune)}, ${escape(order.wilaya)}`,
  );
  if (order.notes) lines.push(`📝 ${escape(order.notes)}`);
  lines.push('');
  for (const item of items) {
    const variant = item.variant ? ` \\(${escape(item.variant)}\\)` : '';
    lines.push(`• ${escape(item.product_title_snapshot)}${variant} × ${item.quantity} — ${escape(money(item.line_total))}`);
  }
  lines.push('');
  lines.push(`Subtotal: ${escape(money(order.subtotal))}`);
  lines.push(`Shipping: ${order.shipping_fee ? escape(money(order.shipping_fee)) : 'Free'}`);
  lines.push(`*Total: ${escape(money(order.total))}*`);
  return lines.join('\n');
}
