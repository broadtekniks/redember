import { useEffect, useMemo, useState } from "react";
import {
  Link,
  useNavigate,
  useOutletContext,
  useParams,
} from "react-router-dom";
import { useCart } from "../cart/CartContext";
import { getProductById, getProducts } from "../lib/api";
import { LayoutOutletContext } from "../components/Layout";
import { Product as ProductType } from "../types";

const FALLBACK_IMAGES: Record<string, string> = {
  "red-ember-spice":
    "https://images.unsplash.com/photo-1604909053196-3f1f510c2c5c?auto=format&fit=crop&q=80&w=1400",
  "smoked-ghost":
    "https://images.unsplash.com/photo-1626808642875-0aa545482dfb?auto=format&fit=crop&q=80&w=1400",
  "honey-habanero":
    "https://images.unsplash.com/photo-1600628422019-6c1b0b2f7b1c?auto=format&fit=crop&q=80&w=1400",
  "sichuan-gold":
    "https://images.unsplash.com/photo-1615485737657-9f5f0a2d9b0a?auto=format&fit=crop&q=80&w=1400",
};

interface HeatLevelProps {
  value?: number;
  max?: number;
}

function HeatLevel({ value = 3, max = 5 }: HeatLevelProps) {
  const filled = Math.max(0, Math.min(max, value));
  const empty = Math.max(0, max - filled);

  return (
    <div className="flex items-center">
      {Array.from({ length: filled }).map((_, idx) => (
        // eslint-disable-next-line react/no-array-index-key
        <span
          key={`f-${idx}`}
          className="material-symbols-outlined text-primary text-[18px]"
        >
          local_fire_department
        </span>
      ))}
      {Array.from({ length: empty }).map((_, idx) => (
        // eslint-disable-next-line react/no-array-index-key
        <span
          key={`e-${idx}`}
          className="material-symbols-outlined text-stone-300 dark:text-stone-600 text-[18px]"
        >
          local_fire_department
        </span>
      ))}
    </div>
  );
}

export default function Product() {
  const { setHeaderState } = useOutletContext<LayoutOutletContext>();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const cart = useCart();

  const [product, setProduct] = useState<ProductType | null>(null);
  const [variants, setVariants] = useState<ProductType[]>([]);
  const [variantsLoading, setVariantsLoading] = useState<boolean>(false);
  const [quantity, setQuantity] = useState<number>(1);
  const [error, setError] = useState<string>("");

  const outOfStock = product?.stock === 0;
  const maxQty = useMemo(() => {
    if (!product) return 10;
    return Math.max(1, Math.min(10, product.stock || 1));
  }, [product]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) {
        if (!cancelled) {
          setError("Product not found");
          setProduct(null);
        }
        return;
      }
      try {
        setError("");
        setProduct(null);
        setVariants([]);
        const p = await getProductById(id);
        if (!cancelled) {
          setProduct(p);
          setQuantity(1);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!product?.groupId) {
        setVariants([]);
        return;
      }

      try {
        setVariantsLoading(true);
        const list = await getProducts();
        if (cancelled) return;

        const sameGroup = (Array.isArray(list) ? list : [])
          .filter((p) => p && p.groupId === product.groupId)
          .sort((a, b) => {
            const av = (a.variantName || a.sku || "").toString();
            const bv = (b.variantName || b.sku || "").toString();
            return av.localeCompare(bv);
          });
        setVariants(sameGroup);
      } catch {
        if (!cancelled) setVariants([]);
      } finally {
        if (!cancelled) setVariantsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [product?.groupId]);

  function onAddToCart(): void {
    if (!product) return;
    setError("");
    cart.addToCart(product.id, quantity);
    navigate("/cart");
  }

  useEffect(() => {
    setHeaderState({
      cartCount: 0,
      onCheckout: null,
      checkoutDisabled: true,
    });
  }, [setHeaderState]);

  const price = product
    ? `$${(product.priceCents / 100).toFixed(2)}`
    : "$22.00";

  const heroImage =
    product?.imageUrl ||
    FALLBACK_IMAGES[id || ""] ||
    "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&q=80&w=1600";

  return (
    <main className="max-w-7xl mx-auto px-4 py-8 lg:py-16">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 mb-24">
        <div className="space-y-4">
          <div className="aspect-[4/5] bg-stone-100 dark:bg-stone-900 overflow-hidden rounded-lg group border border-stone-200 dark:border-stone-800">
            <img
              alt={product?.name || "Signature Red Ember product"}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              src={heroImage}
            />
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="aspect-square bg-stone-100 dark:bg-stone-900 rounded-md cursor-pointer border-2 border-primary overflow-hidden">
              <img
                alt="Thumbnail 1"
                className="w-full h-full object-cover"
                src={heroImage}
              />
            </div>
            <div className="aspect-square bg-stone-100 dark:bg-stone-900 rounded-md cursor-pointer opacity-70 hover:opacity-100 overflow-hidden">
              <img
                alt="Thumbnail 2"
                className="w-full h-full object-cover"
                src="https://images.unsplash.com/photo-1546549032-9571cd6b27df?auto=format&fit=crop&q=80&w=400"
              />
            </div>
            <div className="aspect-square bg-stone-100 dark:bg-stone-900 rounded-md cursor-pointer opacity-70 hover:opacity-100 overflow-hidden">
              <img
                alt="Thumbnail 3"
                className="w-full h-full object-cover"
                src="https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&q=80&w=400"
              />
            </div>
            <div className="aspect-square bg-stone-100 dark:bg-stone-900 rounded-md flex items-center justify-center cursor-pointer hover:bg-stone-200 dark:hover:bg-stone-800">
              <span className="material-symbols-outlined">play_circle</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col">
          <nav className="flex text-xs uppercase tracking-widest text-stone-500 dark:text-stone-400 mb-4">
            <Link className="hover:text-primary" to="/shop">
              Shop
            </Link>
            <span className="mx-2">/</span>
            <span>Chili Oils</span>
          </nav>

          <h1 className="text-4xl lg:text-5xl font-display font-bold mb-4">
            {product?.name || "Original Signature Chili Oil"}
          </h1>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-6">
            <HeatLevel value={3} max={5} />
            <span className="text-sm font-semibold text-primary uppercase tracking-tighter">
              Medium Heat (3/5)
            </span>
            <span className="text-stone-300 dark:text-stone-700">|</span>
            <span className="text-sm text-stone-500 dark:text-stone-400">
              48 Reviews
            </span>
          </div>

          <p className="text-2xl font-bold mb-2">{price}</p>
          <div className="text-sm text-stone-500 dark:text-stone-400 mb-8">
            {product
              ? outOfStock
                ? "Out of stock"
                : `${product.stock} in stock`
              : "Loading…"}
          </div>

          <div className="space-y-6 mb-8">
            <div>
              <h3 className="text-xs uppercase tracking-widest font-bold mb-3 text-stone-500">
                Flavor Profile
              </h3>
              <div className="flex flex-wrap gap-2">
                {[
                  "Smoky",
                  "Garlic-forward",
                  "Toasted Sesame",
                  "Umami Rich",
                ].map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-stone-100 dark:bg-stone-800 rounded-full text-xs font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <p className="text-stone-600 dark:text-stone-300 leading-relaxed">
              {product?.description ||
                "Hand-crafted in small batches using premium aromatics and our proprietary chili blend. Deep, smoky complexity that elevates any dish without overwhelming your palate."}
            </p>

            <div>
              <h3 className="text-xs uppercase tracking-widest font-bold mb-3 text-stone-500">
                Select Size
              </h3>
              <div className="flex flex-wrap gap-3">
                {variantsLoading && (
                  <span className="text-sm text-stone-500 dark:text-stone-400">
                    Loading sizes…
                  </span>
                )}

                {!variantsLoading &&
                  variants.length > 0 &&
                  variants.map((v) => {
                    const label = v.variantName || v.sku || v.id;
                    const isSelected = v.id === product?.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => navigate(`/product/${v.id}`)}
                        className={
                          isSelected
                            ? "px-6 py-2 border-2 border-primary bg-primary/5 text-primary font-semibold text-sm rounded transition-all"
                            : "px-6 py-2 border-2 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 font-semibold text-sm rounded hover:border-primary transition-all"
                        }
                      >
                        {label}
                      </button>
                    );
                  })}

                {!variantsLoading && variants.length === 0 && product && (
                  <button
                    type="button"
                    disabled
                    className="px-6 py-2 border-2 border-primary bg-primary/5 text-primary font-semibold text-sm rounded transition-all opacity-80 cursor-default"
                  >
                    {product.variantName || product.sku || "Default"}
                  </button>
                )}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-lg px-4 py-3">
                <p className="text-sm text-red-700 dark:text-red-200">
                  {error}
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-4 mt-auto">
            <div className="flex items-center border border-stone-300 dark:border-stone-700 rounded h-14">
              <button
                type="button"
                className="px-4 hover:text-primary disabled:opacity-50"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={!product || quantity <= 1}
                aria-label="Decrease quantity"
              >
                <span className="material-symbols-outlined text-[18px]">
                  remove
                </span>
              </button>
              <span className="px-4 font-bold">{quantity}</span>
              <button
                type="button"
                className="px-4 hover:text-primary disabled:opacity-50"
                onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                disabled={!product || quantity >= maxQty}
                aria-label="Increase quantity"
              >
                <span className="material-symbols-outlined text-[18px]">
                  add
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={onAddToCart}
              disabled={!product || outOfStock}
              className="flex-1 bg-primary text-white font-bold h-14 rounded hover:bg-red-700 transition-colors flex items-center justify-center space-x-2 disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[20px]">
                add_shopping_cart
              </span>
              <span>ADD TO CART</span>
            </button>
          </div>

          <div className="mt-8 flex items-center space-x-6 text-xs font-medium text-stone-500 dark:text-stone-400">
            <div className="flex items-center">
              <span className="material-symbols-outlined text-[18px] mr-1">
                check_circle
              </span>
              Vegan &amp; Gluten-Free
            </div>
            <div className="flex items-center">
              <span className="material-symbols-outlined text-[18px] mr-1">
                check_circle
              </span>
              All-Natural Ingredients
            </div>
          </div>
        </div>
      </div>

      <section className="mb-24 border-t border-stone-200 dark:border-stone-800 pt-16">
        <h2 className="text-3xl font-display font-bold mb-12 text-center">
          Perfect Pairings
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              title: "Drunken Noodles",
              img: "https://images.unsplash.com/photo-1617196034183-421b4917cfd1?auto=format&fit=crop&q=80&w=1200",
              text: "Drizzle generously over hot noodles for instant depth of umami.",
            },
            {
              title: "Neapolitan Pizza",
              img: "https://images.unsplash.com/photo-1548365328-9f5470ce64d7?auto=format&fit=crop&q=80&w=1200",
              text: "Smoky garlic notes complement wood-fired crusts and fresh mozzarella.",
            },
            {
              title: "Morning Eggs",
              img: "https://images.unsplash.com/photo-1551218808-94e220e084d2?auto=format&fit=crop&q=80&w=1200",
              text: "Add a spoonful to eggs or toast to kickstart your day with a savory punch.",
            },
          ].map((p) => (
            <div key={p.title} className="group">
              <div className="aspect-video overflow-hidden rounded mb-4 bg-stone-200 dark:bg-stone-800">
                <img
                  alt={p.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  src={p.img}
                />
              </div>
              <h3 className="text-xl font-display font-semibold mb-2 italic">
                {p.title}
              </h3>
              <p className="text-sm text-stone-600 dark:text-stone-400">
                {p.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-stone-200 dark:border-stone-800 pt-16">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
          <div>
            <h2 className="text-3xl font-display font-bold mb-4">
              Customer Reviews
            </h2>
            <div className="flex items-center space-x-4">
              <div className="flex text-primary">
                <span className="material-symbols-outlined">star</span>
                <span className="material-symbols-outlined">star</span>
                <span className="material-symbols-outlined">star</span>
                <span className="material-symbols-outlined">star</span>
                <span className="material-symbols-outlined">star_half</span>
              </div>
              <span className="text-lg font-bold">4.8 / 5.0</span>
            </div>
          </div>
          <button
            type="button"
            className="mt-6 md:mt-0 border-2 border-stone-800 dark:border-stone-200 px-8 py-3 font-bold hover:bg-stone-800 hover:text-white dark:hover:bg-white dark:hover:text-black transition-all"
          >
            WRITE A REVIEW
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {[
            {
              title: "Literally put it on everything!",
              date: "Oct 12, 2023",
              body: '"I\'ve tried dozens of chili oils and this is by far the most balanced. The garlic and spice notes really shine."',
              author: "Sarah M.",
            },
            {
              title: "The smoky flavor is unmatched",
              date: "Sept 28, 2023",
              body: '"Artisanal quality you just can\'t find in grocery stores. The branding is gorgeous too."',
              author: "Marcus T.",
            },
          ].map((r) => (
            <div key={r.title} className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex text-primary mb-1">
                    <span className="material-symbols-outlined text-[18px]">
                      star
                    </span>
                    <span className="material-symbols-outlined text-[18px]">
                      star
                    </span>
                    <span className="material-symbols-outlined text-[18px]">
                      star
                    </span>
                    <span className="material-symbols-outlined text-[18px]">
                      star
                    </span>
                    <span className="material-symbols-outlined text-[18px]">
                      star
                    </span>
                  </div>
                  <h4 className="font-bold">{r.title}</h4>
                </div>
                <span className="text-xs text-stone-400">{r.date}</span>
              </div>
              <p className="text-sm text-stone-600 dark:text-stone-400 italic">
                {r.body}
              </p>
              <p className="text-xs font-semibold">
                — {r.author}{" "}
                <span className="text-green-500 ml-2 font-normal">
                  Verified Buyer
                </span>
              </p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <button
            type="button"
            className="text-stone-500 dark:text-stone-400 text-sm font-semibold hover:text-primary transition-colors flex items-center justify-center mx-auto"
          >
            View All 48 Reviews{" "}
            <span className="material-symbols-outlined text-[18px] ml-1">
              expand_more
            </span>
          </button>
        </div>
      </section>
    </main>
  );
}
