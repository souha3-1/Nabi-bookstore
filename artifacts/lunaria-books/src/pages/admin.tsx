import { type FormEvent, type ReactNode, useState } from 'react';
import { Link, Route, Switch, useLocation } from 'wouter';
import { LayoutDashboard, Package, Tags, ShoppingBag, LogOut } from 'lucide-react';
import { useAdminSession, adminSignIn, adminSignOut } from '@/lib/admin-auth';
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
  const links = [
    ['/admin', 'Dashboard', LayoutDashboard],
    ['/admin/products', 'Products', Package],
    ['/admin/categories', 'Categories', Tags],
    ['/admin/orders', 'Orders', ShoppingBag],
  ] as const;
  return (
    <div className="min-h-screen bg-[#FFF9F7] md:grid md:grid-cols-[220px_1fr]">
      <aside className="border-r border-[#eadbd9] bg-white p-5">
        <p className="font-display text-lg text-[#30263B]">NABI BOOKS</p>
        <p className="text-xs text-[#746875]">Admin</p>
        <nav className="mt-8 space-y-1">
          {links.map(([href, label, Icon]) => (
            <Link key={href} href={href} className={`flex items-center gap-2 rounded px-3 py-2 text-sm ${location === href ? 'bg-[#FCE0E0] font-semibold text-[#48458F]' : 'text-[#5d5262] hover:bg-[#FFF1EC]'}`}>
              <Icon size={16} />{label}
            </Link>
          ))}
        </nav>
        <button onClick={() => adminSignOut()} className="mt-8 flex items-center gap-2 text-sm text-[#746875] hover:text-[#48458F]">
          <LogOut size={16} />Sign out
        </button>
      </aside>
      <main className="p-6 md:p-8">{children}</main>
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
