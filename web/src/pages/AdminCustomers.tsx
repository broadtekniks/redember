import { useState, useEffect } from "react";
import { adminCustomers } from "../lib/api";

interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  totalOrders: number;
  totalSpent: number;
  createdAt: string;
  lastOrderDate?: string;
  status: "active" | "inactive" | "blocked";
}

type CustomerStatus = "all" | "active" | "inactive" | "blocked";

interface ExpandedCustomer {
  recentOrders: Array<{
    id: string;
    date: string;
    total: number;
    status: string;
  }>;
}

export default function AdminCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<CustomerStatus>("all");
  const [expandedCustomers, setExpandedCustomers] = useState<
    Record<string, ExpandedCustomer>
  >({});
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const data = await adminCustomers();
      setCustomers(data);
      setError(null);
    } catch (err) {
      setError("Failed to load customers");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: Customer["status"]) => {
    const styles = {
      active: "bg-green-100 text-green-700 border-green-200",
      inactive: "bg-gray-100 text-gray-700 border-gray-200",
      blocked: "bg-red-100 text-red-700 border-red-200",
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${styles[status]}`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      "bg-primary/10 text-primary",
      "bg-orange-100 text-orange-600",
      "bg-green-100 text-green-600",
      "bg-blue-100 text-blue-600",
      "bg-purple-100 text-purple-600",
      "bg-pink-100 text-pink-600",
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const toggleCustomerExpansion = async (customerId: string) => {
    if (expandedCustomers[customerId]) {
      const newExpanded = { ...expandedCustomers };
      delete newExpanded[customerId];
      setExpandedCustomers(newExpanded);
    } else {
      // In a real app, fetch recent orders for this customer
      const mockOrders = [
        {
          id: `#RE-${Math.floor(Math.random() * 10000)}`,
          date: new Date().toISOString(),
          total: 42.0,
          status: "Delivered",
        },
        {
          id: `#RE-${Math.floor(Math.random() * 10000)}`,
          date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          total: 28.0,
          status: "Delivered",
        },
      ];

      setExpandedCustomers({
        ...expandedCustomers,
        [customerId]: { recentOrders: mockOrders },
      });
    }
  };

  const toggleCustomerSelection = (customerId: string) => {
    const newSelected = new Set(selectedCustomers);
    if (newSelected.has(customerId)) {
      newSelected.delete(customerId);
    } else {
      newSelected.add(customerId);
    }
    setSelectedCustomers(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedCustomers.size === filteredCustomers.length) {
      setSelectedCustomers(new Set());
    } else {
      setSelectedCustomers(new Set(filteredCustomers.map((c) => c.id)));
    }
  };

  const filteredCustomers = customers.filter((customer) => {
    const matchesSearch =
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTab = activeTab === "all" || customer.status === activeTab;

    return matchesSearch && matchesTab;
  });

  const getTabCount = (status: CustomerStatus) => {
    if (status === "all") return customers.length;
    return customers.filter((c) => c.status === status).length;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-[#9a4c50]">Loading customers...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <span className="material-symbols-outlined text-6xl text-primary mb-4">
            error
          </span>
          <p className="text-xl font-bold text-[#1b0d0e] dark:text-white mb-2">
            Error Loading Customers
          </p>
          <p className="text-[#9a4c50] mb-4">{error}</p>
          <button
            onClick={loadCustomers}
            className="px-6 py-2 bg-primary text-white rounded-lg font-bold hover:bg-[#c40e18] transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      {/* Page Heading */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-black text-[#1b0d0e] dark:text-white tracking-tight">
            Customer Management
          </h2>
          <p className="text-[#9a4c50] mt-1">
            Manage your customer base and track their activity.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 h-11 bg-white dark:bg-[#1b0d0e] border border-[#e7cfd0] dark:border-[#3d2122] rounded-lg text-sm font-bold hover:bg-[#f3e7e8] transition-colors">
            <span className="material-symbols-outlined text-lg">download</span>
            Export CSV
          </button>
          <button className="flex items-center gap-2 px-6 h-11 bg-primary text-white rounded-lg text-sm font-bold hover:bg-[#c40e18] shadow-lg shadow-primary/20 transition-all">
            <span className="material-symbols-outlined text-lg">add</span>
            Add Customer
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#9a4c50] text-lg">
            search
          </span>
          <input
            type="text"
            placeholder="Search customers by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-[#1b0d0e] border border-[#e7cfd0] dark:border-[#3d2122] rounded-lg pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
      </div>

      {/* Tabs & Table */}
      <div className="bg-white dark:bg-[#1b0d0e] rounded-xl border border-[#e7cfd0] dark:border-[#3d2122] overflow-hidden">
        {/* Tabs */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-6 border-b border-[#e7cfd0] dark:border-[#3d2122]">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab("all")}
              className={`border-b-2 py-4 text-sm font-bold transition-colors ${
                activeTab === "all"
                  ? "border-primary text-primary"
                  : "border-transparent text-[#9a4c50] hover:text-[#1b0d0e]"
              }`}
            >
              All Customers ({getTabCount("all")})
            </button>
            <button
              onClick={() => setActiveTab("active")}
              className={`border-b-2 py-4 text-sm font-bold transition-colors ${
                activeTab === "active"
                  ? "border-primary text-primary"
                  : "border-transparent text-[#9a4c50] hover:text-[#1b0d0e]"
              }`}
            >
              Active ({getTabCount("active")})
            </button>
            <button
              onClick={() => setActiveTab("inactive")}
              className={`border-b-2 py-4 text-sm font-bold transition-colors ${
                activeTab === "inactive"
                  ? "border-primary text-primary"
                  : "border-transparent text-[#9a4c50] hover:text-[#1b0d0e]"
              }`}
            >
              Inactive ({getTabCount("inactive")})
            </button>
            <button
              onClick={() => setActiveTab("blocked")}
              className={`border-b-2 py-4 text-sm font-bold transition-colors ${
                activeTab === "blocked"
                  ? "border-primary text-primary"
                  : "border-transparent text-[#9a4c50] hover:text-[#1b0d0e]"
              }`}
            >
              Blocked ({getTabCount("blocked")})
            </button>
          </div>
          <div className="py-4 flex gap-3">
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#f3e7e8] dark:bg-[#2d1a1b] text-[#1b0d0e] dark:text-white">
              <span className="material-symbols-outlined text-sm">
                filter_list
              </span>
              Filter
            </button>
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#f3e7e8] dark:bg-[#2d1a1b] text-[#1b0d0e] dark:text-white">
              <span className="material-symbols-outlined text-sm">sort</span>
              Sort
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#fcf8f8] dark:bg-[#1b0d0e]">
                <th className="px-6 py-4 text-xs font-bold text-[#9a4c50] uppercase tracking-wider border-b border-[#e7cfd0] dark:border-[#3d2122]">
                  <input
                    type="checkbox"
                    checked={
                      selectedCustomers.size === filteredCustomers.length &&
                      filteredCustomers.length > 0
                    }
                    onChange={toggleSelectAll}
                    className="rounded border-[#e7cfd0] text-primary focus:ring-primary"
                  />
                </th>
                <th className="px-6 py-4 text-xs font-bold text-[#9a4c50] uppercase tracking-wider border-b border-[#e7cfd0] dark:border-[#3d2122]">
                  Customer
                </th>
                <th className="px-6 py-4 text-xs font-bold text-[#9a4c50] uppercase tracking-wider border-b border-[#e7cfd0] dark:border-[#3d2122]">
                  Email
                </th>
                <th className="px-6 py-4 text-xs font-bold text-[#9a4c50] uppercase tracking-wider border-b border-[#e7cfd0] dark:border-[#3d2122]">
                  Orders
                </th>
                <th className="px-6 py-4 text-xs font-bold text-[#9a4c50] uppercase tracking-wider border-b border-[#e7cfd0] dark:border-[#3d2122]">
                  Total Spent
                </th>
                <th className="px-6 py-4 text-xs font-bold text-[#9a4c50] uppercase tracking-wider border-b border-[#e7cfd0] dark:border-[#3d2122]">
                  Last Order
                </th>
                <th className="px-6 py-4 text-xs font-bold text-[#9a4c50] uppercase tracking-wider border-b border-[#e7cfd0] dark:border-[#3d2122]">
                  Status
                </th>
                <th className="px-6 py-4 text-xs font-bold text-[#9a4c50] uppercase tracking-wider border-b border-[#e7cfd0] dark:border-[#3d2122] text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e7cfd0] dark:divide-[#3d2122]">
              {filteredCustomers.map((customer) => (
                <>
                  <tr
                    key={customer.id}
                    className="hover:bg-[#fcf8f8] dark:hover:bg-[#221011] transition-colors cursor-pointer group"
                    onClick={() => toggleCustomerExpansion(customer.id)}
                  >
                    <td
                      className="px-6 py-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedCustomers.has(customer.id)}
                        onChange={() => toggleCustomerSelection(customer.id)}
                        className="rounded border-[#e7cfd0] text-primary focus:ring-primary"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`size-10 rounded-full flex items-center justify-center font-bold text-xs ${getAvatarColor(
                            customer.name
                          )}`}
                        >
                          {getInitials(customer.name)}
                        </div>
                        <div>
                          <p className="text-sm font-bold">{customer.name}</p>
                          {customer.phone && (
                            <p className="text-xs text-[#9a4c50]">
                              {customer.phone}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">{customer.email}</td>
                    <td className="px-6 py-4 text-sm font-semibold">
                      {customer.totalOrders}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold">
                      {formatMoney(customer.totalSpent)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {customer.lastOrderDate
                        ? formatDate(customer.lastOrderDate)
                        : "—"}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(customer.status)}
                    </td>
                    <td
                      className="px-6 py-4 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button className="p-2 hover:bg-[#f3e7e8] dark:hover:bg-[#2d1a1b] rounded-lg transition-colors">
                        <span className="material-symbols-outlined text-[#9a4c50]">
                          more_vert
                        </span>
                      </button>
                    </td>
                  </tr>

                  {/* Expanded Content */}
                  {expandedCustomers[customer.id] && (
                    <tr className="bg-[#fcf8f8] dark:bg-[#221011]">
                      <td
                        colSpan={8}
                        className="px-10 py-6 border-b border-[#e7cfd0] dark:border-[#3d2122]"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          {/* Customer Details */}
                          <div>
                            <h4 className="text-xs font-bold text-[#9a4c50] uppercase mb-4">
                              Customer Information
                            </h4>
                            <div className="space-y-3">
                              <div>
                                <p className="text-xs text-[#9a4c50] mb-1">
                                  Full Name
                                </p>
                                <p className="text-sm font-bold">
                                  {customer.name}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-[#9a4c50] mb-1">
                                  Email Address
                                </p>
                                <p className="text-sm">{customer.email}</p>
                              </div>
                              {customer.phone && (
                                <div>
                                  <p className="text-xs text-[#9a4c50] mb-1">
                                    Phone Number
                                  </p>
                                  <p className="text-sm">{customer.phone}</p>
                                </div>
                              )}
                              {customer.address && (
                                <div>
                                  <p className="text-xs text-[#9a4c50] mb-1">
                                    Address
                                  </p>
                                  <p className="text-sm">
                                    {customer.address.street}
                                    <br />
                                    {customer.address.city},{" "}
                                    {customer.address.state}{" "}
                                    {customer.address.zipCode}
                                    <br />
                                    {customer.address.country}
                                  </p>
                                </div>
                              )}
                              <div>
                                <p className="text-xs text-[#9a4c50] mb-1">
                                  Customer Since
                                </p>
                                <p className="text-sm">
                                  {formatDate(customer.createdAt)}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Recent Orders */}
                          <div>
                            <h4 className="text-xs font-bold text-[#9a4c50] uppercase mb-4">
                              Recent Orders
                            </h4>
                            <div className="space-y-3">
                              {expandedCustomers[customer.id].recentOrders.map(
                                (order) => (
                                  <div
                                    key={order.id}
                                    className="flex items-center justify-between p-3 bg-white dark:bg-[#1b0d0e] rounded-lg border border-[#e7cfd0] dark:border-[#3d2122]"
                                  >
                                    <div>
                                      <p className="text-sm font-bold">
                                        {order.id}
                                      </p>
                                      <p className="text-xs text-[#9a4c50]">
                                        {formatDate(order.date)}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-sm font-bold">
                                        {formatMoney(order.total)}
                                      </p>
                                      <p className="text-xs text-green-600">
                                        {order.status}
                                      </p>
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                            <div className="pt-4 flex gap-3">
                              <button className="px-4 py-2 bg-[#1b0d0e] dark:bg-white dark:text-[#1b0d0e] text-white text-xs font-bold rounded-lg hover:opacity-90">
                                View All Orders
                              </button>
                              <button className="px-4 py-2 border border-[#e7cfd0] dark:border-[#3d2122] text-xs font-bold rounded-lg hover:bg-white dark:hover:bg-[#1b0d0e]">
                                Send Email
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 bg-[#fcf8f8] dark:bg-[#1b0d0e] flex items-center justify-between border-t border-[#e7cfd0] dark:border-[#3d2122]">
          <p className="text-xs font-bold text-[#9a4c50]">
            Showing 1-{Math.min(10, filteredCustomers.length)} of{" "}
            {filteredCustomers.length} customers
          </p>
          <div className="flex gap-2">
            <button className="size-8 flex items-center justify-center rounded border border-[#e7cfd0] dark:border-[#3d2122] hover:bg-white dark:hover:bg-background-dark transition-colors">
              <span className="material-symbols-outlined text-sm">
                chevron_left
              </span>
            </button>
            <button className="size-8 flex items-center justify-center rounded bg-primary text-white text-xs font-bold">
              1
            </button>
            <button className="size-8 flex items-center justify-center rounded border border-[#e7cfd0] dark:border-[#3d2122] hover:bg-white dark:hover:bg-background-dark text-xs font-bold">
              2
            </button>
            <button className="size-8 flex items-center justify-center rounded border border-[#e7cfd0] dark:border-[#3d2122] hover:bg-white dark:hover:bg-background-dark text-xs font-bold">
              3
            </button>
            <button className="size-8 flex items-center justify-center rounded border border-[#e7cfd0] dark:border-[#3d2122] hover:bg-white dark:hover:bg-background-dark transition-colors">
              <span className="material-symbols-outlined text-sm">
                chevron_right
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedCustomers.size > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-[#1b0d0e] dark:bg-[#f8f6f6] text-white dark:text-[#1b0d0e] px-6 py-3 rounded-full shadow-2xl flex items-center gap-6">
            <p className="text-sm font-bold">
              {selectedCustomers.size} customers selected
            </p>
            <div className="h-4 w-px bg-white/20 dark:bg-[#1b0d0e]/20"></div>
            <div className="flex gap-4">
              <button className="text-sm font-bold flex items-center gap-1 hover:text-primary transition-colors">
                <span className="material-symbols-outlined text-lg">mail</span>
                Send Email
              </button>
              <button className="text-sm font-bold flex items-center gap-1 hover:text-primary transition-colors">
                <span className="material-symbols-outlined text-lg">
                  download
                </span>
                Export
              </button>
              <button className="text-sm font-bold flex items-center gap-1 text-red-500 hover:text-red-400 transition-colors">
                <span className="material-symbols-outlined text-lg">block</span>
                Block
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
