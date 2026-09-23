import { useEffect, useState } from 'react';
import { Link, useParams } from 'wouter';
import { supabase } from '@/lib/supabase';

const STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'] as const;
type Status = (typeof STATUSES)[number];

type OrderRow = {
  order_number: number;
  customer_name: string;
  status: Status;
  total: number;
  created_at: string;
};

type OrderItem = {
  line_number: number;
  product_title_snapshot: string;
  variant: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
};

type OrderDetail = OrderRow & {
  customer_phone: string;
  delivery_address: string;
  wilaya: string;
  commune: string;
  delivery_method: string;
  payment_method: string;
  payment_status: string;
  subtotal: number;
  shipping_fee: number;
  notes: string | null;
};

const statusStyle: Record<Status, string> = {
  pending: 'bg-[#FCE0E0] text-[#48458F]',
  confirmed: 'bg-[#dbe3fb] text-[#2f3d8f]',
  shipped: 'bg-[#e0e8fc] text-[#2f3d8f]',
  delivered: 'bg-[#dff3e3] text-[#1f7a3a]',
  cancelled: 'bg-[#f3dede] text-[#8f2f2f]',
};

export function AdminOrdersList() {
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('orders').select('order_number, customer_name, status, total, created_at')
      .order('order_number', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) { setError(err.message); return; }
        setOrders(data ?? []);
      });
  }, []);

  return (
    <div>
      <h1 className="font-display text-3xl text-[#30263B]">Orders</h1>
      {error && <p role="alert" className="mt-4 text-sm text-[#B23A48]">{error}</p>}
      <div className="mt-6 divide-y divide-[#eadbd9] border border-[#eadbd9] bg-white">
        {orders === null && <p className="p-4 text-sm text-[#746875]">Loading…</p>}
        {orders?.length === 0 && <p className="p-4 text-sm text-[#746875]">No orders yet.</p>}
        {orders?.map((order) => (
          <Link key={order.order_number} href={`/admin/orders/${order.order_number}`}
            className="flex items-center justify-between px-4 py-3 text-sm hover:bg-[#FFF1EC]">
            <span>#{order.order_number} — {order.customer_name}</span>
            <span className="flex items-center gap-3">
              <span className="text-[#746875]">{order.total} DZD</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusStyle[order.status]}`}>{order.status}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function AdminOrderDetail() {
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);

  async function load() {
    const o = await supabase.from('orders').select('*').eq('order_number', params.id).single();
    if (o.error) { setError(o.error.message); return; }
    setOrder(o.data);
    const i = await supabase.from('order_items')
      .select('line_number, product_title_snapshot, variant, quantity, unit_price, line_total')
      .eq('order_id', o.data.id)
      .order('line_number');
    if (i.error) { setError(i.error.message); return; }
    setItems(i.data ?? []);
  }
  useEffect(() => { load(); }, [params.id]);

  async function updateStatus(status: Status) {
    if (!order) return;
    setUpdating(true);
    const { error: err } = await supabase.from('orders').update({ status }).eq('order_number', order.order_number);
    setUpdating(false);
    if (err) { setError(err.message); return; }
    setOrder({ ...order, status });
  }

  if (error) return <p role="alert" className="text-sm text-[#B23A48]">{error}</p>;
  if (!order) return <p className="text-sm text-[#746875]">Loading…</p>;

  return (
    <div>
      <Link href="/admin/orders" className="text-sm text-[#746875] hover:text-[#48458F]">&larr; Back to orders</Link>
      <h1 className="mt-2 font-display text-3xl text-[#30263B]">Order #{order.order_number}</h1>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="border border-[#eadbd9] bg-white">
          <div className="divide-y divide-[#eadbd9]">
            {items.map((item) => (
              <div key={item.line_number} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="font-semibold text-[#30263B]">{item.product_title_snapshot}{item.variant ? ` — ${item.variant}` : ''}</p>
                  <p className="text-xs text-[#746875]">{item.quantity} × {item.unit_price} DZD</p>
                </div>
                <p className="text-[#30263B]">{item.line_total} DZD</p>
              </div>
            ))}
          </div>
          <div className="space-y-1 border-t border-[#eadbd9] px-4 py-3 text-sm">
            <div className="flex justify-between text-[#746875]"><span>Subtotal</span><span>{order.subtotal} DZD</span></div>
            <div className="flex justify-between text-[#746875]"><span>Shipping</span><span>{order.shipping_fee} DZD</span></div>
            <div className="flex justify-between font-bold text-[#30263B]"><span>Total</span><span>{order.total} DZD</span></div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="border border-[#eadbd9] bg-white p-4 text-sm">
            <p className="text-xs font-bold uppercase tracking-[.1em] text-[#746875]">Status</p>
            <select value={order.status} disabled={updating} onChange={(e) => updateStatus(e.target.value as Status)}
              className="mt-2 w-full border border-[#eadbd9] px-3 py-2 text-sm">
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="border border-[#eadbd9] bg-white p-4 text-sm space-y-1">
            <p className="text-xs font-bold uppercase tracking-[.1em] text-[#746875]">Customer</p>
            <p className="text-[#30263B]">{order.customer_name}</p>
            <p className="text-[#746875]">{order.customer_phone}</p>
            <p className="text-[#746875]">{order.delivery_address}</p>
            <p className="text-[#746875]">{order.commune}, {order.wilaya}</p>
            <p className="text-[#746875]">Delivery: {order.delivery_method}</p>
            <p className="text-[#746875]">Payment: {order.payment_method} ({order.payment_status})</p>
            {order.notes && <p className="mt-2 text-[#746875]">Notes: {order.notes}</p>}
            <p className="mt-2 text-xs text-[#a89ba8]">Placed {new Date(order.created_at).toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
