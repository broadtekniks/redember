import { Link } from "react-router-dom";

export default function Cancel() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-14">
      <div className="bg-white/80 dark:bg-stone-950/40 border border-stone-200 dark:border-stone-800 rounded-2xl p-8 backdrop-blur">
        <h1 className="font-display text-4xl mb-4">Checkout cancelled</h1>
        <p className="text-stone-600 dark:text-stone-400">
          No charge was made.
        </p>
        <Link
          className="inline-flex mt-6 text-primary font-semibold hover:underline"
          to="/"
        >
          Return to shop
        </Link>
      </div>
    </div>
  );
}
