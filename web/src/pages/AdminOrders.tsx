import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminOrders } from "../lib/api";
import { useAdminAuth } from "../context/AdminAuthContext";
import { Order } from "../types";

type OrderStatus = "all" | "pending" | "processing" | "completed";

interface ExpandedOrder {
  [key: string]: boolean;
}

function formatMoney(cents: number, currency = "usd"): string {
  const value = (Number(cents) || 0) / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(value);
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStatusBadge(status: string): {
  bg: string;
  text: string;
  border: string;
  label: string;
} {
  switch (status.toLowerCase()) {
    case "pending":
      return {
        bg: "bg-primary/10",
        text: "text-primary",
        border: "border-primary/20",
        label: "Pending",
      };
    case "processing":
      return {
        bg: "bg-amber-100 dark:bg-amber-900/20",
        text: "text-amber-700 dark:text-amber-300",
        border: "border-amber-200 dark:border-amber-800",
        label: "Processing",
      };
    case "completed":
      return {
        bg: "bg-green-100 dark:bg-green-900/20",
        text: "text-green-700 dark:text-green-300",
        border: "border-green-200 dark:border-green-800",
        label: "Completed",
      };
    default:
      return {
        bg: "bg-slate-100 dark:bg-slate-800",
        text: "text-slate-700 dark:text-slate-300",
        border: "border-slate-200 dark:border-slate-700",
        label: status,
      };
  }
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function AdminOrders() {
  const { isAuthed } = useAdminAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState<OrderStatus>("all");
  const [expandedOrders, setExpandedOrders] = useState<ExpandedOrder>({});
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());

  async function loadOrders(): Promise<void> {
    if (!isAuthed) return;
    setError("");
    setLoading(true);
    try {
      const data = await adminOrders();
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      setError((e as Error).message);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed]);

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      searchQuery === "" ||
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerEmail?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTab =
      activeTab === "all" || order.status.toLowerCase() === activeTab;

    return matchesSearch && matchesTab;
  });

  const toggleOrderExpand = (orderId: string): void => {
    setExpandedOrders((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  const toggleOrderSelect = (orderId: string): void => {
    setSelectedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const toggleSelectAll = (): void => {
    if (selectedOrders.size === filteredOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(filteredOrders.map((o) => o.id)));
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      {/* Page Heading Section */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Order Management
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Review, track and fulfill your chili oil shipments.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/admin/orders/new"
            className="flex items-center gap-2 px-4 h-11 bg-primary text-white rounded-lg text-sm font-bold hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            New Manual Order
          </Link>
          <button
            onClick={() => {
              /* Export CSV logic */
            }}
            className="flex items-center gap-2 px-4 h-11 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">download</span>
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-lg px-4 py-3">
          <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Tabs & Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center justify-between px-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab("all")}
              className={`border-b-2 py-4 text-sm font-bold transition-colors ${
                activeTab === "all"
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              All Orders
            </button>
            <button
              onClick={() => setActiveTab("pending")}
              className={`border-b-2 py-4 text-sm font-bold transition-colors ${
                activeTab === "pending"
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setActiveTab("processing")}
              className={`border-b-2 py-4 text-sm font-bold transition-colors ${
                activeTab === "processing"
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Processing
            </button>
            <button
              onClick={() => setActiveTab("completed")}
              className={`border-b-2 py-4 text-sm font-bold transition-colors ${
                activeTab === "completed"
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Completed
            </button>
          </div>
          <div className="py-4">
            <div className="relative w-64">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 text-lg">
                search
              </span>
              <input
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="Search orders..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Table Section */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900">
                <th className="px-6 py-4 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <input
                    className="rounded border-slate-300 dark:border-slate-700 text-primary focus:ring-primary"
                    type="checkbox"
                    checked={
                      filteredOrders.length > 0 &&
                      selectedOrders.size === filteredOrders.length
                    }
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  Order ID
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  Customer
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  Date
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  Status
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  Total
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <span className="text-slate-500 dark:text-slate-400">
                      Loading orders...
                    </span>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <span className="text-slate-500 dark:text-slate-400">
                      No orders found
                    </span>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const status = getStatusBadge(order.status);
                  const isExpanded = expandedOrders[order.id];
                  const isSelected = selectedOrders.has(order.id);

                  return (
                    <Fragment key={order.id}>
                      <tr
                        className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors cursor-pointer"
                        onClick={() => toggleOrderExpand(order.id)}
                      >
                        <td
                          className="px-6 py-4"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            className="rounded border-slate-300 dark:border-slate-700 text-primary focus:ring-primary"
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleOrderSelect(order.id)}
                          />
                        </td>
                        <td className="px-6 py-4 font-bold text-sm">
                          #{order.id.toUpperCase().slice(0, 8)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                              {getInitials(
                                order.customerName || order.customerEmail || "?"
                              )}
                            </div>
                            <span className="text-sm font-semibold">
                              {order.customerName || order.customerEmail}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {formatDate(order.createdAt)}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${status.bg} ${status.text} border ${status.border}`}
                          >
                            {status.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold">
                          {formatMoney(order.totalCents, order.currency)}
                        </td>
                        <td
                          className="px-6 py-4 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                            <span className="material-symbols-outlined text-slate-600 dark:text-slate-400">
                              more_vert
                            </span>
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-50 dark:bg-slate-900/50">
                          <td
                            className="px-10 py-6 border-b border-slate-200 dark:border-slate-800"
                            colSpan={7}
                          >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              <div>
                                <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-4">
                                  Items Ordered
                                </h4>
                                <div className="space-y-4">
                                  {order.items.map((item, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-center justify-between"
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className="size-12 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1">
                                          <div className="w-full h-full rounded bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-slate-400 text-lg">
                                              local_fire_department
                                            </span>
                                          </div>
                                        </div>
                                        <div>
                                          <p className="text-sm font-bold">
                                            {item.productName}
                                          </p>
                                          <p className="text-xs text-slate-500 dark:text-slate-400">
                                            SKU: {item.productId}
                                          </p>
                                        </div>
                                      </div>
                                      <p className="text-sm font-bold">
                                        {item.quantity} x{" "}
                                        {formatMoney(
                                          item.priceCents,
                                          order.currency
                                        )}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-4">
                                  Customer Information
                                </h4>
                                <div className="text-sm space-y-2">
                                  <p className="font-bold">
                                    {order.customerName || order.customerEmail}
                                  </p>
                                  <p className="text-slate-600 dark:text-slate-400">
                                    {order.customerEmail}
                                  </p>
                                  <div className="pt-4 flex gap-3">
                                    <button className="px-4 py-2 bg-slate-900 dark:bg-white dark:text-slate-900 text-white text-xs font-bold rounded-lg hover:opacity-90">
                                      View Details
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 flex items-center justify-between border-t border-slate-200 dark:border-slate-800">
          <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
            Showing 1-{filteredOrders.length} of {filteredOrders.length} orders
          </p>
          <div className="flex gap-2">
            <button className="size-8 flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 transition-colors">
              <span className="material-symbols-outlined text-sm">
                chevron_left
              </span>
            </button>
            <button className="size-8 flex items-center justify-center rounded bg-primary text-white text-xs font-bold">
              1
            </button>
            <button className="size-8 flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 transition-colors">
              <span className="material-symbols-outlined text-sm">
                chevron_right
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedOrders.size > 0 && (
        <div className="mt-8 flex justify-center">
          <div className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-3 rounded-full shadow-2xl flex items-center gap-6">
            <p className="text-sm font-bold">
              {selectedOrders.size} order{selectedOrders.size > 1 ? "s" : ""}{" "}
              selected
            </p>
            <div className="h-4 w-px bg-white/20 dark:bg-slate-900/20"></div>
            <div className="flex gap-4">
              <button className="text-sm font-bold flex items-center gap-1 hover:text-primary transition-colors">
                <span className="material-symbols-outlined text-lg">
                  local_shipping
                </span>
                Mark as Processing
              </button>
              <button
                className="text-sm font-bold flex items-center gap-1 text-red-500 hover:text-red-400 transition-colors"
                onClick={() => setSelectedOrders(new Set())}
              >
                <span className="material-symbols-outlined text-lg">close</span>
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
