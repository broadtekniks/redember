import { Navigate, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Shop from "./pages/Shop";
import Product from "./pages/Product";
import Cart from "./pages/Cart";
import Success from "./pages/Success";
import Cancel from "./pages/Cancel";
import NotFound from "./pages/NotFound";
import Layout from "./components/Layout";
import AdminInventory from "./pages/AdminInventory";
import AdminLayout from "./components/AdminLayout";
import AdminDashboard from "./pages/AdminDashboard";
import AdminLogin from "./pages/AdminLogin";
import AdminOrders from "./pages/AdminOrders";
import AdminCustomers from "./pages/AdminCustomers";
import AdminShipping from "./pages/AdminShipping";
import AdminCreateOrder from "./pages/AdminCreateOrder";
import AdminUsers from "./pages/AdminUsers";
import AdminSettings from "./pages/AdminSettings";
import AdminProductCategories from "./pages/AdminProductCategories";
import AdminMediaGallery from "./pages/AdminMediaGallery";
import { AdminAuthProvider } from "./context/AdminAuthContext";

function AdminRoutes() {
  return (
    <AdminAuthProvider>
      <Routes>
        <Route path="/login" element={<AdminLogin />} />
        <Route element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="orders/new" element={<AdminCreateOrder />} />
          <Route path="customers" element={<AdminCustomers />} />
          <Route path="inventory" element={<AdminInventory />} />
          <Route path="categories" element={<AdminProductCategories />} />
          <Route path="shipping" element={<AdminShipping />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="media" element={<AdminMediaGallery />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
      </Routes>
    </AdminAuthProvider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/admin/*" element={<AdminRoutes />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/cart" element={<Cart />} />
        <Route
          path="/product"
          element={<Navigate to="/product/red-ember-spice" replace />}
        />
        <Route path="/product/:id" element={<Product />} />
        <Route path="/success" element={<Success />} />
        <Route path="/cancel" element={<Cancel />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
