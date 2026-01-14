import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, readJsonOrText } from "../lib/api";
import type { AdminAuthContextType, AdminUser } from "../types";

const AdminAuthContext = createContext<AdminAuthContextType | null>(null);

interface AdminAuthProviderProps {
  children: ReactNode;
}

export function AdminAuthProvider({ children }: AdminAuthProviderProps) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Check if user is authenticated on mount
  useEffect(() => {
    const checkAuth = async (): Promise<void> => {
      try {
        const response = await api("/api/auth/me");
        const payload = await readJsonOrText(response);
        if (!response.ok) {
          console.warn("Auth check response not OK", payload);
          setUser(null);
          return;
        }

        setUser(payload?.user ?? null);
      } catch (error) {
        console.error("Auth check failed:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    try {
      const response = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      const payload = await readJsonOrText(response);
      if (!response.ok) {
        const message =
          payload?.error ??
          payload?.message ??
          payload?.text ??
          "Unable to reach the admin server. Please try again later.";
        throw new Error(message);
      }

      setUser(payload?.user ?? null);
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error(
          "Unable to connect to the backend. Ensure the server is running and try again."
        );
      }
      throw error;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setUser(null);
    }
  };

  const value = useMemo<AdminAuthContextType>(
    () => ({
      user,
      isAuthed: !!user,
      loading,
      login,
      logout,
    }),
    [user, loading]
  );

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthContextType {
  const ctx = useContext(AdminAuthContext);
  if (!ctx)
    throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
