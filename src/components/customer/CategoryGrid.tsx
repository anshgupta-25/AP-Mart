import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";

export type CategoryLite = {
  id: string;
  slug: string;
  name: string;
  icon?: string | null;
  color?: string | null;
};

const PASTELS = [
  "bg-lime-100", "bg-amber-100", "bg-orange-100", "bg-rose-100",
  "bg-sky-100", "bg-violet-100", "bg-emerald-100", "bg-yellow-100",
];

export function CategoryGrid({ categories, loading }: { categories?: CategoryLite[]; loading?: boolean }) {
  if (loading) {
    return (
      <div className="px-4 grid grid-cols-4 gap-2.5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-2xl shimmer" />
        ))}
      </div>
    );
  }
  const items = (categories ?? []).slice(0, 8);
  return (
    <div className="px-4 grid grid-cols-4 gap-2.5">
      {items.map((c, idx) => (
        <motion.div
          key={c.id}
          whileTap={{ scale: 0.94 }}
          transition={{ type: "spring", stiffness: 400, damping: 22 }}
        >
          <Link
            to="/category/$slug"
            params={{ slug: c.slug }}
            className="flex flex-col items-center gap-1.5"
          >
            <div className={`${PASTELS[idx % PASTELS.length]} aspect-square w-full rounded-2xl grid place-items-center text-3xl shadow-soft`}>
              {c.icon ?? "🛍️"}
            </div>
            <span className="text-[11px] font-semibold text-center leading-tight line-clamp-2">
              {c.name}
            </span>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
