import { useEffect, useState } from 'react';
import { Link, useParams } from 'wouter';
import { supabase } from '@/lib/supabase';

const STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'] as const;
type Status = (typeof STATUSES)[number];

type OrderRow = {
  order_number: number;
  customer_name: string;
  customer_phone: string;
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

type OrderSort = 'newest' | 'oldest' | 'total-desc' | 'total-asc';
type DateFilter = 'all' | 'today' | 'yesterday' | '7days' | '30days';

const sortOrders = (orders: OrderRow[], sort: OrderSort): OrderRow[] => {
  const sorted = [...orders];
  switch (sort) {
    case 'newest': return sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
    case 'oldest': return sorted.sort((a, b) => a.created_at.localeCompare(b.created_at));
    case 'total-desc': return sorted.sort((a, b) => b.total - a.total);
    case 'total-asc': return sorted.sort((a, b) => a.total - b.total);
  }
};

const matchesDateFilter = (createdAt: string, filter: DateFilter): boolean => {
  if (filter === 'all') return true;
  const created = new Date(createdAt);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysAgo = (n: number) => new Date(startOfToday.getTime() - n * 86400000);
  switch (filter) {
    case 'today': return created >= startOfToday;
    case 'yesterday': return created >= daysAgo(1) && created < startOfToday;
    case '7days': return created >= daysAgo(7);
    case '30days': return created >= daysAgo(30);
  }
};

export function AdminOrdersList() {
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [error, setError] = useState('');
  const [sortOption, setSortOption] = useState<OrderSort>('newest');
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    supabase.from('orders').select('order_number, customer_name, customer_phone, status, total, created_at')
      .order('order_number', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) { setError(err.message); return; }
        setOrders(data ?? []);
      });
  }, []);

  useEffect(() => { setPage(1); }, [query, statusFilter, dateFilter, sortOption]);

  const q = query.trim().toLowerCase();
  const filtered = orders?.filter((o) => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (!matchesDateFilter(o.created_at, dateFilter)) return false;
    if (!q) return true;
    return (
      String(o.order_number).includes(q) ||
      o.customer_name.toLowerCase().includes(q) ||
      o.customer_phone.toLowerCase().includes(q)
    );
  });
  const visibleOrders = filtered ? sortOrders(filtered, sortOption) : undefined;
  const totalPages = visibleOrders ? Math.max(1, Math.ceil(visibleOrders.length / pageSize)) : 1;
  const currentPage = Math.min(page, totalPages);
  const pagedOrders = visibleOrders?.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl text-[#30263B]">Orders</h1>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Search order #, name, or phone…"
          className="min-w-[220px] flex-1 border border-[#eadbd9] bg-white px-3 py-2 text-sm outline-none focus:border-[#48458F]" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as Status | 'all')}
          className="border border-[#eadbd9] bg-white px-3 py-2 text-sm">
          <option value="all">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as DateFilter)}
          className="border border-[#eadbd9] bg-white px-3 py-2 text-sm">
          <option value="all">Any date</option>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="7days">Last 7 days</option>
          <option value="30days">Last 30 days</option>
        </select>
        <select value={sortOption} onChange={(e) => setSortOption(e.target.value as OrderSort)}
          className="border border-[#eadbd9] bg-white px-3 py-2 text-sm">
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="total-desc">Highest total</option>
          <option value="total-asc">Lowest total</option>
        </select>
      </div>
      {error && <p role="alert" className="mt-4 text-sm text-[#B23A48]">{error}</p>}
      <div className="mt-6 divide-y divide-[#eadbd9] border border-[#eadbd9] bg-white">
        {orders === null && <p className="p-4 text-sm text-[#746875]">Loading…</p>}
        {visibleOrders?.length === 0 && <p className="p-4 text-sm text-[#746875]">No orders match your search/filters.</p>}
        {pagedOrders?.map((order) => (
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
      {visibleOrders && visibleOrders.length > pageSize && (
        <div className="mt-4 flex items-center justify-between text-sm text-[#746875]">
          <span>Page {currentPage} of {totalPages} ({visibleOrders.length} orders)</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}
              className="border border-[#eadbd9] bg-white px-3 py-1.5 disabled:opacity-40">Previous</button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
              className="border border-[#eadbd9] bg-white px-3 py-1.5 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
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
