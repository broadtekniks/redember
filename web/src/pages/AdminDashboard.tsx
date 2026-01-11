import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { adminOrders, adminProducts } from "../lib/api";
import { useAdminAuth } from "../context/AdminAuthContext";
import { Product } from "../types";

interface KPIs {
  currency: string;
  currentRevenue: number;
  revenuePct: number;
  currentOrderCount: number;
  ordersPct: number;
  currentAov: number;
  aovPct: number;
  currentCustomers: number;
  customersPct: number;
}

interface TopProductBase {
  name: string;
  qty: number;
  total: number;
  currency: string;
}

interface TopProduct extends TopProductBase {
  pctOfTop: number;
}

interface Activity {
  kind: "order" | "customer" | "stock" | "note";
  title: string;
  body: string;
  when: string;
}

interface OrderResponse {
  id: string;
  stripeSessionId: string;
  status: string;
  total: number;
  currency: string;
  email: string | null;
  createdAt: string;
  itemsJson: string;
}

interface ItemFromJson {
  description?: string;
  quantity?: number;
  amountTotal?: number;
}

function formatMoney(cents: number, currency: string = "usd"): string {
  const value = (Number(cents) || 0) / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: String(currency || "usd").toUpperCase(),
  }).format(value);
}

function pctChange(current: number, previous: number): number {
  const c = Number(current) || 0;
  const p = Number(previous) || 0;
  if (p === 0) {
    if (c === 0) return 0;
    return 100;
  }
  return ((c - p) / p) * 100;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function timeAgo(date: string): string {
  const ms = Date.now() - new Date(date).getTime();
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function downloadCsv(
  filename: string,
  rows: Array<Array<string | number | null | undefined>>
): void {
  const escape = (v: string | number | null | undefined): string => {
    const s = String(v ?? "");
    if (/[\",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const csv = rows.map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function AdminDashboard() {
  const { isAuthed } = useAdminAuth();

  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  async function refresh(): Promise<void> {
    if (!isAuthed) return;
    setError("");
    setLoading(true);
    try {
      const [o, p] = await Promise.all([adminOrders(), adminProducts()]);
      setOrders(Array.isArray(o) ? o : []);
      setProducts(Array.isArray(p) ? p : []);
    } catch (e) {
      setError((e as Error).message);
      setOrders([]);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isAuthed) {
      setOrders([]);
      setProducts([]);
      setError("");
      return;
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed]);

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const rangeDays = 30;

  const { kpis, topProducts, recentActivity, lowStockProduct } = useMemo(() => {
    const parsedOrders = (Array.isArray(orders) ? orders : [])
      .map((o) => ({
        ...o,
        createdAtMs: new Date(o.createdAt).getTime(),
      }))
      .filter((o) => Number.isFinite(o.createdAtMs))
      .sort((a, b) => b.createdAtMs - a.createdAtMs);

    const currentStart = now - rangeDays * dayMs;
    const prevStart = now - rangeDays * 2 * dayMs;
    const prevEnd = currentStart;

    const inWindow = (
      o: (typeof parsedOrders)[0],
      start: number,
      end: number
    ): boolean => o.createdAtMs >= start && o.createdAtMs < end;

    const currentOrders = parsedOrders.filter((o) =>
      inWindow(o, currentStart, now)
    );
    const previousOrders = parsedOrders.filter((o) =>
      inWindow(o, prevStart, prevEnd)
    );

    const sumRevenue = (list: typeof parsedOrders): number =>
      list.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    const currentRevenue = sumRevenue(currentOrders);
    const previousRevenue = sumRevenue(previousOrders);

    const currentOrderCount = currentOrders.length;
    const previousOrderCount = previousOrders.length;

    const currentAov =
      currentOrderCount > 0
        ? Math.round(currentRevenue / currentOrderCount)
        : 0;
    const previousAov =
      previousOrderCount > 0
        ? Math.round(previousRevenue / previousOrderCount)
        : 0;

    const uniq = (list: typeof parsedOrders): Set<string> => {
      const set = new Set<string>();
      list.forEach((o) => {
        const email = (o.email || "").trim().toLowerCase();
        if (email) set.add(email);
      });
      return set;
    };

    const currentCustomers = uniq(currentOrders);
    const previousCustomers = uniq(previousOrders);

    const currency = (
      currentOrders.find((o) => o.currency)?.currency || "usd"
    ).toLowerCase();

    // Aggregate items from itemsJson (description + qty + total)
    const itemAgg = new Map<
      string,
      { name: string; qty: number; total: number; currency: string }
    >();
    for (const o of currentOrders) {
      try {
        const items = JSON.parse(o.itemsJson || "[]");
        if (!Array.isArray(items)) continue;
        for (const it of items as ItemFromJson[]) {
          const key = String(it?.description || "Unknown item");
          const prev = itemAgg.get(key) || {
            name: key,
            qty: 0,
            total: 0,
            currency,
          };
          prev.qty += Number(it?.quantity) || 0;
          prev.total += Number(it?.amountTotal) || 0;
          itemAgg.set(key, prev);
        }
      } catch {
        // ignore
      }
    }

    const top: TopProductBase[] = Array.from(itemAgg.values())
      .filter((x) => x.qty > 0)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 3);

    const topQty = top.length > 0 ? top[0].qty : 0;

    const lowStock = (Array.isArray(products) ? products : [])
      .filter((p) => p && p.active !== false)
      .sort((a, b) => (Number(a.stock) || 0) - (Number(b.stock) || 0))[0];

    const activity: Activity[] = [];
    const latestOrder = parsedOrders[0];
    if (latestOrder) {
      let itemSummary = "New order";
      try {
        const items = JSON.parse(latestOrder.itemsJson || "[]");
        if (Array.isArray(items) && (items[0] as ItemFromJson)?.description)
          itemSummary = (items[0] as ItemFromJson).description!;
      } catch {
        // ignore
      }
      activity.push({
        kind: "order",
        title: `New Order #${latestOrder.id}`,
        body: itemSummary,
        when: timeAgo(latestOrder.createdAt),
      });
    }

    const latestCustomerOrder = parsedOrders.find((o) =>
      (o.email || "").trim()
    );
    if (latestCustomerOrder) {
      activity.push({
        kind: "customer",
        title: "Customer purchase",
        body: `${latestCustomerOrder.email} placed an order`,
        when: timeAgo(latestCustomerOrder.createdAt),
      });
    }

    if (lowStock && Number(lowStock.stock) <= 10) {
      activity.push({
        kind: "stock",
        title: "Low Stock Warning",
        body: `${lowStock.name} is below threshold (${lowStock.stock} units left)`,
        when: "—",
      });
    }

    while (activity.length < 3) {
      activity.push({
        kind: "note",
        title: "Store update",
        body: "More activity will appear as orders come in.",
        when: "—",
      });
    }

    return {
      kpis: {
        currency,
        currentRevenue,
        revenuePct: pctChange(currentRevenue, previousRevenue),
        currentOrderCount,
        ordersPct: pctChange(currentOrderCount, previousOrderCount),
        currentAov,
        aovPct: pctChange(currentAov, previousAov),
        currentCustomers: currentCustomers.size,
        customersPct: pctChange(currentCustomers.size, previousCustomers.size),
      } as KPIs,
      topProducts: top.map(
        (t): TopProduct => ({
          ...t,
          pctOfTop: topQty > 0 ? clamp((t.qty / topQty) * 100, 0, 100) : 0,
        })
      ),
      recentActivity: activity.slice(0, 3),
      lowStockProduct: lowStock || null,
    };
  }, [orders, products, now]);

  function exportReport(): void {
    if (!isAuthed) return;
    const rows = [
      [
        "Order ID",
        "Created At",
        "Status",
        "Email",
        "Total (cents)",
        "Currency",
      ],
      ...(Array.isArray(orders) ? orders : []).map((o) => [
        o.id,
        o.createdAt,
        o.status,
        o.email || "",
        o.total,
        o.currency,
      ]),
    ];
    downloadCsv(
      `redember-orders-${new Date().toISOString().slice(0, 10)}.csv`,
      rows
    );
  }

  const Trend = ({ value }: { value: number }) => {
    const v = Number(value) || 0;
    const up = v >= 0;
    const color = up ? "text-[#07885d]" : "text-[#e75a08]";
    const icon = up ? "trending_up" : "trending_down";
    return (
      <span className={`${color} text-xs font-bold flex items-center`}>
        <span className="material-symbols-outlined text-[16px]">{icon}</span>
        {Math.abs(v).toFixed(1)}%
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto font-[Manrope]">
      {/* Page Heading */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div className="flex flex-col gap-1">
          <p className="text-[#1b0d0e] dark:text-white text-3xl font-black tracking-tight">
            Sales Analytics
          </p>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Real-time performance metrics for Red Ember store.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-200"
          >
            <span className="material-symbols-outlined text-[18px]">
              calendar_today
            </span>
            Last {rangeDays} Days
          </button>
          {isAuthed && (
            <button
              type="button"
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
              onClick={refresh}
              disabled={loading}
            >
              <span className="material-symbols-outlined text-[18px]">
                refresh
              </span>
              Refresh
            </button>
          )}
          <button
            type="button"
            className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
            onClick={exportReport}
            disabled={!isAuthed || loading}
            title={!isAuthed ? "Set admin token to export" : ""}
          >
            <span className="material-symbols-outlined text-[18px]">
              download
            </span>
            Export Report
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-lg px-4 py-3">
          <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
        </div>
      )}

      {!isAuthed && (
        <div className="mb-6 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Set your admin token in the sidebar to load real metrics.
          </p>
        </div>
      )}

      {/* KPI Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 p-6 rounded-xl shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-widest">
              Total Revenue
            </p>
            <span className="material-symbols-outlined text-primary/40">
              payments
            </span>
          </div>
          <p className="text-[#1b0d0e] dark:text-white text-3xl font-extrabold">
            {formatMoney(kpis.currentRevenue, kpis.currency)}
          </p>
          <div className="flex items-center gap-1 mt-2">
            <Trend value={kpis.revenuePct} />
            <span className="text-gray-400 text-[10px] font-medium">
              vs prior {rangeDays}d
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 p-6 rounded-xl shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-widest">
              Total Orders
            </p>
            <span className="material-symbols-outlined text-primary/40">
              shopping_cart
            </span>
          </div>
          <p className="text-[#1b0d0e] dark:text-white text-3xl font-extrabold">
            {kpis.currentOrderCount.toLocaleString()}
          </p>
          <div className="flex items-center gap-1 mt-2">
            <Trend value={kpis.ordersPct} />
            <span className="text-gray-400 text-[10px] font-medium">
              vs prior {rangeDays}d
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 p-6 rounded-xl shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-widest">
              Avg Order Value
            </p>
            <span className="material-symbols-outlined text-primary/40">
              shopping_basket
            </span>
          </div>
          <p className="text-[#1b0d0e] dark:text-white text-3xl font-extrabold">
            {formatMoney(kpis.currentAov, kpis.currency)}
          </p>
          <div className="flex items-center gap-1 mt-2">
            <Trend value={kpis.aovPct} />
            <span className="text-gray-400 text-[10px] font-medium">
              vs prior {rangeDays}d
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 p-6 rounded-xl shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-widest">
              Active Customers
            </p>
            <span className="material-symbols-outlined text-primary/40">
              group_add
            </span>
          </div>
          <p className="text-[#1b0d0e] dark:text-white text-3xl font-extrabold">
            {kpis.currentCustomers.toLocaleString()}
          </p>
          <div className="flex items-center gap-1 mt-2">
            <Trend value={kpis.customersPct} />
            <span className="text-gray-400 text-[10px] font-medium">
              vs prior {rangeDays}d
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Charts & Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sales Trend Chart Area */}
        <div className="lg:col-span-2 bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 p-8 rounded-xl shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-[#1b0d0e] dark:text-white text-lg font-bold">
                Revenue Growth
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Daily sales tracking over last {rangeDays} days
              </p>
            </div>
            <div className="flex gap-2">
              <span className="flex items-center gap-1.5 text-xs font-bold text-[#1b0d0e] dark:text-white">
                <span className="size-2 rounded-full bg-primary" />
                Current
              </span>
              <span className="flex items-center gap-1.5 text-xs font-bold text-gray-300 dark:text-gray-600">
                <span className="size-2 rounded-full bg-gray-200 dark:bg-gray-700" />
                Previous
              </span>
            </div>
          </div>

          {/* Chart Component (static placeholder) */}
          <div className="h-[300px] w-full relative">
            <svg
              className="w-full h-full"
              fill="none"
              preserveAspectRatio="none"
              viewBox="0 0 800 300"
              xmlns="http://www.w3.org/2000/svg"
            >
              <line
                className="text-gray-100 dark:text-white/5"
                stroke="currentColor"
                strokeDasharray="4 4"
                x1="0"
                x2="800"
                y1="50"
                y2="50"
              />
              <line
                className="text-gray-100 dark:text-white/5"
                stroke="currentColor"
                strokeDasharray="4 4"
                x1="0"
                x2="800"
                y1="150"
                y2="150"
              />
              <line
                className="text-gray-100 dark:text-white/5"
                stroke="currentColor"
                strokeDasharray="4 4"
                x1="0"
                x2="800"
                y1="250"
                y2="250"
              />
              <path
                d="M0 260C100 240 150 100 250 80C350 60 400 180 500 160C600 140 700 40 800 20L800 300L0 300Z"
                fill="url(#salesGradient)"
              />
              <path
                d="M0 260C100 240 150 100 250 80C350 60 400 180 500 160C600 140 700 40 800 20"
                stroke="currentColor"
                className="text-primary"
                strokeLinecap="round"
                strokeWidth="4"
              />
              <defs>
                <linearGradient id="salesGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#e63946" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#e63946" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
            <div className="flex justify-between mt-6 px-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                Day 1
              </span>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                Day 7
              </span>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                Day 14
              </span>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                Day 21
              </span>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                Day 30
              </span>
            </div>
          </div>
        </div>

        {/* Top Selling Products */}
        <div className="bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 p-8 rounded-xl shadow-sm flex flex-col h-full">
          <div className="mb-6">
            <h3 className="text-[#1b0d0e] dark:text-white text-lg font-bold">
              Top Products
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Best sellers by volume
            </p>
          </div>

          <div className="flex flex-col gap-6 flex-1">
            {topProducts.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isAuthed
                  ? "No sales data in range yet."
                  : "Set token to load."}
              </p>
            ) : (
              topProducts.map((p, idx) => (
                <div key={p.name} className="flex items-center gap-4">
                  <div className="size-14 rounded-lg bg-gray-50 dark:bg-white/5 flex-shrink-0 flex items-center justify-center p-2">
                    <span className="material-symbols-outlined text-primary/60">
                      local_fire_department
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[#1b0d0e] dark:text-white text-sm font-bold truncate">
                      {p.name}
                    </p>
                    <div className="w-full h-1.5 bg-gray-100 dark:bg-white/5 rounded-full mt-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          idx === 0
                            ? "bg-primary"
                            : idx === 1
                            ? "bg-orange-500"
                            : "bg-amber-500"
                        }`}
                        style={{ width: `${p.pctOfTop}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-[11px] text-gray-400 font-medium">
                        {p.qty.toLocaleString()} Sold
                      </p>
                      <p className="text-[11px] text-[#1b0d0e] dark:text-white font-bold">
                        {formatMoney(p.total, kpis.currency)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <Link
            to="/admin/inventory"
            className="w-full mt-8 py-2.5 text-center text-sm font-bold text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
          >
            View Inventory
          </Link>
        </div>
      </div>

      {/* Recent Activities Section */}
      <div className="mt-8 bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-white/10 flex justify-between items-center">
          <h3 className="text-[#1b0d0e] dark:text-white text-lg font-bold">
            Recent Store Activity
          </h3>
          <button
            type="button"
            className="text-primary text-xs font-bold uppercase tracking-widest hover:underline"
            disabled
          >
            See activity log
          </button>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-white/10">
          {recentActivity.map((a, index) => {
            const icon =
              a.kind === "order"
                ? "shopping_cart_checkout"
                : a.kind === "customer"
                ? "person_add"
                : a.kind === "stock"
                ? "warning"
                : "info";

            const bg =
              a.kind === "order"
                ? "bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-500"
                : a.kind === "customer"
                ? "bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-500"
                : a.kind === "stock"
                ? "bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500"
                : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300";

            return (
              <div
                key={`${a.kind}-${a.title}-${index}`}
                className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`size-9 rounded-full flex items-center justify-center ${bg}`}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {icon}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#1b0d0e] dark:text-white">
                      {a.title}
                    </p>
                    <p className="text-xs text-gray-500">{a.body}</p>
                  </div>
                </div>
                <p className="text-xs font-medium text-gray-400">{a.when}</p>
              </div>
            );
          })}
        </div>

        {lowStockProduct && Number(lowStockProduct.stock) > 10 && (
          <div className="p-4 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-white/10">
            Lowest-stock SKU right now:{" "}
            <span className="font-semibold">{lowStockProduct.name}</span> (
            {lowStockProduct.stock} units)
          </div>
        )}
      </div>
    </div>
  );
}
