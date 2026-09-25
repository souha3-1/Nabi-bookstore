import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { supabase } from '@/lib/supabase';
import { useLowStockProducts } from '@/lib/admin-inventory';

type Stats = {
  totalProducts: number;
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
  const lowStockProducts = useLowStockProducts();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [total, pending, recentOrders] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('orders').select('order_number, customer_name, total, status, created_at').order('created_at', { ascending: false }).limit(5),
      ]);
      if (cancelled) return;
      const firstError = [total, pending, recentOrders].find((r) => r.error)?.error;
      if (firstError) { setError(firstError.message); return; }
      setStats({ totalProducts: total.count ?? 0, pendingOrders: pending.count ?? 0 });
      setRecent(recentOrders.data ?? []);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (error) return <p role="alert" className="text-sm text-[#B23A48]">{error}</p>;
  if (!stats || lowStockProducts === null) return <p className="text-sm text-[#746875]">Loading…</p>;

  const outOfStockCount = lowStockProducts.filter((p) => p.stock_quantity === 0).length;
  const lowStockCount = lowStockProducts.length - outOfStockCount;

  const cards = [
    ['Active products', stats.totalProducts],
    ['Low stock', lowStockCount],
    ['Out of stock', outOfStockCount],
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

      {lowStockProducts.length > 0 && (
        <>
          <h2 className="mt-10 font-display text-xl text-[#30263B]">Low stock</h2>
          <div className="mt-3 divide-y divide-[#eadbd9] border border-[#eadbd9] bg-white">
            {lowStockProducts.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-[#30263B]">{p.title}</span>
                <span className={p.stock_quantity === 0 ? 'font-semibold text-[#B23A48]' : 'text-[#746875]'}>
                  {p.stock_quantity === 0 ? 'Out of stock' : `${p.stock_quantity} left`}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

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
