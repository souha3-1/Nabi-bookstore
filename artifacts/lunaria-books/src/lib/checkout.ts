import { supabase } from '@/lib/supabase';
import type { CartItem } from '@/lib/cart';

export type DeliveryMethod = 'home' | 'stop_desk';
export type CheckoutValues = {
  name: string; phone: string; wilayaCode: number | null; commune: string;
  deliveryMethod: DeliveryMethod; address: string; notes: string;
};
export type CheckoutErrors = Partial<Record<'name' | 'phone' | 'wilaya' | 'commune' | 'address' | 'notes', string>>;

export const EMPTY_CHECKOUT: CheckoutValues = { name: '', phone: '', wilayaCode: null, commune: '', deliveryMethod: 'home', address: '', notes: '' };
export const DELIVERY_LABELS: Record<DeliveryMethod, string> = { home: 'Home delivery', stop_desk: 'Stop desk pickup' };

// Phone numbers are compared without spaces, dots, dashes or brackets: 0555 12 34 56, +213 555 12 34 56 ...
export const cleanPhone = (phone: string) => phone.replace(/[\s.()-]/g, '');

// The same rules are checked again by the database function place_order (supabase/migrations/20260921120000_place_order.sql).
export function validateCheckout(values: CheckoutValues): CheckoutErrors {
  const errors: CheckoutErrors = {};
  const name = values.name.trim();
  const address = values.address.trim();
  if (name.length < 2 || name.length > 80) errors.name = 'Please enter your full name.';
  if (!/^(\+213|00213|0)[0-9]{8,9}$/.test(cleanPhone(values.phone))) errors.phone = 'Please enter a valid phone number, like 0555 12 34 56.';
  if (!values.wilayaCode) errors.wilaya = 'Please choose your wilaya.';
  if (!values.commune) errors.commune = 'Please choose your commune.';
  if (values.deliveryMethod === 'home' && (address.length < 5 || address.length > 250)) errors.address = 'Please enter your delivery address (street, number, district).';
  if (values.notes.trim().length > 500) errors.notes = 'Notes can be up to 500 characters.';
  return errors;
}

export type OrderLine = { title: string; variant: string | null; quantity: number; unit_price: number; line_total: number };
export type PlacedOrder = {
  order_number: number; subtotal: number; shipping_fee: number; total: number;
  delivery_method: DeliveryMethod; wilaya: string; commune: string; items: OrderLine[];
};
export type StockProblem = { slug: string; title: string; requested: number; available: number };

export type PlaceOrderResult =
  | { status: 'placed'; order: PlacedOrder }
  | { status: 'stock'; problems: StockProblem[] }
  | { status: 'price_changed'; total: number }
  | { status: 'invalid' }
  | { status: 'failed' };

// One id per checkout attempt: if the answer is lost on a bad connection, sending the same id again
// returns the original order instead of creating a second one.
export const newRequestId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));

// Sends the order to the database function. The server recalculates prices, stock and shipping itself;
// expectedTotal is only used to notice that a price changed while the visitor was shopping.
export async function placeOrder(values: CheckoutValues, wilayaName: string, cart: CartItem[], expectedTotal: number, requestId: string): Promise<PlaceOrderResult> {
  const { data, error } = await supabase.rpc('place_order', {
    p_name: values.name,
    p_phone: values.phone,
    p_wilaya_code: values.wilayaCode,
    p_wilaya: wilayaName,
    p_commune: values.commune,
    p_delivery_method: values.deliveryMethod,
    p_address: values.deliveryMethod === 'home' ? values.address : '',
    p_notes: values.notes,
    p_items: cart.map((item) => ({ slug: item.id, variant: item.variant && item.variant !== 'Default' ? item.variant : null, quantity: item.quantity })),
    p_expected_total: expectedTotal,
    p_request_id: requestId,
  });
  const result = data as Record<string, unknown> | null;
  if (error || !result || typeof result !== 'object') return { status: 'failed' };
  if (result.ok === true) return { status: 'placed', order: result as unknown as PlacedOrder };
  if (result.error === 'stock' && Array.isArray(result.items)) return { status: 'stock', problems: result.items as StockProblem[] };
  if (result.error === 'price_changed' && typeof result.total === 'number') return { status: 'price_changed', total: result.total };
  if (result.error === 'invalid_input') return { status: 'invalid' };
  return { status: 'failed' };
}

// The confirmation page shows the order that was just placed. It is kept only for this browser tab.
const LAST_ORDER_KEY = 'nabi-books-last-order';
export type LastOrder = { name: string; order: PlacedOrder };

export function saveLastOrder(value: LastOrder) {
  try { sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(value)); } catch { /* ignore */ }
}

export function readLastOrder(): LastOrder | null {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(LAST_ORDER_KEY) || 'null');
    return parsed && typeof parsed.name === 'string' && parsed.order && Array.isArray(parsed.order.items) && (parsed.order.delivery_method === 'home' || parsed.order.delivery_method === 'stop_desk') ? (parsed as LastOrder) : null;
  } catch { return null; }
}
