import { Link } from "@tanstack/react-router";

export type CategoryLite = {
  id: string;
  slug: string;
  name: string;
  icon?: string | null;
  color?: string | null;
};

const TINTS = ["bg-tint-mint", "bg-tint-sun", "bg-tint-sky", "bg-tint-rose", "bg-tint-violet", "bg-tint-peach"];

export function CategoryGrid({ categories, loading }: { categories?: CategoryLite[]; loading?: boolean }) {
  const grid = "px-5 grid grid-cols-4 gap-x-3 gap-y-5 md:grid-cols-6 lg:grid-cols-8";
  if (loading) {
    return (
      <div className={grid}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-2xl shimmer" />
        ))}
      </div>
    );
  }
  return (
    <div className={grid}>
      {(categories ?? []).slice(0, 12).map((c, i) => (
        <Link
          key={c.id}
          to="/category/$slug"
          params={{ slug: c.slug }}
          className="press flex flex-col items-center gap-2"
        >
          <div className={`${TINTS[i % TINTS.length]} grid aspect-square w-full place-items-center rounded-2xl text-[30px]`}>
            {c.icon ?? "🛍️"}
          </div>
          <span className="line-clamp-2 text-center text-small font-medium leading-tight">{c.name}</span>
        </Link>
      ))}
    </div>
  );
}
