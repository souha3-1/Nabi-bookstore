import { type ChangeEvent, type FormEvent, type ReactNode, createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, useLocation, useParams, useSearch } from 'wouter';
import {
  ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, CircleAlert, Clock3, Heart,
  Instagram, Mail, MapPin, Menu, Minus, Package, Plus, Search, Send, ShoppingBag,
  SlidersHorizontal, Trash2, Twitter, X,
} from 'lucide-react';
import NotFound from '@/pages/not-found';
import AdminApp from '@/pages/admin';
import { type Product, type ProductKind, useCatalog } from '@/lib/catalog';
import { searchProducts } from '@/lib/search';
import { Highlight } from '@/components/highlight';
import { type SelectOption, SearchSelect } from '@/components/search-select';
import { type CheckoutErrors, type CheckoutValues, type StockProblem, DELIVERY_LABELS, EMPTY_CHECKOUT, newRequestId, placeOrder, readLastOrder, saveLastOrder, validateCheckout } from '@/lib/checkout';
import { WISHLIST_KEY, parseSavedWishlist, readSavedWishlist } from '@/lib/wishlist';
import { type CartItem, CART_KEY, FREE_SHIPPING_FROM, fitCartToStock, parseSavedCart, readSavedCart, saveToStorage, shippingFor } from '@/lib/cart';
import { submitContactMessage, type ContactTopic } from '@/lib/contact';
import { subscribeToNewsletter } from '@/lib/newsletter';



const money = (value: number) => `${new Intl.NumberFormat('fr-DZ', { maximumFractionDigits: 0 }).format(value)} DA`;

type StoreContextValue = {
  cart: CartItem[]; wishlist: string[]; cartCount: number; cartTotal: number;
  addToCart: (id: string, quantity?: number, variant?: string) => void;
  updateQuantity: (id: string, quantity: number, variant?: string) => void; removeFromCart: (id: string, variant?: string) => void;
  toggleWishlist: (id: string) => void; moveToCart: (id: string) => void; clearCart: () => void;
  notify: (message: string) => void;
};
const StoreContext = createContext<StoreContextValue | null>(null);
const useStore = () => {
  const value = useContext(StoreContext);
  if (!value) throw new Error('Store must be used within StoreProvider');
  return value;
};

function StoreProvider({ children }: { children: ReactNode }) {
  const { findProduct, isReady } = useCatalog();
  const [cart, setCart] = useState<CartItem[]>(readSavedCart);
  const [wishlist, setWishlist] = useState<string[]>(readSavedWishlist);
  const [toast, setToast] = useState('');
  useEffect(() => saveToStorage(CART_KEY, cart), [cart]);
  useEffect(() => saveToStorage(WISHLIST_KEY, wishlist), [wishlist]);
  // If the bag or the wishlist changes in another tab, this tab follows it.
  useEffect(() => {
    const follow = (event: StorageEvent) => {
      if (event.key === CART_KEY || event.key === null) setCart(parseSavedCart(event.key === null ? null : event.newValue));
      if (event.key === WISHLIST_KEY || event.key === null) setWishlist(parseSavedWishlist(event.key === null ? null : event.newValue));
    };
    window.addEventListener('storage', follow);
    return () => window.removeEventListener('storage', follow);
  }, []);
  // Only after a successful load: drop saved ids that are no longer in the catalog (never while loading or after an error).
  useEffect(() => {
    if (!isReady) return;
    setWishlist((current) => { const kept = current.filter((id) => findProduct(id)); return kept.length === current.length ? current : kept; });
  }, [isReady, findProduct]);
  // Keep the bag within what is in stock, and drop products that no longer exist (only after a successful load).
  useEffect(() => {
    if (!isReady) return;
    const fitted = fitCartToStock(cart, findProduct);
    if (fitted === cart) return;
    setCart(fitted);
    setToast('We updated your bag to match what is in stock');
  }, [isReady, findProduct, cart]);
  useEffect(() => { if (!toast) return; const timeout = window.setTimeout(() => setToast(''), 3200); return () => window.clearTimeout(timeout); }, [toast]);

  const value = useMemo<StoreContextValue>(() => ({
    cart, wishlist,
    cartCount: cart.reduce((sum, item) => sum + item.quantity, 0),
    cartTotal: cart.reduce((sum, item) => sum + (findProduct(item.id)?.price || 0) * item.quantity, 0),
    addToCart: (id, quantity = 1, variant = 'Default') => {
      const product = findProduct(id);
      const inBag = cart.filter((item) => item.id === id).reduce((sum, item) => sum + item.quantity, 0);
      const add = Math.min(quantity, Math.max(0, (product?.stock ?? 0) - inBag));
      if (add < 1) { setToast(product && product.stock > 0 ? 'All of them are already in your bag' : 'Sorry, that one is out of stock'); return; }
      setCart((current) => {
        const existing = current.find((item) => item.id === id && item.variant === variant);
        return existing ? current.map((item) => item === existing ? { ...item, quantity: item.quantity + add } : item) : [...current, { id, quantity: add, variant }];
      });
      setToast(add < quantity ? `Only ${add} more available, added to your bag` : `${product?.title || 'Item'} added to your bag`);
    },
    updateQuantity: (id, quantity, variant) => {
      const stock = findProduct(id)?.stock ?? 0;
      const others = cart.filter((item) => item.id === id && item.variant !== variant).reduce((sum, item) => sum + item.quantity, 0);
      const next = quantity < 1 ? quantity : Math.min(quantity, Math.max(0, stock - others));
      if (next < quantity) setToast(`Only ${stock} of these in stock`);
      setCart((current) => next < 1 ? current.filter((item) => item.id !== id || item.variant !== variant) : current.map((item) => item.id === id && item.variant === variant ? { ...item, quantity: next } : item));
    },
    removeFromCart: (id, variant) => { setCart((current) => current.filter((item) => item.id !== id || item.variant !== variant)); setToast('Removed from your bag'); },
    toggleWishlist: (id) => {
      setWishlist((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
      setToast(wishlist.includes(id) ? 'Removed from your wishlist' : 'Saved to your wishlist');
    },
    moveToCart: (id) => {
      const product = findProduct(id);
      if (!product || product.stock < 1) { setToast('Sorry, that one is out of stock'); return; }
      setCart((current) => current.some((item) => item.id === id) ? current : [...current, { id, quantity: 1, variant: 'Default' }]);
      setWishlist((current) => current.filter((item) => item !== id));
      setToast('Moved to your bag');
    },
    clearCart: () => setCart([]),
    notify: setToast,
  }), [cart, wishlist, findProduct]);
  return <StoreContext.Provider value={value}>{children}{toast && <div role="status" aria-live="polite" className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 bg-[#30263B] px-5 py-3 text-sm font-medium text-[#FFF9F7] shadow-xl animate-rise"><Check size={17} className="text-[#F8B2B2]" />{toast}<button aria-label="Dismiss message" data-testid="button-dismiss-toast" onClick={() => setToast('')}><X size={15} /></button></div>}</StoreContext.Provider>;
}

function Logo({ light = false }: { light?: boolean }) {
  return <Link href="/" className="flex items-center gap-2.5" data-testid="link-logo"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#48458F] text-[#FFF9F7]"><span className="font-display text-lg italic">N</span></span><span className={`font-display text-xl font-semibold tracking-[.08em] ${light ? 'text-[#FFF9F7]' : 'text-[#30263B]'}`}>NABI BOOKS</span></Link>;
}

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const { cartCount, wishlist } = useStore();
  const [query, setQuery] = useState('');
  const submitSearch = (event: FormEvent) => { event.preventDefault(); setLocation(query.trim() ? `/search?q=${encodeURIComponent(query.trim())}` : '/search'); setMenuOpen(false); };
  const navItems = [['Shop', '/shop'], ['Books', '/books'], ['Stationery', '/stationery'], ['Our story', '/about']];
  return <header className="sticky top-0 z-40 border-b border-[#eadbd9] bg-[#FFF9F7]/95 backdrop-blur-md">
    <div className="container-lunaria flex h-[74px] items-center justify-between gap-4">
      <Logo />
      <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary navigation">
        {navItems.map(([label, href]) => <Link key={href} href={href} className={`text-sm transition-colors hover:text-[#8B659C] ${location === href ? 'font-semibold text-[#48458F]' : 'text-[#5d5262]'}`} data-testid={`link-nav-${label.toLowerCase().replace(' ', '-')}`}>{label}</Link>)}
      </nav>
      <div className="flex items-center gap-1.5">
        <form onSubmit={submitSearch} className="hidden items-center rounded-full border border-[#e6d4d7] bg-[#FFF1EC] px-3 py-2 sm:flex" role="search">
          <button type="submit" aria-label="Search" className="mr-2 text-[#8B659C]"><Search size={16} /></button><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-[130px] bg-transparent text-sm outline-none placeholder:text-[#8b7c87]" placeholder="Search the shelves" aria-label="Search the shelves" data-testid="input-header-search" />
        </form>
        <Link href="/search" className="grid h-10 w-10 place-items-center rounded-full text-[#48458F] hover:bg-[#FCE0E0] sm:hidden" aria-label="Search" data-testid="link-search"><Search size={19} /></Link>
        <Link href="/wishlist" className="relative grid h-10 w-10 place-items-center rounded-full text-[#48458F] hover:bg-[#FCE0E0]" aria-label={`Wishlist, ${wishlist.length} items`} data-testid="link-wishlist"><Heart size={19} strokeWidth={1.8} />{wishlist.length > 0 && <span className="absolute right-0 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-[#B274A2] px-1 text-[10px] font-bold text-white">{wishlist.length}</span>}</Link>
        <Link href="/cart" className="relative grid h-10 w-10 place-items-center rounded-full text-[#48458F] hover:bg-[#FCE0E0]" aria-label={`Shopping bag, ${cartCount} items`} data-testid="link-cart"><ShoppingBag size={19} strokeWidth={1.8} />{cartCount > 0 && <span className="absolute right-0 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-[#48458F] px-1 text-[10px] font-bold text-white">{cartCount}</span>}</Link>
        <button className="grid h-10 w-10 place-items-center rounded-full text-[#48458F] hover:bg-[#FCE0E0] lg:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close menu' : 'Open menu'} data-testid="button-mobile-menu">{menuOpen ? <X size={21} /> : <Menu size={21} />}</button>
      </div>
    </div>
    {menuOpen && <div className="border-t border-[#eadbd9] bg-[#FFF9F7] px-4 py-5 lg:hidden animate-rise"><nav className="container-lunaria flex flex-col gap-4" aria-label="Mobile navigation">{navItems.map(([label, href]) => <Link key={href} href={href} onClick={() => setMenuOpen(false)} className="font-display text-2xl text-[#30263B]" data-testid={`link-mobile-${label.toLowerCase().replace(' ', '-')}`}>{label}</Link>)}<Link href="/contact" onClick={() => setMenuOpen(false)} className="text-sm text-[#5d5262]" data-testid="link-mobile-contact">Say hello</Link><form onSubmit={submitSearch} className="mt-2 flex items-center border-b border-[#8B659C] py-2"><button type="submit" aria-label="Search" className="mr-2 text-[#8B659C]"><Search size={17} /></button><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent outline-none" placeholder="Find a title, author, or color" aria-label="Search" data-testid="input-mobile-search" /></form></nav></div>}
  </header>;
}

function Footer() {
  const [email, setEmail] = useState('');
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);
  const [subscribeError, setSubscribeError] = useState('');
  const submit = async (event: FormEvent) => { event.preventDefault(); setPending(true); setSubscribeError(''); const result = await subscribeToNewsletter(email); setPending(false); if (result.ok) { setSuccess(true); } else { setSubscribeError('Please use a valid email address.'); } };
  return <footer className="mt-24 bg-[#30263B] text-[#FFF9F7]">
    <div className="container-lunaria grid gap-12 py-14 md:grid-cols-[1.2fr_.8fr_.8fr_1.4fr]">
       <div><Logo light /><p className="mt-5 max-w-[230px] text-sm leading-6 text-[#e5d8e0]">Books, paper goods, and small reasons to stay curious. From Algiers, with care.</p><div className="mt-6 flex gap-3"><a href="https://instagram.com" aria-label="Instagram" className="grid h-9 w-9 place-items-center rounded-full border border-[#6b5e79] hover:bg-[#48458F]" data-testid="link-instagram"><Instagram size={16} /></a><a href="https://twitter.com" aria-label="Twitter" className="grid h-9 w-9 place-items-center rounded-full border border-[#6b5e79] hover:bg-[#48458F]" data-testid="link-twitter"><Twitter size={16} /></a></div></div>
      <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#F8B2B2]">Browse</p><div className="mt-5 flex flex-col gap-3 text-sm text-[#e5d8e0]"><Link href="/books" className="hover:text-white" data-testid="link-footer-books">Books</Link><Link href="/stationery" className="hover:text-white" data-testid="link-footer-stationery">Stationery</Link><Link href="/shop" className="hover:text-white" data-testid="link-footer-shop">All shelves</Link><Link href="/wishlist" className="hover:text-white" data-testid="link-footer-wishlist">Wishlist</Link></div></div>
       <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#F8B2B2]">Visit</p><div className="mt-5 space-y-3 text-sm leading-5 text-[#e5d8e0]"><p>Algiers, Algeria<br />DZ · 16000</p><p>Sat–Thu · 10–18<br />Friday · closed</p><Link href="/contact" className="inline-block text-[#F8B2B2] hover:text-white" data-testid="link-footer-contact">Get in touch →</Link></div></div>
      <div><p className="font-display text-2xl">A note for your inbox</p><p className="mt-2 text-sm leading-6 text-[#e5d8e0]">New arrivals, reading rituals, and the occasional very good recommendation.</p>{success ? <div className="mt-5 flex items-center gap-2 text-sm text-[#F8B2B2]"><Check size={16} />You are on the list.</div> : <form onSubmit={submit} className="mt-5 flex border-b border-[#8f8197] pb-2"><input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required placeholder="Your email address" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#b8aab7]" aria-label="Email address" data-testid="input-newsletter-email" /><button disabled={pending} type="submit" aria-label="Subscribe to newsletter" className="text-[#F8B2B2] hover:text-white" data-testid="button-newsletter-submit"><Send size={17} /></button>{subscribeError && <p className="text-xs text-[#F8B2B2]" role="alert" data-testid="text-newsletter-error">{subscribeError}</p>}</form>}</div>
    </div>
     <div className="border-t border-[#4e435b] py-5 text-center text-xs text-[#aa9eae]">© 2026 NABI BOOKS · Made for slow browsing.</div>
  </footer>;
}

function Shell({ children }: { children: ReactNode }) {
  return <><Header /><main>{children}</main><Footer /></>;
}

function ProductImage({ product, large = false }: { product: Product; large?: boolean }) {
  return <img src={product.image} alt={`${product.title} cover`} className={`product-image ${large ? 'product-image-large' : ''}`} />;
}

function ProductCard({ product, index = 0, highlight }: { product: Product; index?: number; highlight?: string }) {
  const { wishlist, toggleWishlist, addToCart } = useStore();
  const saved = wishlist.includes(product.id);
  return <article className="group animate-rise" style={{ animationDelay: `${index * 70}ms` }} data-testid={`card-product-${product.id}`}>
    <div className="relative">
      <Link href={`/product/${product.id}`} className="block" data-testid={`link-product-${product.id}`}><ProductImage product={product} /></Link>
      {product.badge && <span className="absolute left-3 top-3 rounded-full bg-[#FFF9F7] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-[#48458F] shadow-sm">{product.badge}</span>}
      <button onClick={() => toggleWishlist(product.id)} aria-label={saved ? `Remove ${product.title} from wishlist` : `Save ${product.title} to wishlist`} className={`absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-[#FFF9F7]/90 transition hover:bg-[#FCE0E0] ${saved ? 'text-[#B274A2]' : 'text-[#48458F]'}`} data-testid={`button-wishlist-${product.id}`}><Heart size={17} fill={saved ? 'currentColor' : 'none'} /></button>
    </div>
    <div className="pt-4"><div className="flex items-start justify-between gap-3"><div><Link href={`/product/${product.id}`} className="font-display text-[1.18rem] leading-5 text-[#30263B] hover:text-[#48458F]" data-testid={`link-title-${product.id}`}><Highlight text={product.title} query={highlight} /></Link><p className="mt-1 text-xs text-[#746875]"><Highlight text={product.author || product.type || ''} query={highlight} /></p></div><p className="whitespace-nowrap text-sm font-semibold text-[#48458F]">{money(product.price)}</p></div><div className="mt-3 flex items-center justify-end">{product.stock < 1 ? <span className="text-xs font-bold uppercase tracking-[.13em] text-[#746875]" data-testid={`text-soldout-${product.id}`}>Out of stock</span> : <button onClick={() => addToCart(product.id)} className="text-xs font-bold uppercase tracking-[.13em] text-[#48458F] underline decoration-[#F8B2B2] decoration-2 underline-offset-4 hover:text-[#B274A2]" data-testid={`button-add-${product.id}`}>Add to bag</button>}</div></div>
  </article>;
}

function SectionHeading({ eyebrow, title, description, href, linkLabel }: { eyebrow: string; title: string; description?: string; href?: string; linkLabel?: string }) {
  return <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#B274A2]">{eyebrow}</p><h2 className="mt-2 font-display text-4xl leading-tight tracking-[-.03em] text-[#30263B] md:text-5xl">{title}</h2>{description && <p className="mt-3 max-w-lg text-sm leading-6 text-[#746875]">{description}</p>}</div>{href && <Link href={href} className="group flex items-center gap-2 text-sm font-bold text-[#48458F]" data-testid={`link-section-${linkLabel?.toLowerCase().replaceAll(' ', '-')}`}><span>{linkLabel}</span><ArrowRight size={16} className="transition-transform group-hover:translate-x-1" /></Link>}</div>;
}

function Home() {
  const { products, isLoading, isError } = useCatalog();
  const featured = products.filter((product) => product.featured).slice(0, 4);
  return <Shell><section className="paper-grain overflow-hidden bg-[#FCE0E0]"><div className="container-lunaria grid min-h-[570px] items-center gap-10 py-16 md:grid-cols-[1.03fr_.97fr] md:py-20"><div className="animate-rise"><p className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-[#8B659C]"><span className="h-px w-8 bg-[#B274A2]" />A little shop for big imaginations</p><h1 className="max-w-[580px] font-display text-[clamp(3.6rem,8vw,7.7rem)] leading-[.88] tracking-[-.065em] text-[#30263B]">Find your next <em className="text-[#48458F]">favourite</em> thing.</h1><p className="mt-7 max-w-[430px] text-base leading-7 text-[#5e5262]">Independent books, thoughtful paper goods, and gifts chosen in Algiers for people who still like to wander through a shop.</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/shop" className="inline-flex items-center gap-3 bg-[#48458F] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#30263B]" data-testid="link-hero-shop">Browse the shelves <ArrowRight size={16} /></Link><Link href="/about" className="inline-flex items-center gap-2 border border-[#8B659C] px-6 py-3.5 text-sm font-bold text-[#48458F] hover:bg-[#FFF9F7]/60" data-testid="link-hero-story">Our story</Link></div></div><div className="relative mx-auto h-[390px] w-full max-w-[470px] animate-rise md:h-[450px]" style={{ animationDelay: '.12s' }}><div className="absolute left-[10%] top-[7%] h-[77%] w-[55%] rotate-[-8deg] bg-[#48458F] p-7 text-[#FFF9F7] shadow-2xl"><span className="text-[10px] font-bold tracking-[.25em]">NABI BOOKS</span><div className="mt-20 font-display text-4xl leading-[.9]">Stories<br /><em>worth<br />keeping.</em></div><div className="absolute bottom-6 text-xs text-[#F8B2B2]">BOOKS · PAPER · WONDER</div></div><div className="absolute bottom-[1%] right-[6%] h-[75%] w-[47%] rotate-[9deg] bg-[#FFF9F7] p-6 shadow-xl"><span className="text-[10px] font-bold tracking-[.25em] text-[#B274A2]">A SMALL NOTE</span><div className="mt-16 font-display text-4xl leading-[.9] text-[#30263B]">Take<br /><em>your<br />time.</em></div><div className="absolute bottom-7 left-6 h-2 w-24 bg-[#F8B2B2]" /></div><div className="animate-float absolute right-[9%] top-[9%] grid h-16 w-16 place-items-center rounded-full border border-[#48458F] bg-[#F8B2B2] text-center font-display text-lg leading-4 text-[#48458F]">read<br />slowly</div></div></div></section>
    <section className="container-lunaria py-20 md:py-28"><SectionHeading eyebrow="From the front table" title="New things, good company." description="A rotating edit of books and paper goods that have earned their place in our front window." href="/shop" linkLabel="See everything" /><div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-6">{isLoading ? <p className="col-span-full text-sm text-[#746875]" role="status">Fetching the shelves…</p> : isError ? <p className="col-span-full text-sm text-[#746875]" role="alert">We could not load the shelves just now. Please refresh in a moment.</p> : featured.map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}</div></section>
    <section className="bg-[#E8D7F0] py-20"><div className="container-lunaria grid items-center gap-10 md:grid-cols-[.9fr_1.1fr]"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#8B659C]">The reading room</p><h2 className="mt-3 max-w-md font-display text-4xl leading-tight text-[#30263B] md:text-5xl">A good book changes the shape of an afternoon.</h2><p className="mt-5 max-w-md text-sm leading-7 text-[#5e5262]">Our booksellers read widely and recommend honestly. Start with a mood, a question, or simply the color you want to see on your bedside table.</p><Link href="/books" className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-[#48458F]" data-testid="link-reading-room">Enter the reading room <ArrowRight size={16} /></Link></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{['I need a fresh start', 'For a rainy Sunday', 'A gift for a maker', 'Something to underline'].map((text, index) => <Link key={text} href={index === 2 ? '/stationery' : '/books'} className={`flex min-h-[148px] items-end p-4 text-sm font-semibold leading-5 ${index % 2 === 0 ? 'bg-[#FFF9F7]' : 'bg-[#F8B2B2]'} text-[#30263B] transition hover:-translate-y-1`} data-testid={`link-mood-${index}`}><span>{text}<br /><span className="mt-2 inline-block text-xs font-normal text-[#746875]">Explore →</span></span></Link>)}</div></div></section>
    <section className="container-lunaria py-20 md:py-28"><div className="grid items-center gap-8 border-y border-[#eadbd9] py-10 md:grid-cols-[1fr_2fr]"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#B274A2]">A note from the counter</p><p className="mt-3 font-display text-3xl leading-tight text-[#30263B]">“The nicest shops leave a little room for surprise.”</p></div><div className="flex flex-wrap items-center justify-between gap-6"><div className="flex -space-x-2">{['MV', 'EP', 'NS', 'IB'].map((initials) => <span key={initials} className="grid h-10 w-10 place-items-center rounded-full border-2 border-[#FFF9F7] bg-[#B274A2] text-xs font-bold text-white">{initials}</span>)}</div><p className="max-w-xs text-sm leading-6 text-[#746875]">Join 2,400 curious readers getting our monthly list of books we cannot stop talking about.</p><Link href="/contact" className="text-sm font-bold text-[#48458F] underline decoration-[#F8B2B2] decoration-2 underline-offset-4" data-testid="link-home-contact">Come say hello</Link></div></div></section>
  </Shell>;
}

function Catalog({ kind, title, eyebrow, description }: { kind?: ProductKind; title: string; eyebrow: string; description: string }) {
  const { products, isLoading, isError } = useCatalog();
  const [sort, setSort] = useState('featured');
  const [filter, setFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const filtered = useMemo(() => products.filter((product) => !kind || product.kind === kind).filter((product) => filter === 'all' || product.availability.startsWith('Only')).sort((a, b) => sort === 'low' ? a.price - b.price : sort === 'high' ? b.price - a.price : products.indexOf(a) - products.indexOf(b)), [products, kind, sort, filter]);
  if (isLoading) return <Shell><CatalogNotice state="loading" /></Shell>;
  if (isError) return <Shell><CatalogNotice state="error" /></Shell>;
  return <Shell><div className="bg-[#FFF1EC]"><div className="container-lunaria py-14 md:py-20"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#B274A2]">{eyebrow}</p><h1 className="mt-3 font-display text-5xl tracking-[-.04em] text-[#30263B] md:text-7xl">{title}</h1><p className="mt-4 max-w-xl text-base leading-7 text-[#746875]">{description}</p></div></div><section className="container-lunaria py-10 md:py-14"><div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-[#eadbd9] pb-5"><p className="text-sm text-[#746875]"><strong className="text-[#30263B]">{filtered.length}</strong> thoughtfully chosen pieces</p><div className="flex gap-2"><button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-2 border border-[#e6d4d7] px-3 py-2 text-xs font-bold uppercase tracking-[.1em] text-[#48458F] md:hidden" data-testid="button-toggle-filters"><SlidersHorizontal size={15} />Filter</button><label className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.1em] text-[#746875]">Sort<select value={sort} onChange={(event) => setSort(event.target.value)} className="bg-transparent text-[#48458F] outline-none" aria-label="Sort products" data-testid="select-sort"><option value="featured">Featured</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select><ChevronDown size={14} /></label></div></div>{showFilters && <div className="mb-7 flex gap-2 border-b border-[#eadbd9] pb-6 md:hidden"><button onClick={() => setFilter('all')} className={`border px-3 py-2 text-xs ${filter === 'all' ? 'border-[#48458F] bg-[#48458F] text-white' : 'border-[#e6d4d7]'}`} data-testid="button-filter-all">All</button><button onClick={() => setFilter('limited')} className={`border px-3 py-2 text-xs ${filter === 'limited' ? 'border-[#48458F] bg-[#48458F] text-white' : 'border-[#e6d4d7]'}`} data-testid="button-filter-limited">Limited stock</button></div>}<div className="grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-3 md:gap-x-7 lg:grid-cols-4">{filtered.map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}</div>{filtered.length === 0 && <EmptyState title="Nothing on this shelf yet" message="Try widening your filters and see where the browsing takes you." href="/shop" label="Back to all shelves" />}</section></Shell>;
}

function ProductPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { findProduct, isLoading, isError } = useCatalog();
  const product = findProduct(id);
  if (isLoading) return <Shell><CatalogNotice state="loading" /></Shell>;
  if (isError) return <Shell><CatalogNotice state="error" /></Shell>;
  if (!product) return <Shell><EmptyState title="That title has wandered off" message="We could not find the item you were looking for." href="/shop" label="Return to the shelves" /></Shell>;
  return <ProductDetail key={product.id} product={product} />;
}

function ProductDetail({ product }: { product: Product }) {
  const { cart, wishlist, toggleWishlist, addToCart } = useStore();
  const [quantity, setQuantity] = useState(1);
  const room = Math.max(0, product.stock - cart.filter((line) => line.id === product.id).reduce((sum, line) => sum + line.quantity, 0));
  const qty = Math.min(quantity, Math.max(room, 1));
  const [variant, setVariant] = useState(product.colors[0] || 'Default');
  return <Shell><div className="container-lunaria py-8 md:py-14"><Link href={product.kind === 'book' ? '/books' : '/stationery'} className="mb-8 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.13em] text-[#746875]" data-testid="link-product-back"><ArrowLeft size={15} />Back to {product.kind === 'book' ? 'books' : 'stationery'}</Link><div className="grid gap-10 md:grid-cols-[.9fr_1.1fr] md:gap-16"><div><ProductImage product={product} large /></div><div className="flex flex-col justify-center"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#B274A2]">{product.kind === 'book' ? 'A book to keep close' : product.type}</p><h1 className="mt-3 font-display text-5xl leading-[.98] tracking-[-.04em] text-[#30263B] md:text-6xl">{product.title}</h1><p className="mt-3 font-display text-xl italic text-[#8B659C]">{product.author || 'A NABI BOOKS paper good'}</p><div className="mt-5 flex items-center gap-4"><span className="text-sm text-[#B274A2]">{product.availability}</span></div><p className="mt-7 max-w-lg text-base leading-7 text-[#5e5262]">{product.description}</p><p className="mt-7 border-t border-[#eadbd9] pt-5 text-2xl font-semibold text-[#48458F]">{money(product.price)}</p><div className="mt-6 flex flex-wrap gap-3">{product.colors.map((color) => <button key={color} onClick={() => setVariant(color)} className={`border px-4 py-2 text-sm ${variant === color ? 'border-[#48458F] bg-[#48458F] text-white' : 'border-[#e6d4d7] text-[#5e5262] hover:border-[#48458F]'}`} data-testid={`button-variant-${color.toLowerCase()}`}>{color}</button>)}</div><div className="mt-7 flex flex-wrap gap-3"><div className="flex items-center border border-[#d9c5cb]"><button onClick={() => setQuantity(Math.max(1, qty - 1))} className="grid h-12 w-11 place-items-center text-[#48458F] hover:bg-[#FCE0E0]" aria-label="Decrease quantity" data-testid="button-quantity-decrease"><Minus size={15} /></button><span className="w-9 text-center text-sm" data-testid="text-product-quantity">{qty}</span><button onClick={() => setQuantity(Math.min(room, qty + 1))} disabled={qty >= room} className="grid h-12 w-11 place-items-center text-[#48458F] hover:bg-[#FCE0E0] disabled:cursor-not-allowed disabled:opacity-40" aria-label="Increase quantity" data-testid="button-quantity-increase"><Plus size={15} /></button></div><button onClick={() => addToCart(product.id, qty, variant)} disabled={room < 1} className="flex h-12 flex-1 items-center justify-center gap-2 bg-[#48458F] px-7 text-sm font-bold text-white transition hover:bg-[#30263B] disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none" data-testid="button-product-add">{product.stock < 1 ? 'Out of stock' : room < 1 ? 'All in your bag' : 'Add to bag'} <ShoppingBag size={16} /></button><button onClick={() => toggleWishlist(product.id)} className={`grid h-12 w-12 place-items-center border ${wishlist.includes(product.id) ? 'border-[#B274A2] text-[#B274A2]' : 'border-[#d9c5cb] text-[#48458F]'} hover:bg-[#FCE0E0]`} aria-label="Toggle wishlist" data-testid="button-product-wishlist"><Heart size={18} fill={wishlist.includes(product.id) ? 'currentColor' : 'none'} /></button></div><div className="mt-8 grid gap-3 border-t border-[#eadbd9] pt-6 text-sm text-[#746875] sm:grid-cols-2"><p className="flex gap-2"><Package size={17} className="shrink-0 text-[#B274A2]" /> Carefully packed in recyclable materials</p><p className="flex gap-2"><BookOpen size={17} className="shrink-0 text-[#B274A2]" /> {product.details}</p></div></div></div></div></Shell>;
}

function EmptyState({ title, message, href, label }: { title: string; message: string; href: string; label: string }) {
  return <div className="container-lunaria flex min-h-[430px] flex-col items-center justify-center py-20 text-center"><div className="grid h-16 w-16 place-items-center rounded-full bg-[#E8D7F0] text-[#48458F]"><BookOpen size={25} /></div><h1 className="mt-6 font-display text-4xl text-[#30263B]">{title}</h1><p className="mt-3 max-w-sm text-sm leading-6 text-[#746875]">{message}</p><Link href={href} className="mt-7 bg-[#48458F] px-6 py-3 text-sm font-bold text-white" data-testid="link-empty-action">{label}</Link></div>;
}

function CatalogNotice({ state }: { state: 'loading' | 'error' }) {
  const { refetch } = useCatalog();
  return <div role={state === 'error' ? 'alert' : 'status'} className="container-lunaria flex min-h-[430px] flex-col items-center justify-center py-20 text-center"><div className="grid h-16 w-16 place-items-center rounded-full bg-[#E8D7F0] text-[#48458F]"><BookOpen size={25} /></div>{state === 'loading' ? <><h1 className="mt-6 font-display text-4xl text-[#30263B]">Fetching the shelves…</h1><p className="mt-3 max-w-sm text-sm leading-6 text-[#746875]">One moment while we lay everything out.</p></> : <><h1 className="mt-6 font-display text-4xl text-[#30263B]">The shelves are out of reach</h1><p className="mt-3 max-w-sm text-sm leading-6 text-[#746875]">We could not load the shop just now. Check your connection and try again.</p><button onClick={() => refetch()} className="mt-7 bg-[#48458F] px-6 py-3 text-sm font-bold text-white" data-testid="button-retry-catalog">Try again</button></>}</div>;
}

function CartPage() {
  const { cart, cartTotal, updateQuantity, removeFromCart } = useStore();
  const { findProduct, isLoading, isError } = useCatalog();
  const shipping = shippingFor(cartTotal);
  if (cart.length === 0) return <Shell><EmptyState title="Your bag is waiting" message="A good browsing session should end with at least one maybe. Take another turn around the shelves." href="/shop" label="Keep browsing" /></Shell>;
  if (isLoading) return <Shell><CatalogNotice state="loading" /></Shell>;
  if (isError) return <Shell><CatalogNotice state="error" /></Shell>;
  return <Shell><div className="container-lunaria py-14 md:py-20"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#B274A2]">Your little stack</p><h1 className="mt-3 font-display text-5xl text-[#30263B] md:text-6xl">Your bag</h1><div className="mt-10 grid gap-10 lg:grid-cols-[1fr_360px]"><div className="divide-y divide-[#eadbd9] border-y border-[#eadbd9]">{cart.map((item) => { const product = findProduct(item.id); if (!product) return null; return <div key={`${item.id}-${item.variant}`} className="flex gap-4 py-6 sm:gap-6" data-testid={`row-cart-${item.id}`}><div className="w-24 shrink-0 sm:w-32"><ProductImage product={product} /></div><div className="flex min-w-0 flex-1 flex-col justify-between gap-4 sm:flex-row"><div><Link href={`/product/${product.id}`} className="font-display text-xl text-[#30263B] hover:text-[#48458F]" data-testid={`link-cart-product-${product.id}`}>{product.title}</Link><p className="mt-1 text-sm text-[#746875]">{product.author || product.type}</p><button onClick={() => removeFromCart(item.id, item.variant)} className="mt-4 flex items-center gap-1 text-xs font-bold uppercase tracking-[.1em] text-[#B274A2] hover:text-[#48458F]" data-testid={`button-remove-${product.id}`}><Trash2 size={13} />Remove</button></div><div className="flex items-center justify-between gap-8 sm:flex-col sm:items-end"><p className="font-semibold text-[#48458F]">{money(product.price * item.quantity)}</p><div className="flex items-center border border-[#d9c5cb]"><button onClick={() => updateQuantity(item.id, item.quantity - 1, item.variant)} className="grid h-8 w-8 place-items-center text-[#48458F]" aria-label="Decrease quantity" data-testid={`button-cart-minus-${product.id}`}><Minus size={14} /></button><span className="w-8 text-center text-sm">{item.quantity}</span><button onClick={() => updateQuantity(item.id, item.quantity + 1, item.variant)} disabled={cart.filter((line) => line.id === item.id).reduce((sum, line) => sum + line.quantity, 0) >= product.stock} className="grid h-8 w-8 place-items-center text-[#48458F] disabled:cursor-not-allowed disabled:opacity-40" aria-label="Increase quantity" data-testid={`button-cart-plus-${product.id}`}><Plus size={14} /></button></div></div></div></div>; })}</div><aside className="h-fit bg-[#FFF1EC] p-6 md:p-7"><h2 className="font-display text-2xl text-[#30263B]">A few numbers</h2><div className="mt-6 space-y-4 text-sm text-[#746875]"><div className="flex justify-between"><span>Subtotal</span><span className="font-semibold text-[#30263B]">{money(cartTotal)}</span></div><div className="flex justify-between"><span>Shipping</span><span className="font-semibold text-[#30263B]">{shipping ? money(shipping) : 'Free'}</span></div><div className="border-t border-[#e2cfd0] pt-4 text-base font-bold text-[#30263B] flex justify-between"><span>Total</span><span>{money(cartTotal + shipping)}</span></div></div><Link href="/checkout" className="mt-7 flex w-full items-center justify-center gap-2 bg-[#48458F] py-3.5 text-sm font-bold text-white hover:bg-[#30263B]" data-testid="button-checkout">Continue to checkout <ArrowRight size={16} /></Link><p className="mt-4 text-center text-xs leading-5 text-[#746875]">{`Free shipping on orders over ${FREE_SHIPPING_FROM.toLocaleString('en-US')} DA. No account needed.`}</p></aside></div></div></Shell>;
}

function WishlistPage() {
  const { wishlist, moveToCart, toggleWishlist } = useStore();
  const { products, isLoading, isError } = useCatalog();
  const saved = products.filter((product) => wishlist.includes(product.id));
  if (wishlist.length > 0 && isLoading) return <Shell><CatalogNotice state="loading" /></Shell>;
  if (wishlist.length > 0 && isError) return <Shell><CatalogNotice state="error" /></Shell>;
  return <Shell><div className="container-lunaria py-14 md:py-20"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#B274A2]">Things worth keeping</p><h1 className="mt-3 font-display text-5xl text-[#30263B] md:text-6xl">Your wishlist</h1>{saved.length === 0 ? <EmptyState title="Save a little magic" message="Tap the heart on anything that catches your eye and it will wait here for you." href="/shop" label="Browse the shelves" /> : <><p className="mt-4 text-sm text-[#746875]">{saved.length} saved {saved.length === 1 ? 'piece' : 'pieces'}</p><div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-3 md:gap-7 lg:grid-cols-4">{saved.map((product, index) => <div key={product.id} className="relative"><ProductCard product={product} index={index} /><div className="mt-3 flex gap-2"><button onClick={() => moveToCart(product.id)} disabled={product.stock < 1} className="flex-1 border border-[#48458F] py-2 text-xs font-bold uppercase tracking-[.1em] text-[#48458F] hover:bg-[#48458F] hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-[#48458F]" data-testid={`button-move-cart-${product.id}`}>{product.stock < 1 ? 'Out of stock' : 'Move to bag'}</button><button onClick={() => toggleWishlist(product.id)} className="grid w-10 place-items-center border border-[#e6d4d7] text-[#B274A2]" aria-label={`Remove ${product.title}`} data-testid={`button-remove-wishlist-${product.id}`}><X size={16} /></button></div></div>)}</div></>}</div></Shell>;
}

function SearchPage() {
  const [, setLocation] = useLocation();
  const query = new URLSearchParams(useSearch()).get('q') || '';
  const [value, setValue] = useState(query);
  useEffect(() => setValue(query), [query]);
  const { products, isLoading, isError } = useCatalog();
  const results = searchProducts(products, query);
  const submit = (event: FormEvent) => { event.preventDefault(); setLocation(`/search?q=${encodeURIComponent(value)}`); };
  if (query && isLoading) return <Shell><CatalogNotice state="loading" /></Shell>;
  if (query && isError) return <Shell><CatalogNotice state="error" /></Shell>;
  return <Shell><div className="container-lunaria py-14 md:py-20"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#B274A2]">Take a look around</p><h1 className="mt-3 font-display text-5xl text-[#30263B] md:text-6xl">Search the shelves</h1><form onSubmit={submit} className="mt-8 flex max-w-2xl items-center border-b-2 border-[#48458F] py-3"><button type="submit" aria-label="Search" tabIndex={-1} className="mr-3 text-[#B274A2]"><Search size={20} /></button><input autoFocus value={value} onChange={(event) => setValue(event.target.value)} className="min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-[#b2a4ab]" placeholder="Try “poetry”, “journal”, or an author" aria-label="Search catalog" data-testid="input-search-page" /><button className="text-sm font-bold text-[#48458F]" data-testid="button-search-submit">Search</button></form>{query && <p className="mt-10 text-sm text-[#746875]">Showing {results.length} results for <strong className="text-[#30263B]">“{query}”</strong></p>}{query && results.length > 0 && <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-3 md:gap-7 lg:grid-cols-4">{results.map((product, index) => <ProductCard key={product.id} product={product} index={index} highlight={query} />)}</div>}{query && results.length === 0 && <EmptyState title="No exact match" message="Try a shorter phrase, or browse the shelves by mood instead." href="/shop" label="See all products" />}</div></Shell>;
}

function About() {
  return <Shell><section className="bg-[#E8D7F0]"><div className="container-lunaria grid min-h-[460px] items-center gap-10 py-16 md:grid-cols-[1fr_.8fr] md:py-24"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#B274A2]">The story of NABI BOOKS</p><h1 className="mt-4 max-w-xl font-display text-6xl leading-[.92] tracking-[-.05em] text-[#30263B] md:text-8xl">A shop with its pages open.</h1></div><div className="border-l-2 border-[#B274A2] pl-6 text-base leading-8 text-[#5e5262]"><p>NABI BOOKS is a placeholder for an independent Algerian bookstore where browsing feels like a form of luck — the right sentence overheard, the right notebook at the right moment.</p><p className="mt-5">Thoughtfully chosen in Algiers, with a little bit of curiosity about what you might love next.</p></div></div></section><section className="container-lunaria grid gap-12 py-20 md:grid-cols-[1.1fr_.9fr] md:py-28"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#B274A2]">What we believe</p><div className="mt-8 space-y-9">{[['01', 'Choose the unexpected', 'Our shelves make room for new voices, odd little treasures, and books that stay with you longer than expected.'], ['02', 'Paper is a place', 'A notebook is not just a container. It is an invitation to slow down and make a thought visible.'], ['03', 'Keep it human', 'We would rather make one honest recommendation than shout about everything at once.']].map(([number, title, copy]) => <div key={number} className="grid grid-cols-[42px_1fr] gap-5 border-t border-[#eadbd9] pt-5"><span className="font-mono text-sm text-[#B274A2]">{number}</span><div><h2 className="font-display text-2xl text-[#30263B]">{title}</h2><p className="mt-2 max-w-md text-sm leading-6 text-[#746875]">{copy}</p></div></div>)}</div></div><div className="relative min-h-[390px] bg-[#F8B2B2] p-8"><div className="absolute inset-7 border border-[#8B659C]" /><div className="relative flex h-full flex-col justify-between"><span className="text-xs font-bold uppercase tracking-[.18em] text-[#48458F]">Algiers · Algeria</span><p className="max-w-[250px] font-display text-4xl leading-tight text-[#30263B]">Come in for one thing.<br /><em>Leave with a story.</em></p><div className="flex justify-between text-xs font-bold uppercase tracking-[.15em] text-[#48458F]"><span>Books</span><span>Paper</span><span>Gifts</span></div></div></div></section><section className="bg-[#FFF1EC] py-16"><div className="container-lunaria flex flex-col items-center text-center"><p className="font-display text-3xl text-[#30263B]">“A bright spot for anyone who likes their errands a little dreamy.”</p><p className="mt-4 text-xs font-bold uppercase tracking-[.15em] text-[#B274A2]">— A sample note from NABI BOOKS</p></div></section></Shell>;
}

function Contact() {
  const [sent, setSent] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState<ContactTopic>('Book recommendation');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [contactError, setContactError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setPending(true); setContactError(''); const result = await submitContactMessage({ name, email, topic, message }); setPending(false); if (result.ok) { setSent(true); } else { setContactError('Please check the highlighted fields and try again.'); } };
  return <Shell><div className="container-lunaria grid gap-12 py-14 md:grid-cols-[.8fr_1.2fr] md:py-24"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#B274A2]">Come say hello</p><h1 className="mt-4 font-display text-6xl leading-[.92] text-[#30263B]">We'd love to hear from you.</h1><p className="mt-6 max-w-sm text-sm leading-7 text-[#746875]">A recommendation request, a question about an order, or a story about a book that found you at the right time.</p><div className="mt-10 space-y-5 text-sm text-[#5e5262]"><p className="flex gap-3"><MapPin size={19} className="text-[#B274A2]" />Algiers, Algeria<br />DZ · 16000</p><p className="flex gap-3"><Clock3 size={19} className="text-[#B274A2]" />Saturday–Thursday, 10am–6pm<br />Friday · closed</p><p className="flex gap-3"><Mail size={19} className="text-[#B274A2]" />hello@nabibooks.dz</p></div></div><div className="bg-[#FFF1EC] p-6 md:p-10">{sent ? <div className="flex min-h-[440px] flex-col items-center justify-center text-center"><div className="grid h-16 w-16 place-items-center rounded-full bg-[#E8D7F0] text-[#48458F]"><Check size={28} /></div><h2 className="mt-6 font-display text-4xl text-[#30263B]">Message received.</h2><p className="mt-3 max-w-sm text-sm leading-6 text-[#746875]">We will write back soon — usually within one or two open-shop days.</p><button onClick={() => setSent(false)} className="mt-7 text-sm font-bold text-[#48458F] underline decoration-[#F8B2B2] decoration-2 underline-offset-4" data-testid="button-send-another">Send another note</button></div> : <form onSubmit={submit} className="space-y-6"><div className="grid gap-6 sm:grid-cols-2"><label className="text-xs font-bold uppercase tracking-[.1em] text-[#746875]">Name<input value={name} onChange={(event) => setName(event.target.value)} required className="mt-2 w-full border-b border-[#d9c5cb] bg-transparent py-3 text-sm outline-none focus:border-[#48458F]" placeholder="Your name" data-testid="input-contact-name" /></label><label className="text-xs font-bold uppercase tracking-[.1em] text-[#746875]">Email<input value={email} onChange={(event) => setEmail(event.target.value)} required type="email" className="mt-2 w-full border-b border-[#d9c5cb] bg-transparent py-3 text-sm outline-none focus:border-[#48458F]" placeholder="you@example.com" data-testid="input-contact-email" /></label></div><label className="block text-xs font-bold uppercase tracking-[.1em] text-[#746875]">What can we help with?<select value={topic} onChange={(event) => setTopic(event.target.value as ContactTopic)} className="mt-2 w-full border-b border-[#d9c5cb] bg-transparent py-3 text-sm outline-none focus:border-[#48458F]" data-testid="select-contact-topic"><option>Book recommendation</option><option>Order question</option><option>Shop visit</option><option>Something else</option></select></label><label className="block text-xs font-bold uppercase tracking-[.1em] text-[#746875]">Your note<textarea value={message} onChange={(event) => setMessage(event.target.value)} required rows={6} className="mt-2 w-full resize-none border-b border-[#d9c5cb] bg-transparent py-3 text-sm outline-none focus:border-[#48458F]" placeholder="Tell us a little..." data-testid="textarea-contact-message" /></label>{contactError && <p className="text-xs text-[#B23B3B]" role="alert" data-testid="text-contact-error">{contactError}</p>}<button disabled={pending} type="submit" className="flex items-center gap-2 bg-[#48458F] px-7 py-3.5 text-sm font-bold text-white hover:bg-[#30263B]" data-testid="button-contact-submit">{pending ? 'Sending…' : 'Send your note'} <Send size={16} /></button></form>}</div></div></Shell>;
}

type CheckoutFieldProps = {
  name: 'name' | 'phone' | 'address' | 'notes'; label: string; value: string; onChange: (value: string) => void; error?: string;
  optional?: boolean; multiline?: boolean; type?: string; autoComplete?: string; inputMode?: 'text' | 'tel'; placeholder?: string;
};

function CheckoutField({ name, label, value, onChange, error, optional, multiline, type = 'text', autoComplete, inputMode, placeholder }: CheckoutFieldProps) {
  const id = `checkout-${name}`;
  const shared = {
    id, name, value, autoComplete, placeholder,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value),
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-error` : undefined,
    'data-testid': `input-checkout-${name}`,
  };
  const look = `mt-2 w-full border-b bg-transparent py-3 text-sm outline-none focus:border-[#48458F] ${error ? 'border-[#B23A48]' : 'border-[#d9c5cb]'}`;
  return <div>
    <label htmlFor={id} className="block text-xs font-bold uppercase tracking-[.1em] text-[#746875]">{label}{optional && <span className="ml-2 font-normal normal-case tracking-normal text-[#a08fa0]">optional</span>}</label>
    {multiline ? <textarea rows={3} {...shared} className={`${look} resize-none`} /> : <input type={type} inputMode={inputMode} {...shared} className={look} />}
    {error && <p id={`${id}-error`} className="mt-2 text-xs text-[#B23A48]" role="alert">{error}</p>}
  </div>;
}

function CheckoutPage() {
  const { cart, cartTotal, clearCart } = useStore();
  const { findProduct, isLoading, isError } = useCatalog();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [values, setValues] = useState<CheckoutValues>(EMPTY_CHECKOUT);
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [notice, setNotice] = useState('');
  const [problems, setProblems] = useState<StockProblem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [places, setPlaces] = useState<typeof import('@/data/algeria') | null>(null);
  const requestId = useRef(newRequestId());
  const done = useRef(false);
  useEffect(() => { window.scrollTo(0, 0); }, []);
  useEffect(() => { if (notice) document.querySelector('[data-testid=checkout-notice]')?.scrollIntoView({ block: 'center' }); }, [notice, problems]);
  // the list of wilayas and communes is large, so it is only loaded when the checkout opens
  useEffect(() => { let alive = true; import('@/data/algeria').then((module) => { if (alive) setPlaces(module); }); return () => { alive = false; }; }, []);
  const wilayaOptions = useMemo<SelectOption[]>(() => (places?.WILAYAS ?? []).map((wilaya) => ({ value: String(wilaya.code), label: `${String(wilaya.code).padStart(2, '0')} · ${wilaya.fr}`, hint: wilaya.ar, search: `${wilaya.code} ${wilaya.fr} ${wilaya.ar}` })), [places]);
  const communeOptions = useMemo<SelectOption[]>(() => (places && values.wilayaCode ? places.COMMUNES[values.wilayaCode] ?? [] : []).map(([fr, ar]) => ({ value: fr, label: fr, hint: ar, search: `${fr} ${ar}` })), [places, values.wilayaCode]);
  const wilayaName = places?.WILAYAS.find((wilaya) => wilaya.code === values.wilayaCode)?.fr ?? '';
  const shipping = shippingFor(cartTotal);
  const total = cartTotal + shipping;
  const text = (name: 'name' | 'phone' | 'address' | 'notes') => ({ name, value: values[name], error: errors[name as keyof CheckoutErrors], onChange: (value: string) => setValues((current) => ({ ...current, [name]: value })) });
  if (done.current) return null;
  if (cart.length === 0) return <Shell><EmptyState title="Your bag is waiting" message="A good browsing session should end with at least one maybe. Take another turn around the shelves." href="/shop" label="Keep browsing" /></Shell>;
  if (isLoading) return <Shell><CatalogNotice state="loading" /></Shell>;
  if (isError) return <Shell><CatalogNotice state="error" /></Shell>;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const found = validateCheckout(values);
    setErrors(found);
    setNotice('');
    setProblems([]);
    const firstWrong = Object.keys(found)[0];
    if (firstWrong) { document.getElementById(`checkout-${firstWrong}`)?.focus(); return; }
    setSubmitting(true);
    const result = await placeOrder(values, wilayaName, cart, total, requestId.current);
    setSubmitting(false);
    if (result.status === 'placed') {
      done.current = true;
      saveLastOrder({ name: values.name.trim().split(/\s+/)[0], order: result.order });
      setLocation('/order-confirmed');
      clearCart();
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
      return;
    }
    if (result.status === 'stock') {
      setProblems(result.problems);
      setNotice('Some things changed while you were shopping. We have updated your bag. Please check it and place your order again.');
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
      requestId.current = newRequestId();
    } else if (result.status === 'price_changed') {
      setNotice(`A price changed while you were shopping. Your total is now ${money(result.total)}. Please check it and place your order again.`);
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
      requestId.current = newRequestId();
    } else if (result.status === 'invalid') {
      setNotice('Something in your details was not accepted. Please check them and try again.');
    } else {
      setNotice('We could not confirm your order just now. Nothing was charged. Please try again in a moment.');
    }
  };

  return <Shell><div className="container-lunaria py-14 md:py-20">
    <Link href="/cart" className="inline-flex items-center gap-2 text-sm font-bold text-[#48458F]" data-testid="link-back-to-bag"><ArrowLeft size={16} /> Back to your bag</Link>
    <p className="mt-8 text-xs font-bold uppercase tracking-[.2em] text-[#B274A2]">Nearly there</p>
    <h1 className="mt-3 font-display text-5xl text-[#30263B] md:text-6xl">Checkout</h1>
    <p className="mt-4 max-w-lg text-sm leading-6 text-[#746875]">No account needed. Tell us where to bring your order and pay in cash when it arrives.</p>
    <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_380px]">
      <form onSubmit={submit} noValidate className="space-y-6 bg-[#FFF1EC] p-6 md:p-10" data-testid="form-checkout">
        {(notice || problems.length > 0) && <div role="alert" className="flex gap-3 border border-[#e6b8b8] bg-[#FDECEC] p-4 text-sm leading-6 text-[#7A2E2E]" data-testid="checkout-notice"><CircleAlert size={18} className="mt-1 shrink-0" /><div><p>{notice}</p>{problems.length > 0 && <ul className="mt-2 list-disc pl-5">{problems.map((problem) => <li key={problem.slug}>{problem.title}: {problem.available > 0 ? `only ${problem.available} left` : 'no longer available'}</li>)}</ul>}</div></div>}
        <div className="grid gap-6 sm:grid-cols-2">
          <CheckoutField label="Full name" autoComplete="name" placeholder="Your name" {...text('name')} />
          <CheckoutField label="Phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0555 12 34 56" {...text('phone')} />
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <SearchSelect id="checkout-wilaya" testId="input-checkout-wilaya" label="Wilaya" options={wilayaOptions} value={values.wilayaCode ? String(values.wilayaCode) : ''} error={errors.wilaya} disabled={!places} placeholder={places ? 'Search or choose your wilaya' : 'Loading the list…'} onChange={(value) => setValues((current) => ({ ...current, wilayaCode: Number(value), commune: '' }))} />
          <SearchSelect id="checkout-commune" testId="input-checkout-commune" label="City / Commune" options={communeOptions} value={values.commune} error={errors.commune} disabled={!places || !values.wilayaCode} placeholder={values.wilayaCode ? 'Search or choose your commune' : 'Choose your wilaya first'} onChange={(value) => setValues((current) => ({ ...current, commune: value }))} />
        </div>
        <fieldset>
          <legend className="text-xs font-bold uppercase tracking-[.1em] text-[#746875]">Delivery method</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">{([{ value: 'home', title: 'Home delivery', text: 'We bring it to your door.' }, { value: 'stop_desk', title: 'Stop desk', text: 'You pick it up at a delivery office.' }] as const).map((option) => <label key={option.value} className={`flex cursor-pointer gap-3 border p-4 ${values.deliveryMethod === option.value ? 'border-[#48458F] bg-white' : 'border-[#d9c5cb]'}`}><input type="radio" name="deliveryMethod" value={option.value} checked={values.deliveryMethod === option.value} onChange={() => setValues((current) => ({ ...current, deliveryMethod: option.value }))} className="mt-1 accent-[#48458F]" data-testid={`radio-delivery-${option.value}`} /><span><span className="block text-sm font-bold text-[#30263B]">{option.title}</span><span className="mt-1 block text-xs leading-5 text-[#746875]">{option.text}</span></span></label>)}</div>
        </fieldset>
        {values.deliveryMethod === 'home'
          ? <CheckoutField label="Delivery address" autoComplete="street-address" placeholder="Street, number, district" {...text('address')} />
          : <p className="text-sm leading-6 text-[#746875]" data-testid="text-stop-desk-info">Your order will wait for you at a delivery office in {values.commune ? `${values.commune}, ${wilayaName}` : 'your commune'}. We will tell you which one.</p>}
        <CheckoutField label="Notes for delivery" optional multiline placeholder="Anything we should know?" {...text('notes')} />
        <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 bg-[#48458F] px-7 py-3.5 text-sm font-bold text-white hover:bg-[#30263B] disabled:cursor-not-allowed disabled:opacity-60" data-testid="button-place-order">{submitting ? 'Placing your order…' : 'Place order'} <Check size={16} /></button>
      </form>
      <aside className="h-fit bg-[#FFF1EC] p-6 md:p-7">
        <h2 className="font-display text-2xl text-[#30263B]">Your order</h2>
        <ul className="mt-6 space-y-4 text-sm text-[#746875]">{cart.map((item) => { const product = findProduct(item.id); if (!product) return null; return <li key={`${item.id}-${item.variant}`} className="flex justify-between gap-4"><span>{product.title}{item.variant && item.variant !== 'Default' ? ` · ${item.variant}` : ''} × {item.quantity}</span><span className="whitespace-nowrap font-semibold text-[#30263B]">{money(product.price * item.quantity)}</span></li>; })}</ul>
        <div className="mt-6 space-y-4 border-t border-[#e2cfd0] pt-6 text-sm text-[#746875]">
          <div className="flex justify-between"><span>Subtotal</span><span className="font-semibold text-[#30263B]">{money(cartTotal)}</span></div>
          <div className="flex justify-between"><span>Shipping</span><span className="font-semibold text-[#30263B]">{shipping ? money(shipping) : 'Free'}</span></div>
          <div className="flex justify-between border-t border-[#e2cfd0] pt-4 text-base font-bold text-[#30263B]"><span>Total</span><span data-testid="text-checkout-total">{money(total)}</span></div>
        </div>
        <p className="mt-5 text-xs leading-5 text-[#746875]">Payment is in cash when your order arrives.</p>
      </aside>
    </div>
  </div></Shell>;
}

function OrderConfirmedPage() {
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const saved = readLastOrder();
  if (!saved) return <Shell><EmptyState title="Nothing to confirm yet" message="Once you place an order, its details will show up here." href="/shop" label="Keep browsing" /></Shell>;
  const { name, order } = saved;
  return <Shell><div className="container-lunaria py-14 md:py-20">
    <div className="mx-auto max-w-2xl">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-[#E8D7F0] text-[#48458F]"><Check size={28} /></div>
      <p className="mt-8 text-xs font-bold uppercase tracking-[.2em] text-[#B274A2]">Order #{order.order_number}</p>
      <h1 className="mt-3 font-display text-5xl text-[#30263B] md:text-6xl" data-testid="text-order-thanks">{`Thank you${name ? `, ${name}` : ''}.`}</h1>
      <p className="mt-4 text-sm leading-7 text-[#746875]">Your order is in. We will get in touch on the phone number you gave us to arrange delivery, and you pay in cash when it arrives.</p>
      <div className="mt-10 bg-[#FFF1EC] p-6 md:p-8">
        <p className="mb-6 text-sm font-semibold text-[#30263B]" data-testid="text-order-delivery">{DELIVERY_LABELS[order.delivery_method]} · {order.commune}, {order.wilaya}</p>
        <ul className="space-y-4 text-sm text-[#746875]">{order.items.map((line, index) => <li key={index} className="flex justify-between gap-4"><span>{line.title}{line.variant ? ` · ${line.variant}` : ''} × {line.quantity}</span><span className="whitespace-nowrap font-semibold text-[#30263B]">{money(line.line_total)}</span></li>)}</ul>
        <div className="mt-6 space-y-4 border-t border-[#e2cfd0] pt-6 text-sm text-[#746875]">
          <div className="flex justify-between"><span>Subtotal</span><span className="font-semibold text-[#30263B]">{money(order.subtotal)}</span></div>
          <div className="flex justify-between"><span>Shipping</span><span className="font-semibold text-[#30263B]">{order.shipping_fee ? money(order.shipping_fee) : 'Free'}</span></div>
          <div className="flex justify-between border-t border-[#e2cfd0] pt-4 text-base font-bold text-[#30263B]"><span>Total to pay on delivery</span><span data-testid="text-order-total">{money(order.total)}</span></div>
        </div>
      </div>
      <Link href="/shop" className="mt-10 inline-flex bg-[#48458F] px-6 py-3 text-sm font-bold text-white hover:bg-[#30263B]" data-testid="link-keep-browsing">Keep browsing</Link>
    </div>
  </div></Shell>;
}

function Router() {
  return <Switch><Route path="/" component={Home} /><Route path="/shop"><Catalog title="All the good things" eyebrow="The whole shop" description="A considered mix of books, notebooks, desk companions, and small gifts for curious people." /></Route><Route path="/books"><Catalog kind="book" title="Books to get lost in" eyebrow="The reading room" description="New fiction, thoughtful nonfiction, and poetry with a little weather in it." /></Route><Route path="/stationery"><Catalog kind="stationery" title="Paper for your ideas" eyebrow="The writing desk" description="Notebooks, pencils, and beautiful bits of paper for making a day feel more yours." /></Route><Route path="/product/:id" component={ProductPage} /><Route path="/about" component={About} /><Route path="/contact" component={Contact} /><Route path="/cart" component={CartPage} /><Route path="/wishlist" component={WishlistPage} /><Route path="/search" component={SearchPage} />
<Route path="/checkout" component={CheckoutPage} />
<Route path="/order-confirmed" component={OrderConfirmedPage} /><Route path="/admin" component={AdminApp} /><Route path="/admin/products" component={AdminApp} /><Route path="/admin/products/new" component={AdminApp} /><Route path="/admin/products/:id" component={AdminApp} /><Route path="/admin/categories" component={AdminApp} /><Route path="/admin/categories/new" component={AdminApp} /><Route path="/admin/categories/:id" component={AdminApp} /><Route path="/admin/orders" component={AdminApp} /><Route path="/admin/orders/:id" component={AdminApp} /><Route component={NotFound} /></Switch>;
}

function App() {
  return <StoreProvider><Router /></StoreProvider>;
}

export default App;