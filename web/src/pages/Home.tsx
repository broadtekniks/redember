import { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { getProduct } from "../lib/api";
import { Product } from "../types";
import { LayoutOutletContext } from "../components/Layout";

interface FeaturedItem {
  key: string;
  title: string;
  subtitle: string;
  price: string;
  tag?: string;
  heat: number;
  heatClass?: string;
  image: string;
  cta: string;
  onClick?: () => void;
  disabled: boolean;
  note?: string;
}

export default function Home() {
  const { setHeaderState } = useOutletContext<LayoutOutletContext>();
  const navigate = useNavigate();

  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string>("");

  const outOfStock = product?.stock === 0;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await getProduct();
        if (!cancelled) setProduct(p);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  function onViewProduct(): void {
    if (!product) return;
    setError("");
    navigate(`/product/${product.id}`);
  }

  useEffect(() => {
    setHeaderState({
      cartCount: 0,
      onCheckout: onViewProduct,
      checkoutDisabled: !product || outOfStock,
    });
  }, [setHeaderState, product, outOfStock, navigate]);

  const featured = useMemo<FeaturedItem[]>(() => {
    const price = product
      ? `$${(product.priceCents / 100).toFixed(2)}`
      : "$18.00";

    return [
      {
        key: "signature",
        title: product?.name || "Original Red Ember",
        subtitle: "Our signature balanced blend.",
        price,
        tag: "BEST SELLER",
        heat: 3,
        image:
          "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&q=80&w=1400",
        cta: "ADD TO CART",
        onClick: onViewProduct,
        disabled: !product || outOfStock,
      },
    ];
  }, [product, outOfStock]);

  return (
    <div>
      <section className="relative h-[85vh] flex items-center overflow-hidden">
        <div className="absolute inset-0 hero-gradient" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
          <div className="max-w-2xl text-white">
            <div className="mb-6 inline-flex items-center gap-2 bg-primary/20 backdrop-blur-md border border-primary/30 px-4 py-1.5 rounded-full">
              <span className="material-symbols-outlined text-primary text-sm">
                local_fire_department
              </span>
              <span className="text-sm font-semibold tracking-wider uppercase">
                New: Smoked Habanero Batch
              </span>
            </div>
            <h1 className="text-6xl md:text-7xl font-display mb-6 leading-tight">
              Where heat meets{" "}
              <span className="text-primary italic">flavor</span>.
            </h1>
            <p className="text-lg md:text-xl text-stone-200 mb-10 leading-relaxed max-w-lg">
              Premium, small-batch chili oil crafted with cold-pressed oils and
              slow-roasted peppers. Elevate every meal with the perfect balance
              of sizzle and spice.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a
                className="bg-primary hover:bg-red-700 text-white px-10 py-4 rounded font-bold text-center transition-all transform hover:scale-105 shadow-xl"
                href="#shop"
              >
                Shop Now
              </a>
              <a
                className="bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/30 text-white px-10 py-4 rounded font-bold text-center transition-all"
                href="#story"
              >
                Learn More
              </a>
            </div>

            {error && (
              <div className="mt-6 bg-black/40 border border-white/20 rounded-lg px-4 py-3">
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}
          </div>
        </div>

        <div className="hidden lg:block absolute right-0 top-1/2 -translate-y-1/2 w-1/2 h-full pointer-events-none">
          <img
            alt="Red Ember Chili Oil Bottle"
            className="w-full h-full object-contain drop-shadow-2xl translate-x-12"
            src="https://images.unsplash.com/photo-1604909053196-3f1f510c2c5c?auto=format&fit=crop&q=80&w=1200"
          />
        </div>
      </section>

      <section className="py-24 bg-stone-50 dark:bg-stone-900/50" id="story">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div className="relative">
              <div className="aspect-square rounded-2xl overflow-hidden shadow-2xl">
                <img
                  alt="Artisanal spice preparation"
                  className="w-full h-full object-cover"
                  src="https://images.unsplash.com/photo-1546549032-9571cd6b27df?auto=format&fit=crop&q=80&w=1200"
                />
              </div>
              <div className="absolute -bottom-6 -right-6 bg-primary p-8 rounded-2xl shadow-xl hidden lg:block">
                <div className="w-32 text-white font-display text-2xl tracking-tight">
                  RED EMBER
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-4xl font-display mb-6 leading-tight">
                The Art of the Ember
              </h2>
              <p className="text-lg text-stone-600 dark:text-stone-400 mb-6 leading-relaxed">
                Red Ember wasn't born in a factory—it was born in a kitchen
                fueled by a search for the perfect condiment.
              </p>
              <p className="text-lg text-stone-600 dark:text-stone-400 mb-8 leading-relaxed">
                We slow-infuse our blend of roasted aromatics and premium
                chilies for deep flavor in every drop.
              </p>
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <div className="flex items-center gap-2 text-primary mb-2">
                    <span className="material-symbols-outlined">eco</span>
                    <span className="font-bold">Natural Ingredients</span>
                  </div>
                  <p className="text-sm text-stone-500">
                    No preservatives. Just pure heat.
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-accent-orange mb-2">
                    <span className="material-symbols-outlined">
                      local_fire_department
                    </span>
                    <span className="font-bold">Small Batch</span>
                  </div>
                  <p className="text-sm text-stone-500">
                    Hand-poured in small runs to ensure consistency.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24" id="shop">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
            <div>
              <h2 className="text-4xl font-display mb-4">
                Featured Collections
              </h2>
              <p className="text-stone-600 dark:text-stone-400 max-w-xl">
                Find the perfect level of intensity for your kitchen. From mild
                aromatics to soul-warming heat.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="bg-stone-200 dark:bg-stone-800 p-3 rounded-full hover:bg-stone-300 dark:hover:bg-stone-700 transition-colors"
                aria-label="Previous"
                disabled
              >
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <button
                type="button"
                className="bg-primary text-white p-3 rounded-full hover:bg-red-700 transition-colors"
                aria-label="Next"
                disabled
              >
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {featured.map((p) => (
              <div key={p.key} className="group">
                <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-stone-100 dark:bg-stone-800 mb-4">
                  <img
                    alt={p.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    src={p.image}
                  />
                  {p.tag && (
                    <span className="absolute top-4 left-4 bg-primary text-white text-xs font-bold px-3 py-1 rounded-full">
                      {p.tag}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={p.onClick}
                    disabled={p.disabled}
                    className="absolute bottom-4 left-4 right-4 bg-white/90 dark:bg-stone-900/90 py-3 rounded font-bold text-sm opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {p.cta}
                  </button>
                </div>
                <h3 className="font-display text-xl mb-1">{p.title}</h3>
                <p className="text-stone-500 dark:text-stone-400 text-sm mb-2">
                  {p.subtitle}
                </p>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-lg">{p.price}</span>
                  {p.heat > 0 ? (
                    <div
                      className={`flex ${p.heatClass || "text-accent-orange"}`}
                    >
                      {Array.from({ length: p.heat }).map((_, idx) => (
                        // eslint-disable-next-line react/no-array-index-key
                        <span
                          key={idx}
                          className="material-symbols-outlined text-sm"
                        >
                          local_fire_department
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-stone-500 font-medium italic">
                      {p.note || ""}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        className="py-24 bg-background-dark text-white overflow-hidden relative"
        id="recipes"
      >
        <div className="absolute top-0 right-0 w-1/3 h-full opacity-10 pointer-events-none">
          <img
            alt="Logo pattern"
            className="w-full h-full object-contain scale-150 rotate-12"
            src="https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&q=80&w=1400"
          />
        </div>

        <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
          <div className="flex justify-center mb-8">
            <span className="material-symbols-outlined text-primary text-5xl">
              format_quote
            </span>
          </div>
          <p className="text-2xl md:text-4xl font-display mb-10 italic leading-relaxed">
            "Literally changed my cooking game. I put it on eggs, pizza, and
            even vanilla ice cream once. Don't judge — it's that good."
          </p>
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full overflow-hidden mb-4 border-2 border-primary">
              <img
                alt="Customer Profile"
                className="w-full h-full object-cover"
                src="https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&q=80&w=256"
              />
            </div>
            <p className="font-bold">Sarah Jenkins</p>
            <p className="text-stone-500 text-sm uppercase tracking-widest">
              Food Blogger &amp; Spice Enthusiast
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
