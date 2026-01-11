import { useEffect } from "react";
import { Outlet, Navigate } from "react-router-dom";
import AdminSidebar from "./AdminSidebar";
import { useAdminAuth } from "../context/AdminAuthContext";

function ProtectedAdminRoutes() {
  const { isAuthed, loading } = useAdminAuth();

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          fontSize: "18px",
          color: "#666",
        }}
      >
        Loading...
      </div>
    );
  }

  if (!isAuthed) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-background-dark p-8">
        <Outlet />
      </main>
    </div>
  );
}

export default function AdminLayout() {
  // Initialize theme once (same behavior as the public layout).
  useEffect(() => {
    const html = document.documentElement;
    const prefersDark = window.matchMedia?.(
      "(prefers-color-scheme: dark)"
    )?.matches;
    if (prefersDark) html.classList.add("dark");
  }, []);

  return <ProtectedAdminRoutes />;
}
