import { NavLink } from "react-router-dom";
import Brand from "./Brand";
import { useAdminAuth } from "../context/AdminAuthContext";

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return [
    "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
    isActive
      ? "bg-primary/10 text-primary dark:text-yellow-300"
      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800",
  ].join(" ");
}

export default function AdminSidebar() {
  const { user, logout } = useAdminAuth();

  return (
    <aside className="w-64 bg-white dark:bg-[#2A1A14] border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0">
      <div className="p-6 flex items-center gap-3">
        <Brand size="sm" />
        <div>
          <h1 className="text-lg font-bold text-primary dark:text-yellow-300 tracking-tight leading-tight">
            RED EMBER
          </h1>
          <p className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Admin
          </p>
        </div>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1">
        <NavLink className={navLinkClass} to="/admin" end>
          <span className="material-symbols-outlined text-xl">dashboard</span>
          Sales Analytics
        </NavLink>

        <NavLink className={navLinkClass} to="/admin/orders">
          <span className="material-symbols-outlined text-xl">package_2</span>
          Orders
        </NavLink>

        <NavLink className={navLinkClass} to="/admin/inventory">
          <span className="material-symbols-outlined text-xl">inventory_2</span>
          Inventory
        </NavLink>

        <NavLink className={navLinkClass} to="/admin/categories">
          <span className="material-symbols-outlined text-xl">category</span>
          Product Categories
        </NavLink>

        <NavLink className={navLinkClass} to="/admin/media">
          <span className="material-symbols-outlined text-xl">
            photo_library
          </span>
          Media Gallery
        </NavLink>

        <NavLink className={navLinkClass} to="/admin/customers">
          <span className="material-symbols-outlined text-xl">group</span>
          Customers
        </NavLink>

        <NavLink className={navLinkClass} to="/admin/shipping">
          <span className="material-symbols-outlined text-xl">
            local_shipping
          </span>
          Shipping
        </NavLink>

        <div className="pt-6 pb-2 px-3 text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-widest">
          Settings
        </div>

        <NavLink className={navLinkClass} to="/admin/settings">
          <span className="material-symbols-outlined text-xl">settings</span>
          Store Settings
        </NavLink>

        <NavLink className={navLinkClass} to="/admin/users">
          <span className="material-symbols-outlined text-xl">
            manage_accounts
          </span>
          Admin Users
        </NavLink>

        <div className="pt-6 pb-2 px-3 text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-widest">
          Account
        </div>

        <div className="px-3">
          <div className="text-xs text-slate-600 dark:text-slate-300 mb-1 font-medium">
            {user?.name || "Admin"}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mb-3">
            {user?.email}
          </div>
          <button
            type="button"
            className="w-full inline-flex justify-center items-center px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700"
            onClick={logout}
          >
            Log out
          </button>
        </div>
      </nav>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800">
        <button
          className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
          type="button"
          onClick={() => document.documentElement.classList.toggle("dark")}
        >
          <span className="material-symbols-outlined text-xl">dark_mode</span>
          Toggle Theme
        </button>
      </div>
    </aside>
  );
}
