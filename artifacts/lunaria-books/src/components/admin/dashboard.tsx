import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { supabase } from '@/lib/supabase';

type Stats = {
  totalProducts: number;
  lowStock: number;
  outOfStock: number;
  pendingOrders: number;
};

type RecentOrder = {
  order_number: number;
  customer_name: string;
  total: number;
  status: string;
  created_at: string;
};

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<RecentOrder[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      // low/out-of-stock compare two columns against each other (stock_quantity vs
      // low_stock_threshold), which PostgREST can't express as a query-string filter —
      // so pull stock levels for active products and compare them client-side instead.
      const [stockLevels, pending, recentOrders] = await Promise.all([
        supabase.from('products').select('stock_quantity, low_stock_threshold').eq('is_active', true),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('orders').select('order_number, customer_name, total, status, created_at').order('created_at', { ascending: false }).limit(5),
      ]);
      if (cancelled) return;
      const firstError = [stockLevels, pending, recentOrders].find((r) => r.error)?.error;
      if (firstError) { setError(firstError.message); return; }
      const products = stockLevels.data ?? [];
      setStats({
        totalProducts: products.length,
        lowStock: products.filter((p) => p.stock_quantity > 0 && p.stock_quantity <= p.low_stock_threshold).length,
        outOfStock: products.filter((p) => p.stock_quantity === 0).length,
        pendingOrders: pending.count ?? 0,
      });
      setRecent(recentOrders.data ?? []);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (error) return <p role="alert" className="text-sm text-[#B23A48]">{error}</p>;
  if (!stats) return <p className="text-sm text-[#746875]">Loading…</p>;

  const cards = [
    ['Active products', stats.totalProducts],
    ['Low stock', stats.lowStock],
    ['Out of stock', stats.outOfStock],
    ['Pending orders', stats.pendingOrders],
  ] as const;

  return (
    <div>
      <h1 className="font-display text-3xl text-[#30263B]">Dashboard</h1>
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="border border-[#eadbd9] bg-white p-5">
            <p className="text-xs uppercase tracking-[.1em] text-[#746875]">{label}</p>
            <p className="mt-1 font-display text-3xl text-[#30263B]">{value}</p>
          </div>
        ))}
      </div>
      <h2 className="mt-10 font-display text-xl text-[#30263B]">Recent orders</h2>
      <div className="mt-3 divide-y divide-[#eadbd9] border border-[#eadbd9] bg-white">
        {recent.length === 0 && <p className="p-4 text-sm text-[#746875]">No orders yet.</p>}
        {recent.map((order) => (
          <Link key={order.order_number} href={`/admin/orders/${order.order_number}`}
            className="flex items-center justify-between px-4 py-3 text-sm hover:bg-[#FFF1EC]">
            <span>#{order.order_number} — {order.customer_name}</span>
            <span className="flex items-center gap-3">
              <span className="text-[#746875]">{order.total} DZD</span>
              <span className="rounded-full bg-[#FCE0E0] px-2 py-0.5 text-xs font-semibold text-[#48458F]">{order.status}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
