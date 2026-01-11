import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  adminCreateManualOrder,
  adminProducts,
  calculateShipping,
} from "../lib/api";
import { useAdminAuth } from "../context/AdminAuthContext";
import { Product } from "../types";

type OrderStatus = "pending" | "processing" | "completed" | "PAID";

type DraftItem = {
  productId: string;
  quantity: number;
};

type ShippingAddress = {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postal: string;
  country: string;
};

type ShippingInfo = {
  shippingCents: number;
  totalWeightG?: number;
  freeShippingMin?: number | null;
  zone?: string;
};

function formatMoney(cents: number, currency = "usd"): string {
  const value = (Number(cents) || 0) / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(value);
}

function clampInt(n: unknown, min: number, max: number): number {
  const v = parseInt(String(n ?? ""), 10);
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

export default function AdminCreateOrder() {
  const { isAuthed } = useAdminAuth();
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const [status, setStatus] = useState<OrderStatus>("pending");

  const [customerEmail, setCustomerEmail] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");

  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    line1: "",
    line2: "",
    city: "",
    state: "",
    postal: "",
    country: "US",
  });

  const [items, setItems] = useState<DraftItem[]>([
    { productId: "", quantity: 1 },
  ]);

  const [autoShipping, setAutoShipping] = useState<boolean>(true);
  const [shippingInfo, setShippingInfo] = useState<ShippingInfo>({
    shippingCents: 0,
  });
  const [loadingShipping, setLoadingShipping] = useState<boolean>(false);

  useEffect(() => {
    if (!isAuthed) return;
    let cancelled = false;
    (async () => {
      setError("");
      setLoading(true);
      try {
        const p = await adminProducts();
        if (!cancelled) setProducts(Array.isArray(p) ? p : []);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthed]);

  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of products) map.set(p.id, p);
    return map;
  }, [products]);

  const normalizedItems = useMemo(() => {
    return items
      .map((it) => ({
        productId: String(it.productId || "").trim(),
        quantity: clampInt(it.quantity, 1, 9999),
      }))
      .filter((it) => it.productId);
  }, [items]);

  const currency = useMemo(() => {
    const first = normalizedItems[0]?.productId;
    const p = first ? productMap.get(first) : null;
    return (p?.currency || "usd").toLowerCase();
  }, [normalizedItems, productMap]);

  const requiresShipping = useMemo(() => {
    return normalizedItems.some(
      (it) => productMap.get(it.productId)?.requiresShipping
    );
  }, [normalizedItems, productMap]);

  const subtotalCents = useMemo(() => {
    let total = 0;
    for (const it of normalizedItems) {
      const p = productMap.get(it.productId);
      if (!p) continue;
      total += (p.priceCents || 0) * it.quantity;
    }
    return total;
  }, [normalizedItems, productMap]);

  const effectiveShippingCents = useMemo(() => {
    const base = Number(shippingInfo.shippingCents) || 0;
    const freeMin = shippingInfo.freeShippingMin;
    if (freeMin && subtotalCents >= freeMin) return 0;
    return base;
  }, [shippingInfo, subtotalCents]);

  const totalCents = subtotalCents + effectiveShippingCents;

  useEffect(() => {
    if (!isAuthed) return;
    if (!autoShipping) return;
    if (!requiresShipping) {
      setShippingInfo((prev) => ({ ...prev, shippingCents: 0 }));
      return;
    }
    if (normalizedItems.length === 0) {
      setShippingInfo((prev) => ({ ...prev, shippingCents: 0 }));
      return;
    }

    let cancelled = false;
    const handle = window.setTimeout(async () => {
      try {
        setLoadingShipping(true);
        const result = await calculateShipping(
          normalizedItems.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
          (shippingAddress.country || "US").toUpperCase()
        );
        if (cancelled) return;
        setShippingInfo({
          shippingCents: Number(result?.shippingCents) || 0,
          totalWeightG: Number(result?.totalWeightG) || 0,
          freeShippingMin: result?.freeShippingMin ?? null,
          zone: String(result?.zone || ""),
        });
      } catch {
        if (!cancelled) {
          setShippingInfo({
            shippingCents: 0,
            freeShippingMin: null,
            zone: "",
          });
        }
      } finally {
        if (!cancelled) setLoadingShipping(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [
    isAuthed,
    autoShipping,
    requiresShipping,
    normalizedItems,
    shippingAddress.country,
  ]);

  function updateItem(idx: number, patch: Partial<DraftItem>): void {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, ...patch } : it))
    );
  }

  function removeItem(idx: number): void {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function addItem(): void {
    setItems((prev) => [...prev, { productId: "", quantity: 1 }]);
  }

  async function onSubmit(): Promise<void> {
    setError("");
    const email = customerEmail.trim();
    if (!email) {
      setError("Customer email is required");
      return;
    }
    if (normalizedItems.length === 0) {
      setError("Add at least one item");
      return;
    }

    if (requiresShipping) {
      const a = shippingAddress;
      if (!a.line1 || !a.city || !a.state || !a.postal || !a.country) {
        setError("Shipping address is required for shippable items");
        return;
      }
    }

    const payload: any = {
      status,
      customer: {
        email,
        name: customerName.trim() || null,
        phone: customerPhone.trim() || null,
      },
      items: normalizedItems,
      shippingAddress: requiresShipping
        ? {
            line1: shippingAddress.line1.trim(),
            line2: shippingAddress.line2.trim() || null,
            city: shippingAddress.city.trim(),
            state: shippingAddress.state.trim(),
            postal: shippingAddress.postal.trim(),
            country: (shippingAddress.country || "US").trim().toUpperCase(),
          }
        : null,
    };

    if (!autoShipping) {
      payload.shippingCents = Math.max(
        0,
        Math.round(Number(shippingInfo.shippingCents) || 0)
      );
    }

    setSaving(true);
    try {
      await adminCreateManualOrder(payload);
      navigate("/admin/orders");
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-end justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            New Manual Order
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Create an order without Stripe checkout.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/admin/orders"
            className="flex items-center gap-2 px-4 h-11 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">
              arrow_back
            </span>
            Back
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-lg px-4 py-3">
          <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                Customer Email
              </label>
              <input
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="customer@example.com"
                type="email"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                Status
              </label>
              <select
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value as OrderStatus)}
              >
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="PAID">Paid</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                Customer Name (optional)
              </label>
              <input
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                Phone (optional)
              </label>
              <input
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+1 (555) 555-5555"
              />
            </div>
          </div>
        </div>

        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
              Items
            </h3>
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center gap-2 px-3 h-9 rounded-lg bg-primary text-white text-sm font-bold hover:opacity-90"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              Add Item
            </button>
          </div>

          {loading ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Loading products…
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((it, idx) => {
                const p = it.productId ? productMap.get(it.productId) : null;
                const maxQty = p?.stock ?? 9999;
                const qty = clampInt(it.quantity, 1, maxQty);
                const lineTotal = p ? (p.priceCents || 0) * qty : 0;

                return (
                  <div
                    key={idx}
                    className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3"
                  >
                    <div className="md:col-span-7">
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                        Product
                      </label>
                      <select
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"
                        value={it.productId}
                        onChange={(e) =>
                          updateItem(idx, { productId: e.target.value })
                        }
                      >
                        <option value="">Select a product…</option>
                        {products
                          .filter((pr) => pr.active)
                          .map((pr) => (
                            <option key={pr.id} value={pr.id}>
                              {pr.name} —{" "}
                              {formatMoney(pr.priceCents, pr.currency)} (stock{" "}
                              {pr.stock})
                            </option>
                          ))}
                      </select>
                      {p && (
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          SKU: {p.sku} • Requires shipping:{" "}
                          {p.requiresShipping ? "Yes" : "No"}
                        </p>
                      )}
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                        Qty
                      </label>
                      <input
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"
                        type="number"
                        min={1}
                        max={maxQty}
                        value={it.quantity}
                        onChange={(e) =>
                          updateItem(idx, {
                            quantity: clampInt(e.target.value, 1, maxQty),
                          })
                        }
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                        Line Total
                      </label>
                      <div className="h-10 flex items-center px-3 rounded-lg bg-white/60 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 text-sm font-bold">
                        {formatMoney(lineTotal, currency)}
                      </div>
                    </div>

                    <div className="md:col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        disabled={items.length <= 1}
                        className="h-10 w-10 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50"
                        title="Remove"
                      >
                        <span className="material-symbols-outlined text-lg">
                          delete
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
              Shipping
            </h3>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={autoShipping}
                onChange={(e) => setAutoShipping(e.target.checked)}
              />
              Auto-calculate
            </label>
          </div>

          {!requiresShipping ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              No shippable items in this order.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Address Line 1
                </label>
                <input
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"
                  value={shippingAddress.line1}
                  onChange={(e) =>
                    setShippingAddress((p) => ({ ...p, line1: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Address Line 2 (optional)
                </label>
                <input
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"
                  value={shippingAddress.line2}
                  onChange={(e) =>
                    setShippingAddress((p) => ({ ...p, line2: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                  City
                </label>
                <input
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"
                  value={shippingAddress.city}
                  onChange={(e) =>
                    setShippingAddress((p) => ({ ...p, city: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                  State/Province
                </label>
                <input
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"
                  value={shippingAddress.state}
                  onChange={(e) =>
                    setShippingAddress((p) => ({ ...p, state: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Postal Code
                </label>
                <input
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"
                  value={shippingAddress.postal}
                  onChange={(e) =>
                    setShippingAddress((p) => ({
                      ...p,
                      postal: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Country
                </label>
                <input
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"
                  value={shippingAddress.country}
                  onChange={(e) =>
                    setShippingAddress((p) => ({
                      ...p,
                      country: e.target.value,
                    }))
                  }
                  placeholder="US"
                />
              </div>

              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Shipping (cents)
                  </label>
                  <input
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm disabled:opacity-60"
                    disabled={autoShipping}
                    type="number"
                    min={0}
                    value={shippingInfo.shippingCents}
                    onChange={(e) =>
                      setShippingInfo((p) => ({
                        ...p,
                        shippingCents: Math.max(
                          0,
                          Math.round(Number(e.target.value) || 0)
                        ),
                      }))
                    }
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {loadingShipping
                      ? "Calculating…"
                      : autoShipping
                      ? `Zone: ${shippingInfo.zone || "—"}`
                      : "Manual override"}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Effective Shipping
                  </label>
                  <div className="h-10 flex items-center px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold">
                    {formatMoney(effectiveShippingCents, currency)}
                  </div>
                  {shippingInfo.freeShippingMin &&
                    subtotalCents < shippingInfo.freeShippingMin && (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Free shipping at{" "}
                        {formatMoney(shippingInfo.freeShippingMin, currency)}
                      </p>
                    )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="text-sm">
            <div className="flex gap-6">
              <div>
                <div className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">
                  Subtotal
                </div>
                <div className="text-lg font-black">
                  {formatMoney(subtotalCents, currency)}
                </div>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">
                  Total
                </div>
                <div className="text-lg font-black">
                  {formatMoney(totalCents, currency)}
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={saving || loading}
            onClick={onSubmit}
            className="inline-flex items-center justify-center gap-2 px-5 h-11 rounded-lg bg-primary text-white text-sm font-black hover:opacity-90 disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-lg">check</span>
            {saving ? "Creating…" : "Create Order"}
          </button>
        </div>
      </div>
    </div>
  );
}
