import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type ProductHit = { id: string; title: string; price: number; stock_quantity: number };
type OrderHit = { order_number: number; customer_name: string; total: number; status: string };
type CategoryHit = { id: string; name: string; slug: string };

export function AdminGlobalSearch() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<ProductHit[]>([]);
  const [orders, setOrders] = useState<OrderHit[]>([]);
  const [categories, setCategories] = useState<CategoryHit[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const q = query.trim();
    if (!q) { setProducts([]); setOrders([]); setCategories([]); setError(''); return; }
    setLoading(true);
    // Debounced: waits 300ms after the last keystroke before querying, so typing
    // doesn't fire a request per character.
    const timer = setTimeout(async () => {
      const like = `%${q}%`;
      const digitsOnly = q.replace(/[^0-9]/g, '');
      const orderNumberClause = digitsOnly ? `,order_number.eq.${digitsOnly}` : '';
      const [p, c, o] = await Promise.all([
        supabase.from('products').select('id, title, price, stock_quantity')
          .or(`title.ilike.${like},author.ilike.${like},slug.ilike.${like}`).limit(5),
        supabase.from('categories').select('id, name, slug')
          .or(`name.ilike.${like},slug.ilike.${like}`).limit(5),
        supabase.from('orders').select('order_number, customer_name, total, status')
          .or(`customer_name.ilike.${like},customer_phone.ilike.${like}${orderNumberClause}`).limit(5),
      ]);
      setLoading(false);
      const firstError = [p, c, o].find((r) => r.error)?.error;
      if (firstError) { setError(firstError.message); return; }
      setError('');
      setProducts(p.data ?? []);
      setCategories(c.data ?? []);
      setOrders(o.data ?? []);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const hasResults = products.length + orders.length + categories.length > 0;

  return (
    <div className="relative">
      <div className="flex items-center gap-2 border border-[#eadbd9] bg-white px-3 py-2">
        <Search size={16} className="text-[#746875]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search products, orders, categories…"
          className="w-full text-sm outline-none"
        />
      </div>
      {open && query.trim() && (
        <div className="absolute left-0 right-0 z-40 mt-1 max-h-96 overflow-y-auto border border-[#eadbd9] bg-white shadow-lg">
          {loading && <p className="p-3 text-sm text-[#746875]">Searching…</p>}
          {error && <p role="alert" className="p-3 text-sm text-[#B23A48]">{error}</p>}
          {!loading && !error && !hasResults && <p className="p-3 text-sm text-[#746875]">No results.</p>}
          {products.length > 0 && (
            <div>
              <p className="px-3 pt-3 text-xs font-bold uppercase tracking-[.1em] text-[#746875]">Products</p>
              {products.map((p) => (
                <Link key={p.id} href={`/admin/products/${p.id}`} className="flex items-center justify-between px-3 py-2 text-sm hover:bg-[#FFF1EC]">
                  <span className="text-[#30263B]">{p.title}</span>
                  <span className="text-xs text-[#746875]">{p.price} DZD · stock {p.stock_quantity}</span>
                </Link>
              ))}
            </div>
          )}
          {orders.length > 0 && (
            <div>
              <p className="px-3 pt-3 text-xs font-bold uppercase tracking-[.1em] text-[#746875]">Orders</p>
              {orders.map((o) => (
                <Link key={o.order_number} href={`/admin/orders/${o.order_number}`} className="flex items-center justify-between px-3 py-2 text-sm hover:bg-[#FFF1EC]">
                  <span className="text-[#30263B]">#{o.order_number} — {o.customer_name}</span>
                  <span className="text-xs text-[#746875]">{o.total} DZD · {o.status}</span>
                </Link>
              ))}
            </div>
          )}
          {categories.length > 0 && (
            <div>
              <p className="px-3 pt-3 text-xs font-bold uppercase tracking-[.1em] text-[#746875]">Categories</p>
              {categories.map((c) => (
                <Link key={c.id} href={`/admin/categories/${c.id}`} className="flex items-center justify-between px-3 py-2 text-sm hover:bg-[#FFF1EC]">
                  <span className="text-[#30263B]">{c.name}</span>
                  <span className="text-xs text-[#746875]">/{c.slug}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
