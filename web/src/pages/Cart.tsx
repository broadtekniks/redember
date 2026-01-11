import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { useCart } from "../cart/CartContext";
import * as api from "../lib/api";
import { LayoutOutletContext } from "../components/Layout";
import { Product } from "../types";

const FALLBACK_IMAGES: Record<string, string> = {
  "red-ember-spice":
    "https://images.unsplash.com/photo-1604909053196-3f1f510c2c5c?auto=format&fit=crop&q=80&w=1400",
  "smoked-ghost":
    "https://images.unsplash.com/photo-1626808642875-0aa545482dfb?auto=format&fit=crop&q=80&w=1400",
  "honey-habanero":
    "https://images.unsplash.com/photo-1600628422019-6c1b0b2f7b1c?auto=format&fit=crop&q=80&w=1400",
  "sichuan-gold":
    "https://images.unsplash.com/photo-1615485737657-9f5f0a2d9b0a?auto=format&fit=crop&q=80&w=1400",
};

interface LineItem {
  productId: string;
  quantity: number;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  stock: number;
  image: string;
  missing: boolean;
}

function formatMoney(cents: number, currency: string = "usd"): string {
  const value = (Number(cents) || 0) / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(value);
}

export default function Cart() {
  const { setHeaderState } = useOutletContext<LayoutOutletContext>();
  const cart = useCart();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [shippingInfo, setShippingInfo] = useState<{
    shippingCents: number;
    totalWeightG: number;
    freeShippingMin: number | null;
    zone: string;
  } | null>(null);
  const [loadingShipping, setLoadingShipping] = useState<boolean>(false);

  useEffect(() => {
    setHeaderState({ cartCount: 0, onCheckout: null, checkoutDisabled: true });
  }, [setHeaderState]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const list = await api.getProducts();
        if (!cancelled) setProducts(Array.isArray(list) ? list : []);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const productById = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((p) => map.set(p.id, p));
    return map;
  }, [products]);

  const lineItems = useMemo(() => {
    return cart.items
      .map((i) => {
        const p = productById.get(i.productId);
        if (!p) {
          return {
            productId: i.productId,
            quantity: i.quantity,
            name: "Unknown product",
            description: "This product is no longer available.",
            priceCents: 0,
            currency: "usd",
            stock: 0,
            image:
              FALLBACK_IMAGES[i.productId] ||
              FALLBACK_IMAGES["red-ember-spice"],
            missing: true,
          };
        }
        return {
          productId: i.productId,
          quantity: i.quantity,
          name: p.name,
          description: "Hand-crafted in small batches using premium aromatics.",
          priceCents: p.priceCents,
          currency: p.currency,
          stock: p.stock,
          image:
            p.imageUrl ||
            FALLBACK_IMAGES[p.id] ||
            FALLBACK_IMAGES["red-ember-spice"],
          missing: false,
        };
      })
      .filter(Boolean) as LineItem[];
  }, [cart.items, productById]);

  const subtotalCents = useMemo(() => {
    return lineItems.reduce((sum, li) => sum + li.priceCents * li.quantity, 0);
  }, [lineItems]);

  const currency = lineItems[0]?.currency || "usd";

  // Fetch dynamic shipping cost when cart changes
  useEffect(() => {
    if (cart.items.length === 0) {
      setShippingInfo(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setLoadingShipping(true);
        const result = await api.calculateShipping(cart.items, "US");
        if (!cancelled) setShippingInfo(result);
      } catch (e) {
        console.error("Failed to calculate shipping:", e);
        // Fallback to default if API fails
        if (!cancelled) {
          setShippingInfo({
            shippingCents: subtotalCents >= 5000 ? 0 : 599,
            totalWeightG: 0,
            freeShippingMin: 5000,
            zone: "Default",
          });
        }
      } finally {
        if (!cancelled) setLoadingShipping(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cart.items, subtotalCents]);

  const shippingCents = useMemo(() => {
    if (!shippingInfo) return 0;

    // Apply free shipping if threshold is met
    if (
      shippingInfo.freeShippingMin &&
      subtotalCents >= shippingInfo.freeShippingMin
    ) {
      return 0;
    }

    return shippingInfo.shippingCents;
  }, [shippingInfo, subtotalCents]);

  const taxCents = useMemo(() => {
    // Simple estimate (8%)
    return Math.round(subtotalCents * 0.08);
  }, [subtotalCents]);

  const totalCents = subtotalCents + shippingCents + taxCents;

  const itemCount = lineItems.reduce((sum, li) => sum + li.quantity, 0);

  async function onCheckout(): Promise<void> {
    setError("");
    if (cart.items.length === 0) return;
    setLoading(true);
    try {
      const { url } = await api.createCartCheckout(cart.items);
      window.location.href = url;
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col lg:flex-row gap-12">
        <div className="flex-grow">
          <div className="flex items-center justify-between mb-8">
            <h1 className="font-display text-3xl font-bold tracking-tight">
              Shopping Cart
            </h1>
            <span className="text-stone-500 dark:text-stone-400">
              {itemCount} {itemCount === 1 ? "Item" : "Items"}
            </span>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-lg px-4 py-3">
              <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
            </div>
          )}

          {cart.items.length === 0 ? (
            <div className="bg-white dark:bg-stone-950/40 border border-stone-200 dark:border-stone-800 rounded-2xl p-10">
              <p className="text-stone-600 dark:text-stone-400">
                Your cart is empty.
              </p>
              <Link
                to="/shop"
                className="inline-flex mt-6 text-primary font-semibold hover:underline underline-offset-4"
              >
                Continue Shopping
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {lineItems.map((li) => {
                const maxQty = Math.max(1, Math.min(10, li.stock || 10));
                const outOfStock = !li.missing && li.stock === 0;
                return (
                  <div
                    key={li.productId}
                    className="flex flex-col sm:flex-row items-start sm:items-center gap-6 p-6 rounded-2xl bg-white dark:bg-stone-950/40 border border-stone-100 dark:border-stone-800 shadow-sm transition-all hover:shadow-md"
                  >
                    <div className="w-24 h-24 flex-shrink-0 bg-stone-50 dark:bg-stone-800 rounded-xl flex items-center justify-center overflow-hidden">
                      <img
                        alt={li.name}
                        className="w-full h-full object-cover"
                        src={li.image}
                      />
                    </div>

                    <div className="flex-grow">
                      <h3 className="text-lg font-semibold mb-1">{li.name}</h3>
                      <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">
                        {li.description}
                      </p>

                      <div className="flex items-center gap-4">
                        <button
                          type="button"
                          className="text-xs font-medium text-stone-400 hover:text-primary flex items-center gap-1 transition-colors"
                          disabled
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            favorite
                          </span>
                          Save
                        </button>
                        <button
                          type="button"
                          className="text-xs font-medium text-stone-400 hover:text-red-500 flex items-center gap-1 transition-colors"
                          onClick={() => cart.removeFromCart(li.productId)}
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            delete
                          </span>
                          Remove
                        </button>
                      </div>

                      {outOfStock && (
                        <p className="mt-3 text-xs text-primary font-semibold">
                          Out of stock
                        </p>
                      )}
                      {li.missing && (
                        <p className="mt-3 text-xs text-primary font-semibold">
                          Unavailable
                        </p>
                      )}
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-4">
                      <div className="flex items-center border border-stone-200 dark:border-stone-700 rounded-lg overflow-hidden">
                        <button
                          type="button"
                          className="px-3 py-1 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors disabled:opacity-50"
                          onClick={() =>
                            cart.updateQuantity(
                              li.productId,
                              Math.max(1, li.quantity - 1)
                            )
                          }
                          disabled={loading || li.quantity <= 1}
                        >
                          -
                        </button>
                        <span className="px-4 py-1 text-sm font-medium">
                          {li.quantity}
                        </span>
                        <button
                          type="button"
                          className="px-3 py-1 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors disabled:opacity-50"
                          onClick={() =>
                            cart.updateQuantity(
                              li.productId,
                              Math.min(maxQty, li.quantity + 1)
                            )
                          }
                          disabled={loading || li.quantity >= maxQty}
                        >
                          +
                        </button>
                      </div>

                      <span className="text-xl font-bold">
                        {formatMoney(li.priceCents * li.quantity, currency)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-8">
            <Link
              className="inline-flex items-center text-primary font-semibold hover:underline underline-offset-4 gap-2"
              to="/shop"
            >
              <span className="material-symbols-outlined text-[18px]">
                arrow_back
              </span>
              Continue Shopping
            </Link>
          </div>

          {/* Order Summary */}
          <section className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-xl font-semibold mb-4">Order Summary</h3>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">
                  Subtotal
                </span>
                <span className="font-medium">
                  ${(subtotalCents / 100).toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <span>Estimated Shipping</span>
                  {loadingShipping && (
                    <span className="text-xs text-stone-400">
                      Calculating...
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="font-medium text-stone-900 dark:text-white">
                    {shippingCents === 0 ? (
                      <span className="text-green-600 dark:text-green-400 font-semibold">
                        FREE
                      </span>
                    ) : (
                      formatMoney(shippingCents, currency)
                    )}
                  </span>
                  {shippingInfo && shippingInfo.totalWeightG > 0 && (
                    <div className="text-xs text-stone-400 mt-0.5">
                      {Math.round(shippingInfo.totalWeightG)}g ·{" "}
                      {shippingInfo.zone}
                    </div>
                  )}
                </div>
              </div>
              {shippingInfo?.freeShippingMin &&
                subtotalCents < shippingInfo.freeShippingMin && (
                  <div className="text-xs text-stone-500 dark:text-stone-400 bg-stone-50 dark:bg-stone-800/50 rounded-lg px-3 py-2">
                    Add{" "}
                    {formatMoney(
                      shippingInfo.freeShippingMin - subtotalCents,
                      currency
                    )}{" "}
                    more for free shipping!
                  </div>
                )}
            </div>
          </section>
        </div>

        <div className="w-full lg:w-[400px]">
          <div className="bg-white dark:bg-stone-950/40 border border-stone-100 dark:border-stone-800 rounded-2xl p-8 sticky top-28 shadow-xl shadow-stone-200/50 dark:shadow-none">
            <h2 className="font-display text-2xl font-bold mb-6">
              Order Summary
            </h2>

            <div className="mb-8">
              <label
                className="block text-sm font-medium text-stone-600 dark:text-stone-400 mb-2"
                htmlFor="promo"
              >
                Discount Code
              </label>
              <div className="flex gap-2">
                <input
                  className="flex-grow bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 rounded-lg px-4 py-2 focus:ring-primary focus:border-primary"
                  id="promo"
                  placeholder="Enter code"
                  type="text"
                  disabled
                />
                <button
                  type="button"
                  disabled
                  className="px-4 py-2 bg-stone-900 dark:bg-white text-white dark:text-stone-900 text-sm font-bold rounded-lg opacity-60 cursor-not-allowed"
                >
                  Apply
                </button>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex justify-between text-stone-600 dark:text-stone-400">
                <span>Subtotal</span>
                <span className="font-medium text-stone-900 dark:text-white">
                  {formatMoney(subtotalCents, currency)}
                </span>
              </div>
              <div className="flex justify-between text-stone-600 dark:text-stone-400">
                <span>Estimated Shipping</span>
                <span className="font-medium text-stone-900 dark:text-white">
                  {formatMoney(shippingCents, currency)}
                </span>
              </div>
              <div className="flex justify-between text-stone-600 dark:text-stone-400">
                <span>Tax</span>
                <span className="font-medium text-stone-900 dark:text-white">
                  {formatMoney(taxCents, currency)}
                </span>
              </div>
              <div className="pt-4 border-t border-stone-100 dark:border-stone-800 flex justify-between items-end">
                <span className="text-lg font-bold">Total</span>
                <div className="text-right">
                  <span className="block text-2xl font-bold text-primary">
                    {formatMoney(totalCents, currency)}
                  </span>
                  <span className="text-xs text-stone-400">
                    VAT included where applicable
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onCheckout}
              disabled={cart.items.length === 0 || loading}
              className="w-full bg-primary text-white py-4 rounded-xl font-bold text-lg hover:bg-red-700 transform active:scale-[0.98] transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? "Redirecting…" : "Proceed to Checkout"}
              <span className="material-symbols-outlined">chevron_right</span>
            </button>

            <div className="mt-8 pt-8 border-t border-stone-100 dark:border-stone-800">
              <div className="flex flex-col items-center gap-4">
                <p className="text-[11px] text-stone-400 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">
                    lock
                  </span>
                  SSL Secured &amp; Encrypted Checkout
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading && cart.items.length > 0 && (
        <p className="mt-8 text-xs text-stone-400">
          Preparing Stripe Checkout…
        </p>
      )}
    </main>
  );
}
