import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CartItem, CartContextType } from "../types";

const LS_KEY = "redember_cart_v1";

function readCartFromStorage(): CartItem[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((i) => i && typeof i.productId === "string")
      .map((i) => ({
        productId: i.productId,
        quantity: Math.max(1, Math.min(10, Number(i.quantity) || 1)),
      }));
  } catch {
    return [];
  }
}

function writeCartToStorage(items: CartItem[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

const CartContext = createContext<CartContextType | null>(null);

interface CartProviderProps {
  children: ReactNode;
}

export function CartProvider({ children }: CartProviderProps) {
  const [items, setItems] = useState<CartItem[]>(() => readCartFromStorage());

  useEffect(() => {
    writeCartToStorage(items);
  }, [items]);

  const addToCart = useCallback(
    (productId: string, quantity: number = 1): void => {
      const qty = Math.max(1, Math.min(10, Number(quantity) || 1));
      setItems((prev) => {
        const idx = prev.findIndex((p) => p.productId === productId);
        if (idx === -1) return [...prev, { productId, quantity: qty }];

        const next = [...prev];
        next[idx] = {
          productId,
          quantity: Math.max(1, Math.min(10, next[idx].quantity + qty)),
        };
        return next;
      });
    },
    []
  );

  const updateQuantity = useCallback(
    (productId: string, quantity: number): void => {
      const qty = Math.max(1, Math.min(10, Number(quantity) || 1));
      setItems((prev) =>
        prev.map((p) =>
          p.productId === productId ? { ...p, quantity: qty } : p
        )
      );
    },
    []
  );

  const removeFromCart = useCallback((productId: string): void => {
    setItems((prev) => prev.filter((p) => p.productId !== productId));
  }, []);

  const clearCart = useCallback((): void => {
    setItems([]);
  }, []);

  const getTotalQuantity = useCallback((): number => {
    return items.reduce((sum, i) => sum + (i.quantity || 0), 0);
  }, [items]);

  const value = useMemo<CartContextType>(
    () => ({
      items,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      getTotalQuantity,
    }),
    [
      items,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      getTotalQuantity,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextType {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
