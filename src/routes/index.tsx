import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  MapPin,
  ShoppingCart,
  ChevronDown,
  CloudRain,
  Sparkles,
  Loader2,
  CheckCircle2,
  X,
  Zap,
  Repeat,
  Mic,
  Menu,
  Plus,
  Minus,
  Trash2,
  Globe,
} from "lucide-react";

import { fetchSmartRestock, generateIntentCart, searchProducts } from "@/lib/api/example.functions";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Amazon Next — AI-First Shopping" },
      {
        name: "description",
        content:
          "Amazon Next: zero-friction, AI-first shopping. Describe your intent, get a curated bundle, and check out in one click.",
      },
      { property: "og:title", content: "Amazon Next — AI-First Shopping" },
      {
        property: "og:description",
        content:
          "Describe your intent, get a curated bundle, and check out in one click.",
      },
    ],
  }),
  component: Home,
});

// ---------------------------------------------------------------------------
// Types — shaped to match a future JSON payload from a Python backend
// ---------------------------------------------------------------------------
type Product = {
  id: string;
  name: string;
  price: number;
  image: string;
};

type Bundle = {
  id: string;
  title: string;
  subtitle?: string;
  arrival?: string;
  items: Product[];
  total: number;
  extras?: Product[];
};

type CartItem = Product & { qty: number };

type ApiProduct = {
  id: string;
  name: string;
  price: number;
  image_url: string;
};

type ApiCartResponse = {
  items: ApiProduct[];
  total_cost: number;
  extras?: ApiProduct[];
};

type ApiTieredBundle = {
  name: string;
  items: ApiProduct[];
  total_cost: number;
};

type ApiIntentResponse = {
  bundles: ApiTieredBundle[];
  extras?: ApiProduct[];
  message?: string | null;
};

type RestockCardData = {
  category: string;
  bundle: Bundle;
};

// ---------------------------------------------------------------------------
// Image helpers (Unsplash) — swap with real CDN URLs from the backend later
// ---------------------------------------------------------------------------
const img = (id: string, w = 400) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;

// ---------------------------------------------------------------------------
// Shared image helpers and preset bundles
// ---------------------------------------------------------------------------
const MONSOON_BUNDLE: Bundle = {
  id: "bundle_monsoon",
  title: "Monsoon Prep Cart",
  arrival: "Arrives in 10 minutes",
  total: 1747,
  items: [
    { id: "m1", name: "Compact Travel Umbrella", price: 599, image: img("1534274988757-a28bf1a57c17") },
    { id: "m2", name: "Waterproof Raincoat", price: 699, image: img("1515886657613-9f3515b0c78f") },
    { id: "m3", name: "Waterproof LED Flashlight", price: 449, image: img("1568901346375-23c9450c58cd") },
  ],
};

const COFFEE_BUNDLE: Bundle = {
  id: "bundle_coffee",
  title: "Monthly Tea & Drinks Restock",
  subtitle: "Your daily chai & beverage picks",
  arrival: "Arrives Tomorrow before 9am",
  total: 2099,
  items: [
    { id: "c1", name: "Whole Bean Dark Roast 1lb", price: 1099, image: img("1559056199-641a0ac8b55e") },
    { id: "c2", name: "Organic Whole Milk 1gal", price: 449, image: img("1550583724-b2692b85b150") },
    { id: "c3", name: "Oat Milk Barista Edition", price: 551, image: img("1572490122747-3968b75cc699") },
  ],
};

const PRODUCE_BUNDLE: Bundle = {
  id: "bundle_produce",
  title: "Weekly Fresh Produce",
  subtitle: "Hand-picked from local suppliers",
  arrival: "Arrives Saturday morning",
  total: 1550,
  items: [
    { id: "f1", name: "Organic Bananas (Bunch)", price: 199, image: img("1571771894821-ce9b6c11b08e") },
    { id: "f2", name: "Baby Spinach 200g", price: 349, image: img("1576045057995-568f588f82fb") },
    { id: "f3", name: "Hass Avocados (4 ct)", price: 599, image: img("1519162808019-7de1683fa2ad") },
    { id: "f4", name: "Vine Tomatoes 500g", price: 403, image: img("1592924357228-91a4daadcfea") },
  ],
};

const HOUSEHOLD_BUNDLE: Bundle = {
  id: "bundle_household",
  title: "Household Essentials",
  subtitle: "Running low based on usage pattern",
  arrival: "Arrives in 4 hours",
  total: 2710,
  items: [
    { id: "h1", name: "Bamboo Toilet Paper 12 Rolls", price: 1599, image: img("1584556812952-905ffd0c611a") },
    { id: "h2", name: "Dish Soap Lemon 750ml", price: 449, image: img("1583947215259-38e31be8751f") },
    { id: "h3", name: "Laundry Pods (24 ct)", price: 662, image: img("1610557892470-55d9e80c0bce") },
  ],
};

const CATEGORY_TILES = [
  {
    title: "Up to 40% off | Electronics",
    cta: "Shop deals",
    image: img("1518770660439-4636190af475", 600),
  },
  {
    title: "Refresh your space",
    cta: "Explore home",
    image: img("1505693416388-ac5ce068fe85", 600),
  },
  {
    title: "New arrivals in Fashion",
    cta: "See more",
    image: img("1483985988355-763728e1935b", 600),
  },
  {
    title: "Kitchen must-haves",
    cta: "Shop kitchen",
    image: img("1556909114-f6e7ad7d3136", 600),
  },
];

const INTENT_CHIPS = [
  "Backyard BBQ for 6, two vegetarian",
  "Weekly grocery essentials for a family of 4",
  "Restock my coffee & milk for the month",
  "Dog food and pet care supplies",
];

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

// ---------------------------------------------------------------------------
// Tiered Discount System
// ---------------------------------------------------------------------------
const DISCOUNT_TIERS = [
  { threshold: 5000, discount: 300 },
  { threshold: 4000, discount: 250 },
  { threshold: 3000, discount: 200 },
  { threshold: 2000, discount: 150 },
  { threshold: 1000, discount: 100 },
] as const;

function getDiscountInfo(subtotal: number) {
  const currentTier = DISCOUNT_TIERS.find((t) => subtotal >= t.threshold) ?? null;
  const appliedDiscount = currentTier?.discount ?? 0;

  // Find the next tier the user can unlock
  const sortedAsc = [...DISCOUNT_TIERS].reverse();
  const currentTierIndex = currentTier
    ? sortedAsc.findIndex((t) => t.threshold === currentTier.threshold)
    : -1;
  const nextTier =
    currentTierIndex < sortedAsc.length - 1
      ? sortedAsc[currentTierIndex + 1]
      : currentTierIndex === -1
        ? sortedAsc[0]
        : null;

  const amountToNextTier = nextTier ? Math.max(0, nextTier.threshold - subtotal) : 0;
  const cartTotal = subtotal - appliedDiscount;
  const isMaxTier = currentTier?.threshold === DISCOUNT_TIERS[0].threshold;

  return { currentTier, nextTier, appliedDiscount, amountToNextTier, cartTotal, isMaxTier };
}

function DiscountBanner({ subtotal }: { subtotal: number }) {
  const { currentTier, nextTier, amountToNextTier, isMaxTier } = getDiscountInfo(subtotal);

  if (subtotal === 0) return null;

  // Max tier unlocked
  if (isMaxTier) {
    return (
      <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 font-medium">
        🎉 You unlocked the maximum <span className="font-bold">{fmt(currentTier!.discount)}</span> discount!
      </div>
    );
  }

  // Has a current tier + next tier to unlock
  if (currentTier && nextTier) {
    return (
      <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm space-y-1">
        <p className="text-green-700 font-medium">
          🎉 <span className="font-bold">{fmt(currentTier.discount)}</span> off unlocked!
        </p>
        <p className="text-green-600 text-xs">
          Add {fmt(amountToNextTier)} more to get {fmt(nextTier.discount)} off your order.
        </p>
      </div>
    );
  }

  // No tier yet, nudge toward the first one
  if (nextTier) {
    return (
      <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700 font-medium">
        Add <span className="font-bold">{fmt(amountToNextTier)}</span> more to unlock a{" "}
        <span className="font-bold">{fmt(nextTier.discount)}</span> discount!
      </div>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
function Home() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [orderModal, setOrderModal] = useState<Bundle | null>(null);

  const cartCount = cart.reduce((n, i) => n + i.qty, 0);

  const addToCart = (product: Product, openDrawer = true) => {
    setCart((prev) => {
      const next = [...prev];
      const existing = next.find((item) => item.id === product.id);
      if (existing) existing.qty += 1;
      else next.push({ ...product, qty: 1 });
      return next;
    });
    if (openDrawer) setCartOpen(true);
  };

  const addBundleToCart = (bundle: Bundle, openDrawer = true) => {
    setCart((prev) => {
      const next = [...prev];
      for (const item of bundle.items) {
        const existing = next.find((x) => x.id === item.id);
        if (existing) existing.qty += 1;
        else next.push({ ...item, qty: 1 });
      }
      return next;
    });
    if (openDrawer) setCartOpen(true);
  };

  const [restockPreview, setRestockPreview] = useState<Bundle | null>(null);

  const quickCheckout = (bundle: Bundle) => {
    setCartOpen(false);
    setOrderModal(bundle);
  };

  const addRestockToCart = (items: Product[]) => {
    setCart((prev) => {
      const next = [...prev];
      for (const item of items) {
        const existing = next.find((x) => x.id === item.id);
        if (existing) existing.qty += 1;
        else next.push({ ...item, qty: 1 });
      }
      return next;
    });
    setRestockPreview(null);
    setCartOpen(true);
  };

  const updateQty = (id: string, delta: number) =>
    setCart((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0),
    );
  const removeItem = (id: string) =>
    setCart((prev) => prev.filter((i) => i.id !== id));
  const clearCart = () => setCart([]);

  return (
    <div className="min-h-screen bg-[#F3F3F3] text-[#0F1111] font-sans flex flex-col">
      <Navbar cartCount={cartCount} onOpenCart={() => setCartOpen(true)} onAddToCart={addToCart} />
      <EmergencyBanner onActivate={() => addBundleToCart(MONSOON_BUNDLE)} />

      <main className="mx-auto w-full max-w-7xl px-3 sm:px-4 py-5 sm:py-6 space-y-8 flex-1">
        <IntentEngine onAddAllToCart={addBundleToCart} onAddItemToCart={addToCart} />
        <SmartRestock
          bundles={[
            { category: "coffee", bundle: COFFEE_BUNDLE },
            { category: "produce", bundle: PRODUCE_BUNDLE },
            { category: "household", bundle: HOUSEHOLD_BUNDLE },
          ]}
          onRestock={setRestockPreview}
        />
        <CategoryGrid />
      </main>

      <BackToTop />
      <Footer />

      <CartDrawer
        open={cartOpen}
        items={cart}
        onClose={() => setCartOpen(false)}
        onInc={(id) => updateQty(id, +1)}
        onDec={(id) => updateQty(id, -1)}
        onRemove={removeItem}
        onClear={clearCart}
        onCheckout={() => {
          if (cart.length === 0) return;
          const sub = cart.reduce((s, i) => s + i.price * i.qty, 0);
          const { cartTotal } = getDiscountInfo(sub);
          setOrderModal({
            id: "cart_order",
            title: "Your Cart",
            items: cart.map(({ qty: _qty, ...rest }) => rest),
            total: cartTotal,
            arrival: "Arrives in 2 hours",
          });
          setCart([]);
          setCartOpen(false);
        }}
      />

      {orderModal && (
        <CheckoutModal bundle={orderModal} onClose={() => setOrderModal(null)} />
      )}

      {restockPreview && (
        <RestockPreviewModal
          bundle={restockPreview}
          onClose={() => setRestockPreview(null)}
          onAddToCart={addRestockToCart}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Navbar
// ---------------------------------------------------------------------------
function Navbar({
  cartCount,
  onOpenCart,
  onAddToCart,
}: {
  cartCount: number;
  onOpenCart: () => void;
  onAddToCart: (product: Product, openDrawer?: boolean) => void;
}) {
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runSearch = useServerFn(searchProducts);

  // Speech-to-text for search
  const { isListening: searchListening, transcript: searchTranscript, start: startSearchSTT, stop: stopSearchSTT, isSupported: searchSTTSupported } = useSpeechRecognition();

  // Sync search STT transcript into input and trigger search
  useEffect(() => {
    if (searchTranscript) {
      setSearchQuery(searchTranscript);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => doSearch(searchTranscript), 300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTranscript]);

  const doSearch = useCallback(
    async (query: string) => {
      if (query.trim().length < 2) {
        setSearchResults([]);
        setShowDropdown(false);
        return;
      }
      setSearchLoading(true);
      try {
        const results = await runSearch({ data: query.trim() });
        const mapped = (results as ApiProduct[]).map((item: ApiProduct) => ({
          ...item,
          image: item.image_url || img("1551782450-a2132b4ba21d"),
        }));
        setSearchResults(mapped);
        setShowDropdown(mapped.length > 0);
      } catch {
        setSearchResults([]);
        setShowDropdown(false);
      } finally {
        setSearchLoading(false);
      }
    },
    [runSearch],
  );

  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  };

  const handleAddFromSearch = (product: Product) => {
    onAddToCart(product, true);
  };

  const closeDropdown = () => {
    setShowDropdown(false);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const SearchDropdown = () => {
    if (!showDropdown && !searchLoading) return null;
    return (
      <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-2xl border border-gray-200 z-50 max-h-[400px] overflow-y-auto">
        {searchLoading && (
          <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Searching...
          </div>
        )}
        {!searchLoading && searchResults.length === 0 && searchQuery.trim().length >= 2 && (
          <div className="px-4 py-3 text-sm text-gray-500">
            No results for "{searchQuery}"
          </div>
        )}
        {!searchLoading &&
          searchResults.map((product) => (
            <div
              key={product.id}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 cursor-pointer"
              onClick={() => handleAddFromSearch(product)}
            >
              <div className="h-10 w-10 rounded bg-[#F3F3F3] overflow-hidden shrink-0">
                <img
                  src={product.image}
                  alt={product.name}
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-900 truncate">{product.name}</div>
                <div className="text-sm font-bold text-[#0F1111]">{fmt(product.price)}</div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddFromSearch(product);
                }}
                className="h-7 w-7 rounded-full bg-[#FF9900] hover:bg-[#E38900] text-[#131A22] grid place-items-center shrink-0 transition-colors"
                aria-label={`Add ${product.name} to cart`}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
      </div>
    );
  };

  return (
    <header className="bg-[#131A22] text-white sticky top-0 z-30">
      <div className="mx-auto max-w-7xl px-3 py-2">
        <div className="flex items-center justify-between gap-2 md:hidden">
          {/* Logo */}
          <a
            href="/"
            className="flex items-baseline rounded border border-transparent hover:border-white px-2 py-1.5 shrink-0"
          >
            <span className="text-xl md:text-2xl font-bold tracking-tight">amazon</span>
            <span className="text-[#FF9900] text-xl md:text-2xl font-bold">next</span>
            <span className="text-[#FF9900] text-xs font-bold ml-0.5">.ai</span>
          </a>

          {/* Cart */}
          <button
            onClick={onOpenCart}
            className="relative flex items-end gap-1 rounded border border-transparent hover:border-white px-2 py-1.5 shrink-0"
          >
            <div className="relative">
              <ShoppingCart className="h-7 w-7" />
              <span className="absolute -top-1 -right-1 bg-[#FF9900] text-[#131A22] text-[11px] font-bold rounded-full h-5 min-w-5 px-1 flex items-center justify-center">
                {cartCount}
              </span>
            </div>
            <span className="text-sm font-bold">Cart</span>
          </button>
        </div>

        {/* Mobile search */}
        <div className="relative mt-2 md:hidden" ref={dropdownRef}>
          <div
            className={`flex min-w-0 rounded-md overflow-hidden bg-white transition-all duration-150 ${
              searchFocused ? "ring-[3px] ring-[#FF9900]" : ""
            }`}
          >
            <button className="hidden sm:flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs px-3 border-r border-gray-200 shrink-0">
              All <ChevronDown className="h-3 w-3" />
            </button>
            <input
              type="text"
              placeholder="Search Amazon.in"
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              onFocus={() => {
                setSearchFocused(true);
                if (searchResults.length > 0) setShowDropdown(true);
              }}
              onBlur={() => setSearchFocused(false)}
              onKeyDown={(e) => {
                if (e.key === "Escape") closeDropdown();
              }}
              className="flex-1 min-w-0 px-3 py-2 text-sm text-black outline-none bg-white"
            />
            {searchSTTSupported && (
              <button
                aria-label={searchListening ? "Stop voice search" : "Voice search"}
                onClick={searchListening ? stopSearchSTT : startSearchSTT}
                className={`flex items-center px-2 border-l border-gray-200 shrink-0 transition-all ${
                  searchListening
                    ? "text-red-500 animate-pulse"
                    : "text-gray-500 hover:text-[#FF9900]"
                }`}
              >
                <Mic className="h-4 w-4" />
              </button>
            )}
            <button
              aria-label="Search"
              onClick={() => doSearch(searchQuery)}
              className="bg-[#F3C55A] hover:bg-[#E7B94E] px-3 sm:px-4 flex items-center justify-center transition-colors shrink-0"
            >
              <Search className="h-5 w-5 text-[#131A22]" />
            </button>
          </div>
          <SearchDropdown />
        </div>

        <div className="hidden md:flex flex-wrap lg:flex-nowrap items-center gap-x-2 gap-y-2 md:gap-x-3">
          {/* Logo */}
          <a
            href="/"
            className="flex items-baseline rounded border border-transparent hover:border-white px-2 py-1.5 shrink-0"
          >
            <span className="text-xl md:text-2xl font-bold tracking-tight">amazon</span>
            <span className="text-[#FF9900] text-xl md:text-2xl font-bold">next</span>
            <span className="text-[#FF9900] text-xs font-bold ml-0.5">.ai</span>
          </a>

          {/* Location */}
          <button className="hidden lg:flex items-center gap-1 rounded border border-transparent hover:border-white px-2 py-1.5 text-left shrink-0">
            <MapPin className="h-4 w-4 mt-3" />
            <div className="leading-tight">
              <div className="text-[11px] text-gray-300">Delivering to Delhi 110085</div>
              <div className="text-sm font-bold">Update location</div>
            </div>
          </button>

          {/* Search bar */}
          <div className="relative min-w-0 basis-full lg:basis-auto lg:flex-1" ref={dropdownRef}>
            <div
              className={`flex rounded-md overflow-hidden bg-white transition-all duration-150 ${
                searchFocused ? "ring-[3px] ring-[#FF9900]" : ""
              }`}
            >
              <button className="hidden sm:flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs px-3 border-r border-gray-200 shrink-0">
                All <ChevronDown className="h-3 w-3" />
              </button>
              <input
                type="text"
                placeholder="Search Amazon.in"
                value={searchQuery}
                onChange={(e) => handleSearchInput(e.target.value)}
                onFocus={() => {
                  setSearchFocused(true);
                  if (searchResults.length > 0) setShowDropdown(true);
                }}
                onBlur={() => setSearchFocused(false)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") closeDropdown();
                }}
                className="flex-1 min-w-0 px-3 py-2 text-sm text-black outline-none bg-white"
              />
              {searchSTTSupported && (
                <button
                  aria-label={searchListening ? "Stop voice search" : "Voice search"}
                  onClick={searchListening ? stopSearchSTT : startSearchSTT}
                  className={`hidden sm:flex items-center px-3 border-l border-gray-200 shrink-0 transition-all relative ${
                    searchListening
                      ? "text-red-500 animate-pulse"
                      : "text-gray-500 hover:text-[#FF9900]"
                  }`}
                >
                  <Mic className="h-4 w-4" />
                  {searchListening && (
                    <span className="absolute inline-flex h-4 w-4 rounded-full bg-red-400 opacity-30 animate-ping" />
                  )}
                </button>
              )}
              <button
                aria-label="Search"
                onClick={() => doSearch(searchQuery)}
                className="bg-[#F3C55A] hover:bg-[#E7B94E] px-3 sm:px-4 flex items-center justify-center transition-colors shrink-0"
              >
                <Search className="h-5 w-5 text-[#131A22]" />
              </button>
            </div>
            <SearchDropdown />
          </div>

          {/* Language */}
          <button className="hidden lg:flex items-center gap-1 rounded border border-transparent hover:border-white px-2 py-1.5 text-sm font-bold shrink-0">
            <Globe className="h-4 w-4" /> EN <ChevronDown className="h-3 w-3" />
          </button>

          {/* Account */}
          <button className="hidden lg:block rounded border border-transparent hover:border-white px-2 py-1.5 text-left shrink-0">
            <div className="text-[11px] text-gray-300">Hello, Yuvraj</div>
            <div className="text-sm font-bold flex items-center gap-0.5">
              Account &amp; Lists <ChevronDown className="h-3 w-3" />
            </div>
          </button>

          {/* Returns */}
          <button className="hidden lg:block rounded border border-transparent hover:border-white px-2 py-1.5 text-left shrink-0">
            <div className="text-[11px] text-gray-300">Returns</div>
            <div className="text-sm font-bold">&amp; Orders</div>
          </button>

          {/* Cart */}
          <button
            onClick={onOpenCart}
            className="relative flex items-end gap-1 rounded border border-transparent hover:border-white px-2 py-1.5 shrink-0 ml-auto lg:ml-0"
          >
            <div className="relative">
              <ShoppingCart className="h-7 w-7" />
              <span className="absolute -top-1 -right-1 bg-[#FF9900] text-[#131A22] text-[11px] font-bold rounded-full h-5 min-w-5 px-1 flex items-center justify-center">
                {cartCount}
              </span>
            </div>
            <span className="hidden md:inline text-sm font-bold">Cart</span>
          </button>
        </div>
      </div>

      {/* Sub-nav */}
      <div className="bg-[#232F3E] text-white text-sm">
        <div className="mx-auto max-w-7xl px-3 py-1.5 flex items-center gap-1 overflow-x-auto">
          <button className="flex items-center gap-1 px-2 py-1 hover:border-white border border-transparent rounded font-bold whitespace-nowrap">
            <Menu className="h-4 w-4" /> All
          </button>
          {["Today's Deals", "Customer Service", "Registry", "Gift Cards", "Sell"].map(
            (item) => (
              <button
                key={item}
                className="whitespace-nowrap px-2 py-1 hover:border-white border border-transparent rounded"
              >
                {item}
              </button>
            ),
          )}
          <div className="ml-auto hidden md:flex items-center gap-1.5 text-[#FF9900] text-xs font-semibold whitespace-nowrap pl-3">
            <Sparkles className="h-3.5 w-3.5" />
            AI Intent Engine, powered by Gemini 3.1 Flash Lite
          </div>
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Emergency banner
// ---------------------------------------------------------------------------
function EmergencyBanner({ onActivate }: { onActivate: () => void }) {
  return (
    <div className="bg-sky-50 border-b border-sky-100">
      <div className="mx-auto max-w-7xl px-3 sm:px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-sky-100 grid place-items-center shrink-0">
          <CloudRain className="h-5 w-5 text-sky-700" />
        </div>
        <p className="min-w-0 text-sm text-[#0F1111] sm:flex-1">
          <span className="font-bold">Heads up.</span>{" "}
          <span className="text-gray-700">
            Heavy rain forecasted in your area tomorrow. Get your monsoon essentials
            delivered in <span className="font-bold text-[#0F1111]">10 minutes</span>.
          </span>
        </p>
        <button
          onClick={onActivate}
          className="w-full sm:w-auto bg-[#FF9900] hover:bg-[#E38900] text-[#131A22] text-sm font-bold px-4 py-2 rounded-md whitespace-nowrap flex items-center justify-center gap-1.5 transition-colors shrink-0 shadow-sm"
        >
          <Zap className="h-4 w-4" />
          1-Click Monsoon Prep Cart
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero — Intent Engine
// ---------------------------------------------------------------------------
function IntentEngine({
  onAddAllToCart,
  onAddItemToCart,
}: {
  onAddAllToCart: (b: Bundle) => void;
  onAddItemToCart: (product: Product) => void;
}) {
  const [intent, setIntent] = useState("");
  const [loading, setLoading] = useState(false);
  const [tieredBundles, setTieredBundles] = useState<Bundle[]>([]);
  const [extras, setExtras] = useState<Product[]>([]);
  const [activeTier, setActiveTier] = useState(0);
  const [noMatchMessage, setNoMatchMessage] = useState<string | null>(null);
  const runGenerateIntentCart = useServerFn(generateIntentCart);

  // Speech-to-text for intent input
  const { isListening, transcript, start: startListening, stop: stopListening, isSupported: sttSupported } = useSpeechRecognition();

  // Sync transcript into the intent textarea
  useEffect(() => {
    if (transcript) {
      setIntent(transcript);
    }
  }, [transcript]);

  const mapIntentResponse = (payload: ApiIntentResponse) => {
    const bundles: Bundle[] = payload.bundles.map((tier, idx) => ({
      id: `bundle_${Date.now()}_${idx}`,
      title: tier.name,
      arrival: "Arrives in 2 hours",
      items: tier.items.map((item) => ({
        ...item,
        image: item.image_url || img("1551782450-a2132b4ba21d"),
      })),
      total: tier.total_cost,
    }));
    const mappedExtras: Product[] = (payload.extras ?? []).map((item) => ({
      ...item,
      image: item.image_url || img("1551782450-a2132b4ba21d"),
    }));
    return { bundles, extras: mappedExtras };
  };

  const handleGenerate = async (text?: string) => {
    const q = text ?? intent;
    if (!q.trim()) return;
    setIntent(q);
    setLoading(true);
    setTieredBundles([]);
    setExtras([]);
    setActiveTier(0);
    setNoMatchMessage(null);
    try {
      const payload = await runGenerateIntentCart({ data: q });
      const { bundles, extras: mappedExtras } = mapIntentResponse(payload);

      if (bundles.length === 0) {
        // No relevant products — show message
        setNoMatchMessage(
          payload.message || "We couldn't find relevant products for this request. Our store specializes in groceries, household essentials, and personal care."
        );
        // Still show extras as softer fallback if any were returned
        setExtras(mappedExtras);
      } else {
        setTieredBundles(bundles);
        setExtras(mappedExtras);
        // Default to middle tier if available (Popular Choice), else first
        setActiveTier(bundles.length >= 2 ? 1 : 0);
        // Show partial-match message if one was provided alongside bundles
        if (payload.message) {
          setNoMatchMessage(payload.message);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const activeBundle = tieredBundles[activeTier] ?? null;

  const TIER_STYLES: Record<string, { badge: string; bg: string; border: string }> = {
    "Smart Saver": { badge: "bg-emerald-100 text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
    "Popular Choice": { badge: "bg-blue-100 text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
    "Premium Selection": { badge: "bg-amber-100 text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
  };

  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-7 md:p-9">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3">
        <span className="flex items-center gap-1.5 text-[#FF9900] text-xs font-bold uppercase tracking-wider">
          <Sparkles className="h-4 w-4" />
          AI Intent Engine
        </span>
        <span className="text-xs text-gray-500">natural language to optimized cart</span>
      </div>
      <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#0F1111] leading-tight">
        What are you trying to get done today?
      </h1>
      <p className="mt-2 text-sm sm:text-base text-gray-600 max-w-3xl">
        Describe your situation in plain English. Our AI assembles the perfect bundle,
        including alternatives for dietary needs, quantity, and budget, and ships it in hours.
      </p>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-3">
        <div className="relative">
          <textarea
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            placeholder="e.g., I'm hosting a backyard BBQ for 6 people this Sunday, two are vegetarian..."
            rows={4}
            className="w-full rounded-lg border border-gray-300 focus:border-[#FF9900] focus:ring-2 focus:ring-[#FF9900]/30 outline-none p-3 pr-12 text-sm resize-none bg-white"
          />
          {sttSupported && (
            <button
              type="button"
              onClick={isListening ? stopListening : startListening}
              aria-label={isListening ? "Stop listening" : "Speak your intent"}
              className={`absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full grid place-items-center transition-all ${
                isListening
                  ? "bg-red-100 text-red-600 animate-pulse ring-4 ring-red-200"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-[#FF9900]"
              }`}
            >
              <Mic className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => handleGenerate()}
          disabled={loading}
          className="w-full md:w-48 bg-[#FF9900] hover:bg-[#E38900] disabled:opacity-70 disabled:cursor-not-allowed text-[#131A22] font-bold rounded-lg flex items-center justify-center gap-2 transition-colors px-5 py-3 md:py-0 shadow-sm"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Optimizing...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate My Cart
            </>
          )}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {INTENT_CHIPS.map((chip) => (
          <button
            key={chip}
            onClick={() => handleGenerate(chip)}
            className="text-xs sm:text-sm bg-gray-100 hover:bg-gray-200 text-[#0F1111] rounded-full px-3 py-1.5 transition-colors"
          >
            {chip}
          </button>
        ))}
      </div>

      {loading && <BundleSkeleton />}

      {/* No-match message when AI can't find relevant products */}
      {!loading && noMatchMessage && tieredBundles.length === 0 && (
        <div className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-100 grid place-items-center shrink-0">
                <Search className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-amber-900">No matching products found</h3>
                <p className="mt-1 text-sm text-amber-700">{noMatchMessage}</p>
              </div>
            </div>
          </div>
          {extras.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                You might find these useful instead
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {extras.map((item) => (
                  <ProductCard key={item.id} product={item} onAdd={() => onAddItemToCart(item)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tieredBundles.length > 0 && !loading && (
        <div className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Partial match info note */}
          {noMatchMessage && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 mb-4 text-sm text-blue-700">
              <span className="font-medium">Note:</span> {noMatchMessage}
            </div>
          )}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#8a5a00]">
                Curated AI Bundles
              </p>
              <h3 className="text-lg font-bold">Choose your style</h3>
            </div>
            <span className="text-xs text-gray-500">
              {tieredBundles.length} option{tieredBundles.length !== 1 ? "s" : ""} curated
            </span>
          </div>

          {/* Tier tabs */}
          {tieredBundles.length > 1 && (
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              {tieredBundles.map((bundle, idx) => {
                const style = TIER_STYLES[bundle.title] ?? TIER_STYLES["Popular Choice"];
                const isActive = idx === activeTier;
                return (
                  <button
                    key={bundle.id}
                    onClick={() => setActiveTier(idx)}
                    className={`shrink-0 px-4 py-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${
                      isActive
                        ? `${style.bg} ${style.border} shadow-sm`
                        : "bg-white border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <span className={`inline-flex items-center gap-1.5`}>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${style.badge}`}>
                        {idx + 1}
                      </span>
                      {bundle.title}
                    </span>
                    <span className="block text-xs text-gray-500 mt-0.5">{fmt(bundle.total)}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Active bundle display */}
          {activeBundle && (
            <div>
              <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
                {activeBundle.items.map((item) => (
                  <div key={item.id} className="w-[200px] sm:w-[220px] shrink-0 snap-start">
                    <ProductCard product={item} onAdd={() => onAddItemToCart(item)} />
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => onAddAllToCart(activeBundle)}
                  className="w-full sm:w-auto bg-[#FF9900] hover:bg-[#E38900] text-[#131A22] font-bold px-6 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  <Zap className="h-4 w-4" />
                  Add Full Bundle to Cart — {fmt(activeBundle.total)}
                </button>
              </div>
            </div>
          )}

          {extras.length > 0 && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="flex items-end justify-between gap-3 mb-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    More for This Occasion
                  </p>
                  <h3 className="text-base font-bold">You might also like</h3>
                </div>
                <span className="text-xs text-gray-500">
                  {extras.length} suggestions
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {extras.map((item) => (
                  <ProductCard key={item.id} product={item} onAdd={() => onAddItemToCart(item)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ProductCard({ product, onAdd }: { product: Product; onAdd: () => void }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition-shadow flex flex-col relative h-full">
      <button
        type="button"
        onClick={onAdd}
        aria-label={`Add ${product.name} to cart`}
        className="absolute right-3 top-3 z-10 h-8 w-8 rounded-full bg-[#FF9900] hover:bg-[#E38900] text-[#131A22] grid place-items-center shadow-sm transition-colors"
      >
        <Plus className="h-4 w-4" />
      </button>
      <div className="aspect-square rounded-md bg-[#F3F3F3] overflow-hidden mb-2">
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="text-sm font-medium line-clamp-2 min-h-[2.5rem]">{product.name}</div>
      <div className="text-sm font-bold mt-auto pt-1">{fmt(product.price)}</div>
    </div>
  );
}

function BundleSkeleton() {
  return (
    <div className="mt-6">
      <div className="h-5 w-40 bg-gray-200 animate-pulse rounded mb-3" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-56 bg-gray-100 animate-pulse rounded-lg border border-gray-200"
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Smart Restock Dashboard
// ---------------------------------------------------------------------------
function SmartRestock({
  bundles,
  onRestock,
}: {
  bundles: RestockCardData[];
  onRestock: (b: Bundle) => void;
}) {
  const runFetchSmartRestock = useServerFn(fetchSmartRestock);
  const [liveBundles, setLiveBundles] = useState<RestockCardData[]>(bundles);
  const hasFetched = useRef(false);

  const mapCartResponseToBundle = (payload: ApiCartResponse, title: string, subtitle?: string, arrival?: string): Bundle => ({
    id: `restock_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title,
    subtitle,
    arrival: arrival || "Arrives in 2 hours",
    items: payload.items.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      image: item.image_url || img("1551782450-a2132b4ba21d"),
    })),
    total: payload.total_cost,
  });

  // Fetch real data for all categories on mount
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    const fetchAll = async () => {
      const updated: RestockCardData[] = await Promise.all(
        bundles.map(async (entry) => {
          try {
            const payload = await runFetchSmartRestock({ data: entry.category });
            const bundle = mapCartResponseToBundle(
              payload,
              entry.bundle.title,
              entry.bundle.subtitle,
              entry.bundle.arrival,
            );
            return { category: entry.category, bundle };
          } catch {
            return entry; // fallback to hardcoded on error
          }
        }),
      );
      setLiveBundles(updated);
    };

    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRestock = (category: string) => {
    const entry = liveBundles.find((e) => e.category === category);
    if (entry) {
      onRestock(entry.bundle);
    }
  };

  return (
    <section>
      <div className="flex items-end justify-between gap-3 mb-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Repeat className="h-5 w-5 text-[#131A22]" />
            <h2 className="text-xl sm:text-2xl font-bold">
              Anticipated Needs &amp; Smart Restocks
            </h2>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Predictive baskets based on your household consumption patterns.
          </p>
        </div>
        <a
          href="#"
          className="text-sm text-sky-700 hover:text-[#FF9900] hover:underline font-medium"
        >
          See all
        </a>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {liveBundles.map((entry) => (
          <RestockCard
            key={entry.bundle.id}
            bundle={entry.bundle}
            onRestock={() => handleRestock(entry.category)}
          />
        ))}
      </div>
    </section>
  );
}

function RestockCard({
  bundle,
  onRestock,
  loading,
}: {
  bundle: Bundle;
  onRestock: () => void;
  loading?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold text-base sm:text-lg leading-tight">{bundle.title}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{bundle.subtitle}</p>
        </div>
        <span className="shrink-0 text-[10px] font-bold tracking-wider bg-[#FFF3D6] text-[#8a5a00] px-2 py-1 rounded-full uppercase">
          Restock
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4">
        {bundle.items.slice(0, 3).map((it) => (
          <div
            key={it.id}
            className="aspect-square rounded-md bg-[#F3F3F3] overflow-hidden"
            title={it.name}
          >
            <img
              src={it.image}
              alt={it.name}
              loading="lazy"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
              className="h-full w-full object-cover"
            />
          </div>
        ))}
      </div>

      <ul className="mt-3 text-xs sm:text-sm text-gray-700 space-y-1">
        {bundle.items.slice(0, 3).map((it) => (
          <li key={it.id} className="flex justify-between gap-3">
            <span className="truncate">{it.name}</span>
            <span className="text-gray-500 shrink-0">{fmt(it.price)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3">
        <p className="text-xs text-gray-600 sm:flex-1">{bundle.arrival}</p>
        <button
          disabled={loading}
          onClick={onRestock}
          className="bg-[#FF9900] hover:bg-[#E38900] disabled:opacity-70 disabled:cursor-not-allowed text-[#131A22] font-bold px-4 py-2 rounded-md flex items-center justify-center gap-1.5 transition-colors shadow-sm whitespace-nowrap"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {loading ? "Loading..." : `1-Click Restock, ${fmt(bundle.total)}`}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Category Grid
// ---------------------------------------------------------------------------
function CategoryGrid() {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {CATEGORY_TILES.map((tile) => (
        <div
          key={tile.title}
          className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col"
        >
          <h3 className="font-bold text-base mb-3">{tile.title}</h3>
          <div className="aspect-[4/3] rounded-md overflow-hidden bg-[#F3F3F3]">
            <img
              src={tile.image}
              alt={tile.title}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
          <a
            href="#"
            className="mt-3 text-sm text-sky-700 hover:text-[#FF9900] hover:underline font-medium"
          >
            {tile.cta}
          </a>
        </div>
      ))}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Back to top + Footer
// ---------------------------------------------------------------------------
function BackToTop() {
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="mt-10 bg-[#37475A] hover:bg-[#485769] text-white text-sm font-medium py-4 transition-colors"
    >
      Back to top
    </button>
  );
}

function Footer() {
  const columns = [
    {
      title: "Get to Know Us",
      links: ["Careers", "About Amazon Next", "Investor Relations", "Sustainability"],
    },
    {
      title: "Make Money with Us",
      links: ["Sell on Amazon Next", "Become an Affiliate", "Advertise Your Products", "Self-Publish"],
    },
    {
      title: "Amazon Payment Products",
      links: ["Amazon Pay", "Reload Your Balance", "Currency Converter", "Gift Cards"],
    },
    {
      title: "Let Us Help You",
      links: ["Your Account", "Your Orders", "Shipping Rates", "Returns and Replacements"],
    },
  ];
  return (
    <footer className="bg-[#232F3E] text-white">
      <div className="mx-auto max-w-7xl px-4 py-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
        {columns.map((col) => (
          <div key={col.title}>
            <h4 className="font-bold mb-3 text-sm">{col.title}</h4>
            <ul className="space-y-2 text-xs text-gray-300">
              {col.links.map((l) => (
                <li key={l}>
                  <a href="#" className="hover:underline hover:text-white">
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="bg-[#131A22] text-center text-xs text-gray-400 py-5 px-4">
        © 2025, Amazon Next.ai. Zero-Friction, AI-First Shopping Prototype.
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Cart Drawer
// ---------------------------------------------------------------------------
function CartDrawer({
  open,
  items,
  onClose,
  onInc,
  onDec,
  onRemove,
  onClear,
  onCheckout,
}: {
  open: boolean;
  items: CartItem[];
  onClose: () => void;
  onInc: (id: string) => void;
  onDec: (id: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onCheckout: () => void;
}) {
  const subtotal = useMemo(
    () => items.reduce((s, i) => s + i.price * i.qty, 0),
    [items],
  );
  const count = items.reduce((n, i) => n + i.qty, 0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-full sm:w-[420px] bg-white shadow-2xl flex flex-col transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-gray-200 shrink-0">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <ShoppingCart className="h-5 w-5" /> Your Cart ({count})
          </h2>
          <button
            onClick={onClose}
            aria-label="Close cart"
            className="text-gray-500 hover:text-gray-900 rounded p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {items.length > 0 && (
          <div className="px-4 sm:px-5 pt-4">
            <DiscountBanner subtotal={subtotal} />
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-4">
          {items.length === 0 && (
            <div className="text-center text-sm text-gray-500 py-12">
              Your cart is empty. Generate a bundle to get started.
            </div>
          )}
          {items.map((it) => (
            <div
              key={it.id}
              className="grid grid-cols-[56px_minmax(0,1fr)] sm:grid-cols-[64px_minmax(0,1fr)_auto] gap-3 items-start"
            >
              <div className="h-14 w-14 sm:h-16 sm:w-16 rounded bg-[#F3F3F3] overflow-hidden shrink-0">
                <img src={it.image} alt={it.name} loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{it.name}</div>
                <div className="text-sm font-bold mt-0.5">{fmt(it.price)}</div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="inline-flex items-center border border-gray-300 rounded-md">
                    <button
                      onClick={() => onDec(it.id)}
                      aria-label="Decrease quantity"
                      className="h-7 w-7 grid place-items-center hover:bg-gray-100"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm font-medium">{it.qty}</span>
                    <button
                      onClick={() => onInc(it.id)}
                      aria-label="Increase quantity"
                      className="h-7 w-7 grid place-items-center hover:bg-gray-100"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <button
                    onClick={() => onRemove(it.id)}
                    className="text-xs text-red-600 hover:text-red-700 inline-flex items-center gap-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </button>
                </div>
              </div>
              <div className="col-span-2 sm:col-span-1 sm:justify-self-end text-sm font-bold whitespace-nowrap">
                {fmt(it.price * it.qty)}
              </div>
            </div>
          ))}
        </div>

        <footer className="border-t border-gray-200 px-4 sm:px-5 py-4 shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Subtotal</span>
            <span className="text-sm font-semibold">{fmt(subtotal)}</span>
          </div>
          {(() => {
            const { appliedDiscount, cartTotal } = getDiscountInfo(subtotal);
            return (
              <>
                {appliedDiscount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-green-700 font-medium">Discount</span>
                    <span className="text-sm font-bold text-green-700">-{fmt(appliedDiscount)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold">Total</span>
                  <span className="text-xl font-bold">{fmt(cartTotal)}</span>
                </div>
              </>
            );
          })()}
          {subtotal > 0 && (
            <p className="text-xs text-green-700 font-medium">
              Eligible for FREE delivery in 2 hours.
            </p>
          )}
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <button
              onClick={onCheckout}
              disabled={items.length === 0}
              className="bg-[#FF9900] hover:bg-[#E38900] disabled:opacity-60 disabled:cursor-not-allowed text-[#131A22] font-bold py-2.5 rounded-md flex items-center justify-center gap-2 shadow-sm"
            >
              <Zap className="h-4 w-4" />
              Proceed to Checkout
            </button>
            <button
              onClick={onClear}
              disabled={items.length === 0}
              className="border border-gray-300 hover:bg-gray-100 disabled:opacity-60 text-sm font-medium px-4 rounded-md"
            >
              Clear
            </button>
          </div>
        </footer>
      </aside>
    </>
  );
}

// ---------------------------------------------------------------------------
// Restock Preview Modal
// ---------------------------------------------------------------------------
function RestockPreviewModal({
  bundle,
  onClose,
  onAddToCart,
}: {
  bundle: Bundle;
  onClose: () => void;
  onAddToCart: (items: Product[]) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(bundle.items.map((it) => it.id)),
  );
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(bundle.items.map((it) => it.id)));
  const deselectAll = () => setSelectedIds(new Set());

  const selectedItems = bundle.items.filter((it) => selectedIds.has(it.id));
  const selectedTotal = selectedItems.reduce((s, it) => s + it.price, 0);

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[calc(100vh-1.5rem)] overflow-y-auto p-4 sm:p-6 relative animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          aria-label="Close"
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 rounded p-1"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-4">
          <div className="flex items-center gap-2">
            <Repeat className="h-5 w-5 text-[#FF9900]" />
            <h2 className="text-lg font-bold">Restock Cart</h2>
          </div>
          <p className="text-sm text-gray-600 mt-1">{bundle.title}</p>
        </div>

        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-500">
            {selectedIds.size} of {bundle.items.length} selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              className="text-xs text-sky-700 hover:underline font-medium"
            >
              Select all
            </button>
            <button
              onClick={deselectAll}
              className="text-xs text-gray-500 hover:underline font-medium"
            >
              Clear
            </button>
          </div>
        </div>

        <ul className="space-y-2 max-h-72 overflow-y-auto">
          {bundle.items.map((it) => (
            <li
              key={it.id}
              onClick={() => toggleItem(it.id)}
              className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                selectedIds.has(it.id)
                  ? "border-[#FF9900] bg-[#FFF8EC]"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <div
                className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                  selectedIds.has(it.id)
                    ? "bg-[#FF9900] border-[#FF9900]"
                    : "border-gray-300 bg-white"
                }`}
              >
                {selectedIds.has(it.id) && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                )}
              </div>
              <div className="h-10 w-10 rounded bg-[#F3F3F3] overflow-hidden shrink-0">
                <img src={it.image} alt={it.name} onError={(e) => { e.currentTarget.style.display = "none"; }} className="h-full w-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{it.name}</div>
              </div>
              <span className="text-sm font-bold shrink-0">{fmt(it.price)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-4 pt-3 border-t border-gray-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Selected Total</span>
            <span className="text-lg font-bold">{fmt(selectedTotal)}</span>
          </div>
          <button
            ref={closeRef}
            disabled={selectedIds.size === 0}
            onClick={() => onAddToCart(selectedItems)}
            className="w-full bg-[#FF9900] hover:bg-[#E38900] disabled:opacity-60 disabled:cursor-not-allowed text-[#131A22] font-bold py-2.5 rounded-md flex items-center justify-center gap-2 shadow-sm transition-colors"
          >
            <ShoppingCart className="h-4 w-4" />
            Add {selectedIds.size} item{selectedIds.size !== 1 ? "s" : ""} to Cart
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Checkout Modal
// ---------------------------------------------------------------------------
function CheckoutModal({
  bundle,
  onClose,
}: {
  bundle: Bundle;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const itemsSubtotal = bundle.items.reduce((s, it) => s + it.price, 0);
  const { appliedDiscount, cartTotal } = getDiscountInfo(itemsSubtotal);
  // Use the bundle.total if it differs (e.g., for restock bundles without discount logic)
  const displayTotal = bundle.total !== itemsSubtotal ? bundle.total : cartTotal;
  const displayDiscount = bundle.total !== itemsSubtotal ? 0 : appliedDiscount;

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[calc(100vh-1.5rem)] overflow-y-auto p-4 sm:p-6 relative animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          aria-label="Close"
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 rounded p-1"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center text-center">
          <CheckCircle2 className="h-14 w-14 text-green-600" />
          <h2 className="text-xl font-bold mt-3">Order Placed Successfully!</h2>
          <p className="text-sm text-gray-600 mt-1">
            Your bundle is bypassing the traditional queue and arriving in 2 hours.
          </p>
        </div>

        {displayDiscount > 0 && (
          <div className="mt-4">
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 font-medium text-center">
              🎉 You saved <span className="font-bold">{fmt(displayDiscount)}</span> on this order!
            </div>
          </div>
        )}

        <div className="mt-5 border-t border-gray-200 pt-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
            {bundle.title}
          </div>
          <ul className="space-y-2 max-h-60 overflow-y-auto">
            {bundle.items.map((it) => (
              <li key={it.id} className="flex items-center justify-between text-sm gap-3">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="h-8 w-8 rounded bg-[#F3F3F3] overflow-hidden shrink-0">
                    <img src={it.image} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} className="h-full w-full object-cover" />
                  </span>
                  <span className="truncate">{it.name}</span>
                </span>
                <span className="text-gray-600 shrink-0">{fmt(it.price)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
            <div className="flex justify-between items-center text-sm text-gray-600">
              <span>Subtotal</span>
              <span>{fmt(itemsSubtotal)}</span>
            </div>
            {displayDiscount > 0 && (
              <div className="flex justify-between items-center text-sm text-green-700 font-medium">
                <span>Discount</span>
                <span>-{fmt(displayDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between items-center font-bold pt-1">
              <span>Total</span>
              <span>{fmt(displayTotal)}</span>
            </div>
          </div>
        </div>

        <button
          ref={closeRef}
          onClick={onClose}
          className="mt-5 w-full bg-[#131A22] hover:bg-[#232F3E] text-white font-semibold py-2.5 rounded-md transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
