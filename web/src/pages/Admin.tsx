import { Navigate } from "react-router-dom";

// This page is no longer used - admin routes are protected via AdminLayout
// Redirect to admin dashboard instead
export default function Admin() {
  return <Navigate to="/admin" replace />;
}
