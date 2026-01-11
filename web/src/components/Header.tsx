import { Link } from "react-router-dom";
import Brand from "./Brand";

interface HeaderProps {
  cartCount: number;
  onCheckout: (() => void) | null;
  checkoutDisabled: boolean;
  onToggleTheme: () => void;
}

export default function Header({
  cartCount,
  onCheckout,
  checkoutDisabled,
  onToggleTheme,
}: HeaderProps) {
  return (
    <nav className="sticky top-0 z-50 w-full bg-white/80 dark:bg-background-dark/80 backdrop-blur-md border-b border-stone-200 dark:border-stone-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <Link to="/" className="flex items-center gap-2">
            <Brand size="lg" />
            <span className="font-display text-2xl tracking-tight hidden sm:block">
              RED EMBER
            </span>
          </Link>

          <div className="hidden md:flex space-x-8 font-medium">
            <Link className="hover:text-primary transition-colors" to="/shop">
              Shop
            </Link>
            <a className="hover:text-primary transition-colors" href="/#story">
              Our Story
            </a>
            <a
              className="hover:text-primary transition-colors"
              href="/#recipes"
            >
              Recipes
            </a>
            <a
              className="hover:text-primary transition-colors"
              href="/#contact"
            >
              Wholesale
            </a>
          </div>

          <div className="flex items-center space-x-5">
            <button
              type="button"
              className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors"
              aria-label="Search"
            >
              <span className="material-symbols-outlined">search</span>
            </button>

            <Link
              to="/cart"
              className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors relative"
              aria-label="Shopping cart"
              title="Shopping cart"
              onClick={(e) => {
                // Preserve backwards compatibility if any page still sets a checkout handler.
                if (onCheckout && !checkoutDisabled) {
                  e.preventDefault();
                  onCheckout();
                }
              }}
            >
              <span className="material-symbols-outlined">shopping_bag</span>
              {Number.isInteger(cartCount) && cartCount > 0 && (
                <span className="absolute top-1 right-1 bg-primary text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </Link>

            <button
              type="button"
              className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors"
              onClick={onToggleTheme}
              aria-label="Toggle theme"
            >
              <span className="material-symbols-outlined dark:hidden">
                dark_mode
              </span>
              <span className="material-symbols-outlined hidden dark:block">
                light_mode
              </span>
            </button>

            <Link
              to="/admin/login"
              className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-800 hover:border-primary hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">
                login
              </span>
              <span className="text-sm font-semibold">Login</span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
