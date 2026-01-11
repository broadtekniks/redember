import React, { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";
import { useCart } from "../cart/CartContext";

interface HeaderState {
  cartCount: number;
  onCheckout: (() => void) | null;
  checkoutDisabled: boolean;
}

export interface LayoutOutletContext {
  setHeaderState: React.Dispatch<React.SetStateAction<HeaderState>>;
  setTopBar: React.Dispatch<React.SetStateAction<React.ReactNode>>;
}

export default function Layout() {
  const location = useLocation();
  const cart = useCart();

  const [headerState, setHeaderState] = useState<HeaderState>({
    cartCount: 0,
    onCheckout: null,
    checkoutDisabled: true,
  });

  const [topBar, setTopBar] = useState<React.ReactNode>(null);

  // Initialize theme once.
  useEffect(() => {
    const html = document.documentElement;
    const prefersDark = window.matchMedia?.(
      "(prefers-color-scheme: dark)"
    )?.matches;
    if (prefersDark) html.classList.add("dark");
  }, []);

  const onToggleTheme = useMemo(() => {
    return () => {
      document.documentElement.classList.toggle("dark");
    };
  }, []);

  // Reset header state on route changes (pages can override via outlet context).
  useEffect(() => {
    setHeaderState({ cartCount: 0, onCheckout: null, checkoutDisabled: true });
    setTopBar(null);
  }, [location.pathname]);

  const outletContext: LayoutOutletContext = {
    setHeaderState,
    setTopBar,
  };

  return (
    <div className="bg-background-light dark:bg-background-dark text-stone-800 dark:text-stone-200 font-sans transition-colors duration-300 min-h-screen">
      {topBar}
      <Header
        cartCount={cart.getTotalQuantity()}
        onCheckout={headerState.onCheckout}
        checkoutDisabled={headerState.checkoutDisabled}
        onToggleTheme={onToggleTheme}
      />
      <Outlet context={outletContext} />
      <Footer />
    </div>
  );
}
