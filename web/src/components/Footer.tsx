import { Link } from "react-router-dom";
import Brand from "./Brand";

export default function Footer() {
  return (
    <footer
      className="bg-white dark:bg-stone-950 border-t border-stone-200 dark:border-stone-800 pt-20 pb-10"
      id="contact"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="col-span-1 md:col-span-1">
            <Link
              to="/"
              className="flex items-center gap-2 mb-6"
              aria-label="Home"
            >
              <Brand size="sm" />
              <span className="font-display text-xl tracking-tight">
                RED EMBER
              </span>
            </Link>
            <p className="text-stone-500 text-sm mb-6 leading-relaxed">
              Small batch spice handcrafted with passion. Bringing the heat from
              our kitchen to yours.
            </p>
          </div>

          <div>
            <h4 className="font-bold mb-6 text-stone-900 dark:text-stone-100">
              Quick Links
            </h4>
            <ul className="space-y-4 text-sm text-stone-500">
              <li>
                <a
                  className="hover:text-primary transition-colors"
                  href="/#shop"
                >
                  Shop
                </a>
              </li>
              <li>
                <a
                  className="hover:text-primary transition-colors"
                  href="/#story"
                >
                  Our Story
                </a>
              </li>
              <li>
                <a
                  className="hover:text-primary transition-colors"
                  href="/#recipes"
                >
                  Recipes
                </a>
              </li>
              <li>
                <Link
                  className="hover:text-primary transition-colors"
                  to="/admin"
                >
                  Admin
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-6 text-stone-900 dark:text-stone-100">
              Customer Support
            </h4>
            <ul className="space-y-4 text-sm text-stone-500">
              <li>
                <span className="text-stone-500">Shipping: US only</span>
              </li>
              <li>
                <span className="text-stone-500">
                  Phone + address collected in Checkout
                </span>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-6 text-stone-900 dark:text-stone-100">
              Wholesale
            </h4>
            <p className="text-sm text-stone-500 mb-4">
              Email us for wholesale inquiries.
            </p>
            <div className="text-sm text-stone-600 dark:text-stone-400">
              wholesale@example.com
            </div>
          </div>
        </div>

        <div className="border-t border-stone-200 dark:border-stone-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-stone-500 uppercase tracking-widest">
          <p>© {new Date().getFullYear()} Red Ember. All rights reserved.</p>
          <div className="flex gap-8">
            <a
              href="https://example.com/privacy"
              className="hover:text-primary transition-colors"
            >
              Privacy
            </a>
            <a
              href="https://example.com/terms"
              className="hover:text-primary transition-colors"
            >
              Terms
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
