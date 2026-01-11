import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-14">
      <div className="bg-white/80 dark:bg-stone-950/40 border border-stone-200 dark:border-stone-800 rounded-2xl p-8 backdrop-blur">
        <h1 className="font-display text-4xl mb-4">Not found</h1>
        <Link
          className="inline-flex mt-2 text-primary font-semibold hover:underline"
          to="/"
        >
          Back to shop
        </Link>
      </div>
    </div>
  );
}
