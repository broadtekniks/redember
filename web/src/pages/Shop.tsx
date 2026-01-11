import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { getProducts } from "../lib/api";
import type { Product } from "../types";
import type { LayoutOutletContext } from "../components/Layout";

interface ImagesById {
  [key: string]: string;
}

interface RealProductDisplay {
  key: string;
  type: "real";
  id: string;
  title: string;
  price: string;
  subtitle: string;
  tag: string | null;
  image: string;
  outOfStock: boolean;
  stock: number;
  disabled?: boolean;
}

interface PlaceholderProductDisplay {
  key: string;
  type: "placeholder";
  title: string;
  price: string;
  subtitle: string;
  tag?: string;
  tagRight?: string;
  image: string;
  outOfStock?: boolean;
  disabled?: boolean;
}

type ProductDisplay = RealProductDisplay | PlaceholderProductDisplay;

export default function Shop() {
  const { setHeaderState, setTopBar } = useOutletContext<LayoutOutletContext>();
  const navigate = useNavigate();
  const [dbProducts, setDbProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async (): Promise<void> => {
      try {
        const list = await getProducts();
        if (!cancelled) setDbProducts(Array.isArray(list) ? list : []);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();

    return (): void => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setHeaderState({
      cartCount: 0,
      onCheckout: null,
      checkoutDisabled: true,
    });
  }, [setHeaderState]);

  useEffect(() => {
    if (!setTopBar) return;
    setTopBar(
      <div className="bg-primary text-white text-center py-2 text-sm font-medium tracking-wide">
        FREE SHIPPING ON ORDERS OVER $50 • HAND-CRAFTED IN SMALL BATCHES
      </div>
    );
    return (): void => setTopBar(null);
  }, [setTopBar]);

  const products = useMemo((): ProductDisplay[] => {
    const imagesById: ImagesById = {
      "red-ember-spice":
        "https://images.unsplash.com/photo-1604909053196-3f1f510c2c5c?auto=format&fit=crop&q=80&w=1400",
      "smoked-ghost":
        "https://images.unsplash.com/photo-1626808642875-0aa545482dfb?auto=format&fit=crop&q=80&w=1400",
      "honey-habanero":
        "https://images.unsplash.com/photo-1600628422019-6c1b0b2f7b1c?auto=format&fit=crop&q=80&w=1400",
      "sichuan-gold":
        "https://images.unsplash.com/photo-1615485737657-9f5f0a2d9b0a?auto=format&fit=crop&q=80&w=1400",
    };

    const realProducts: RealProductDisplay[] = dbProducts.map((p) => {
      const price = `$${(p.priceCents / 100).toFixed(2)}`;
      const outOfStock = p.stock === 0;
      return {
        key: p.id,
        type: "real" as const,
        id: p.id,
        title: p.name,
        price,
        subtitle: outOfStock
          ? "Currently unavailable"
          : "Hand-crafted heat with bold aromatics",
        tag: p.id === "red-ember-spice" ? "Best Seller" : null,
        image:
          p.imageUrl ||
          imagesById[p.id] ||
          "https://images.unsplash.com/photo-1546549032-9571cd6b27df?auto=format&fit=crop&q=80&w=1400",
        outOfStock,
        stock: p.stock,
      };
    });

    const placeholders: PlaceholderProductDisplay[] = [
      {
        key: "ghost",
        title: "Smoked Ghost Pepper",
        price: "$24.00",
        subtitle: "Intense heat with smoke undertones",
        tagRight: "Hot",
        image:
          "https://images.unsplash.com/photo-1626808642875-0aa545482dfb?auto=format&fit=crop&q=80&w=1400",
      },
      {
        key: "honey",
        title: "Honey Habanero",
        price: "$20.00",
        subtitle: "Sweet heat for pizza & ribs",
        image:
          "https://images.unsplash.com/photo-1600628422019-6c1b0b2f7b1c?auto=format&fit=crop&q=80&w=1400",
      },
      {
        key: "sichuan",
        title: "Sichuan Peppercorn Gold",
        price: "$22.00",
        subtitle: "Floral notes with a numbing tingle",
        image:
          "https://images.unsplash.com/photo-1615485737657-9f5f0a2d9b0a?auto=format&fit=crop&q=80&w=1400",
      },
      {
        key: "discovery",
        title: "The Discovery Pack",
        price: "$45.00",
        subtitle: "3 x mini bottles of best sellers",
        tag: "Gift Set",
        image:
          "https://images.unsplash.com/photo-1546549032-9571cd6b27df?auto=format&fit=crop&q=80&w=1400",
      },
      {
        key: "pro",
        title: "Kitchen Pro Jug",
        price: "$120.00",
        subtitle: "1 Gallon for professionals",
        outOfStock: true,
        image:
          "https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&q=80&w=1400",
      },
    ].map((p) => ({ ...p, type: "placeholder" as const }));
    return realProducts.length > 0 ? realProducts : placeholders;
  }, [dbProducts]);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-12">
        <nav
          aria-label="Breadcrumb"
          className="flex mb-4 text-sm text-stone-500 dark:text-stone-400"
        >
          <ol className="flex items-center space-x-2">
            <li>
              <Link className="hover:underline" to="/">
                Home
              </Link>
            </li>
            <li>
              <span className="material-symbols-outlined text-[14px]">
                chevron_right
              </span>
            </li>
            <li>
              <span className="text-stone-900 dark:text-stone-200 font-medium">
                Shop All Spicy Oils
              </span>
            </li>
          </ol>
        </nav>

        <h1 className="font-display text-4xl md:text-5xl font-bold text-stone-900 dark:text-white mb-4">
          Shop All Spicy Oils
        </h1>
        <p className="text-stone-600 dark:text-stone-400 max-w-2xl leading-relaxed">
          Elevate your kitchen with our hand-crafted infusions. From subtle
          warmth to blistering heat, find the perfect Red Ember balance for your
          next meal.
        </p>

        {error && (
          <div className="mt-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-lg px-4 py-3">
            <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-12">
        <aside className="w-full lg:w-64 flex-shrink-0">
          <div className="sticky top-32 space-y-10">
            <div>
              <h3 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">
                  local_fire_department
                </span>
                Heat Level
              </h3>
              <div className="space-y-3">
                {[
                  "Mild & Savory",
                  "Medium Heat",
                  "Extra Spicy",
                  "Ember Ghost (Extreme)",
                ].map((label, idx) => (
                  <label
                    // eslint-disable-next-line react/no-array-index-key
                    key={idx}
                    className="flex items-center group cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      className="rounded border-stone-300 text-primary focus:ring-primary dark:bg-stone-800 dark:border-stone-700"
                      defaultChecked={label === "Extra Spicy"}
                    />
                    <span className="ml-3 text-stone-600 dark:text-stone-400 group-hover:text-primary transition-colors">
                      {label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-stone-500">
                  straighten
                </span>
                Bottle Size
              </h3>
              <div className="space-y-3">
                {["50ml Mini", "175ml Standard", "500ml Kitchen Pro"].map(
                  (label) => (
                    <label
                      key={label}
                      className="flex items-center group cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        className="rounded border-stone-300 text-primary focus:ring-primary dark:bg-stone-800 dark:border-stone-700"
                      />
                      <span className="ml-3 text-stone-600 dark:text-stone-400 group-hover:text-primary transition-colors">
                        {label}
                      </span>
                    </label>
                  )
                )}
              </div>
            </div>

            <div>
              <h3 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-stone-500">
                  payments
                </span>
                Price Range
              </h3>
              <input
                className="w-full h-1 bg-stone-200 rounded-lg appearance-none cursor-pointer dark:bg-stone-700 accent-primary"
                type="range"
                min="10"
                max="100"
                defaultValue="50"
              />
              <div className="flex justify-between mt-2 text-xs text-stone-500">
                <span>$10</span>
                <span>$100</span>
              </div>
            </div>

            <button
              type="button"
              className="w-full py-3 bg-stone-900 dark:bg-stone-700 text-white rounded font-medium hover:bg-stone-800 dark:hover:bg-stone-600 transition-colors uppercase tracking-widest text-xs"
            >
              Clear All
            </button>
          </div>
        </aside>

        <div className="flex-1">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Showing {products.length} results
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-stone-500 dark:text-stone-400">
                  Sort by:
                </span>
                <select className="bg-transparent border border-stone-200 dark:border-stone-800 rounded-md px-2 py-1 text-sm font-semibold focus:ring-2 focus:ring-primary cursor-pointer text-stone-900 dark:text-white">
                  <option>Featured</option>
                  <option>Newest</option>
                  <option>Price: Low to High</option>
                  <option>Price: High to Low</option>
                </select>
              </div>

              <div className="text-sm text-stone-500 dark:text-stone-400">
                Click a product to view details and order.
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-12">
            {products.map((p) => {
              const isReal = p.type === "real";
              const isDisabled = Boolean(p.disabled) || Boolean(p.outOfStock);
              return (
                <div
                  key={p.key}
                  className={`group relative ${
                    isReal && !isDisabled ? "cursor-pointer" : ""
                  }`}
                  onClick={(): void => {
                    if (isReal && !isDisabled) navigate(`/product/${p.id}`);
                  }}
                  onKeyDown={(e): void => {
                    if (e.key === "Enter" && isReal && !isDisabled) {
                      navigate(`/product/${(p as RealProductDisplay).id}`);
                    }
                  }}
                  role={isReal && !isDisabled ? "button" : undefined}
                  tabIndex={isReal && !isDisabled ? 0 : undefined}
                >
                  <div className="relative overflow-hidden aspect-[4/5] bg-stone-100 dark:bg-stone-900 rounded-xl mb-4">
                    <img
                      alt={p.title}
                      className={`w-full h-full object-cover transition-transform duration-700 ${
                        isDisabled ? "opacity-60" : "group-hover:scale-105"
                      }`}
                      src={p.image}
                    />

                    {p.tag && (
                      <span className="absolute top-4 left-4 bg-primary text-white text-[10px] font-bold px-2 py-1 uppercase tracking-widest rounded">
                        {p.tag}
                      </span>
                    )}

                    {p.type === "placeholder" && p.tagRight && (
                      <span className="absolute top-4 right-4 bg-stone-900 text-white text-[10px] font-bold px-2 py-1 uppercase tracking-widest rounded">
                        {p.tagRight}
                      </span>
                    )}

                    {p.outOfStock && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="bg-white/90 dark:bg-stone-800/90 text-stone-900 dark:text-white px-6 py-2 rounded-full font-bold uppercase tracking-widest text-xs">
                          Out of Stock
                        </span>
                      </span>
                    )}

                    <div className="absolute inset-x-0 bottom-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                      {isReal ? (
                        <button
                          type="button"
                          onClick={(e): void => {
                            e.stopPropagation();
                            if (!isDisabled)
                              navigate(
                                `/product/${(p as RealProductDisplay).id}`
                              );
                          }}
                          disabled={isDisabled}
                          className="w-full bg-white dark:bg-stone-800 text-stone-900 dark:text-white py-3 rounded-lg shadow-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary hover:text-white transition-all disabled:opacity-60"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            storefront
                          </span>
                          VIEW &amp; ORDER
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="w-full bg-white/70 dark:bg-stone-800/60 text-stone-500 dark:text-stone-300 py-3 rounded-lg shadow-xl font-bold text-sm flex items-center justify-center gap-2 opacity-80 cursor-not-allowed"
                        >
                          COMING SOON
                        </button>
                      )}
                    </div>
                  </div>

                  <div
                    className={`space-y-1 ${
                      isDisabled && !isReal ? "opacity-80" : ""
                    }`}
                  >
                    <div className="flex justify-between items-start gap-4">
                      <h3 className="font-display text-xl font-bold group-hover:text-primary transition-colors">
                        {p.title}
                      </h3>
                      <span className="font-medium text-stone-900 dark:text-white">
                        {p.price}
                      </span>
                    </div>
                    <p className="text-sm text-stone-500 dark:text-stone-400">
                      {p.subtitle}
                    </p>

                    {isReal && (
                      <div className="pt-3 flex items-center justify-between gap-3">
                        <div className="flex gap-1 text-primary">
                          <span className="material-symbols-outlined text-[16px]">
                            local_fire_department
                          </span>
                          <span className="material-symbols-outlined text-[16px]">
                            local_fire_department
                          </span>
                          <span className="material-symbols-outlined text-[16px]">
                            local_fire_department
                          </span>
                        </div>
                        <div className="text-xs text-stone-500 dark:text-stone-400">
                          {p.outOfStock
                            ? "Out of stock"
                            : `${(p as RealProductDisplay).stock} left`}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-16 flex items-center justify-center space-x-2">
            <button
              type="button"
              className="w-10 h-10 flex items-center justify-center rounded-full border border-stone-200 dark:border-stone-800 text-stone-400 hover:border-primary hover:text-primary transition-colors"
              aria-label="Previous"
              disabled
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <button
              type="button"
              className="w-10 h-10 flex items-center justify-center rounded-full bg-primary text-white font-bold"
              aria-label="Page 1"
            >
              1
            </button>
            <button
              type="button"
              className="w-10 h-10 flex items-center justify-center rounded-full border border-stone-200 dark:border-stone-800 text-stone-400 hover:border-primary hover:text-primary transition-colors"
              aria-label="Next"
              disabled
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
