import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useCart } from "../cart/CartContext";

export default function Success() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const cart = useCart();

  useEffect(() => {
    cart.clearCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-14">
      <div className="bg-white/80 dark:bg-stone-950/40 border border-stone-200 dark:border-stone-800 rounded-2xl p-8 backdrop-blur">
        <h1 className="font-display text-4xl mb-4">Payment received</h1>
        <p className="text-stone-600 dark:text-stone-400">
          Thanks for your order! You'll receive a confirmation from Stripe.
        </p>
        {sessionId && (
          <p className="mt-4 text-sm text-stone-500">Session: {sessionId}</p>
        )}
        <Link
          className="inline-flex mt-6 text-primary font-semibold hover:underline"
          to="/shop"
        >
          Back to shop
        </Link>
      </div>
    </div>
  );
}
