import { type FormEvent, type ReactNode, useState } from 'react';
import { Link, Route, Switch, useLocation } from 'wouter';
import { LayoutDashboard, Package, Tags, ShoppingBag, LogOut } from 'lucide-react';
import { useAdminSession, adminSignIn, adminSignOut } from '@/lib/admin-auth';
import { useLowStockProducts } from '@/lib/admin-inventory';
import { AdminGlobalSearch } from '@/components/admin/global-search';
import { AdminDashboard } from '@/components/admin/dashboard';
import { AdminProductsList, AdminProductForm } from '@/components/admin/products';
import { AdminCategoriesList, AdminCategoryForm } from '@/components/admin/categories';
import { AdminOrdersList, AdminOrderDetail } from '@/components/admin/orders';

// Client-side guard is for UX only (redirecting an obviously-logged-out visitor).
// The real security boundary is the is_admin() RLS policies in the database —
// even a signed-in non-admin gets permission-denied straight from Supabase.
function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    const result = await adminSignIn(email, password);
    setSubmitting(false);
    if (!result.ok) setError(result.message);
  };
  return (
    <div className="grid min-h-screen place-items-center bg-[#FFF9F7] px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5 border border-[#eadbd9] bg-white p-8">
        <h1 className="font-display text-2xl text-[#30263B]">NABI BOOKS admin</h1>
        {error && <p role="alert" className="text-sm text-[#B23A48]">{error}</p>}
        <label className="block text-xs font-bold uppercase tracking-[.1em] text-[#746875]">
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="mt-2 w-full border-b border-[#d9c5cb] bg-transparent py-2 text-sm outline-none focus:border-[#48458F]" />
        </label>
        <label className="block text-xs font-bold uppercase tracking-[.1em] text-[#746875]">
          Password
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
            className="mt-2 w-full border-b border-[#d9c5cb] bg-transparent py-2 text-sm outline-none focus:border-[#48458F]" />
        </label>
        <button type="submit" disabled={submitting} className="w-full bg-[#48458F] py-3 text-sm font-bold text-white disabled:opacity-60">
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

function AdminLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const lowStockProducts = useLowStockProducts();
  const links = [
    ['/admin', 'Dashboard', LayoutDashboard],
    ['/admin/products', 'Products', Package],
    ['/admin/categories', 'Categories', Tags],
    ['/admin/orders', 'Orders', ShoppingBag],
  ] as const;
  const [showLowStockPopup, setShowLowStockPopup] = useState(false);
  return (
    <div className="min-h-screen bg-[#FFF9F7] md:grid md:grid-cols-[220px_1fr]">
      <aside className="relative border-r border-[#eadbd9] bg-white p-5">
        <p className="font-display text-lg text-[#30263B]">NABI BOOKS</p>
        <p className="text-xs text-[#746875]">Admin</p>
        <nav className="mt-8 space-y-1">
          {links.map(([href, label, Icon]) => (
            <Link key={href} href={href} className={`flex items-center gap-2 rounded px-3 py-2 text-sm ${location === href ? 'bg-[#FCE0E0] font-semibold text-[#48458F]' : 'text-[#5d5262] hover:bg-[#FFF1EC]'}`}>
              <Icon size={16} />{label}
              {href === '/admin/products' && lowStockProducts && lowStockProducts.length > 0 && (
                <span
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowLowStockPopup((v) => !v);
                  }}
                  title="Click to see which products"
                  className="ml-auto cursor-pointer rounded-full bg-[#DC2626] px-2 py-0.5 text-xs font-bold text-white shadow-sm"
                >
                  {lowStockProducts.length}
                </span>
              )}
            </Link>
          ))}
        </nav>
        {showLowStockPopup && lowStockProducts && (
          <div className="fixed inset-0 z-30 grid place-items-center bg-black/40 p-4" onClick={() => setShowLowStockPopup(false)}>
            <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm border border-[#eadbd9] bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-[#eadbd9] px-5 py-4">
                <p className="font-display text-lg text-[#30263B]">Needs attention</p>
                <button onClick={() => setShowLowStockPopup(false)} className="text-sm text-[#746875] hover:text-[#48458F]">✕</button>
              </div>
              <div className="max-h-80 divide-y divide-[#eadbd9] overflow-y-auto">
                {lowStockProducts.map((p) => (
                  <Link key={p.id} href={`/admin/products/${p.id}`} onClick={() => setShowLowStockPopup(false)}
                    className="flex items-center justify-between px-5 py-3 text-sm hover:bg-[#FFF1EC]">
                    <span className="text-[#30263B]">{p.title}</span>
                    <span className={p.stock_quantity === 0 ? 'font-semibold text-[#DC2626]' : 'text-[#746875]'}>
                      {p.stock_quantity === 0 ? 'Out of stock' : `${p.stock_quantity} left`}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
        <button onClick={() => adminSignOut()} className="mt-8 flex items-center gap-2 text-sm text-[#746875] hover:text-[#48458F]">
          <LogOut size={16} />Sign out
        </button>
      </aside>
      <main className="p-6 md:p-8">
        <div className="mx-auto mb-6 max-w-md">
          <AdminGlobalSearch />
        </div>
        {children}
      </main>
    </div>
  );
}

function AdminPlaceholder({ title }: { title: string }) {
  return <div><h1 className="font-display text-3xl text-[#30263B]">{title}</h1><p className="mt-2 text-sm text-[#746875]">Coming next.</p></div>;
}

export default function AdminApp() {
  const { session, isLoading } = useAdminSession();
  if (isLoading) return <div className="grid min-h-screen place-items-center text-sm text-[#746875]">Loading…</div>;
  if (!session) return <AdminLoginPage />;
  return (
    <AdminLayout>
      <Switch>
        <Route path="/admin" component={AdminDashboard} />
        <Route path="/admin/products" component={AdminProductsList} /><Route path="/admin/products/new" component={AdminProductForm} /><Route path="/admin/products/:id" component={AdminProductForm} />
        <Route path="/admin/categories" component={AdminCategoriesList} /><Route path="/admin/categories/new" component={AdminCategoryForm} /><Route path="/admin/categories/:id" component={AdminCategoryForm} />
        <Route path="/admin/orders" component={AdminOrdersList} /><Route path="/admin/orders/:id" component={AdminOrderDetail} />
      </Switch>
    </AdminLayout>
  );
}
