import { Link } from "@tanstack/react-router";
import { ProductImage } from "@/components/ProductImage";
import type { CategoryLite } from "./CategoryGrid";
import { useSubcategoriesAll } from "@/hooks/useSubcategoriesAll";

export function CategoryGroups({
  categories,
  from = 0,
  count = 3,
  showAll = false,
  anchorOffset,
  className = "space-y-3",
}: {
  categories?: CategoryLite[];
  from?: number;
  count?: number;
  /** Show every subcategory (the home page trims to 8, in full rows of 4). */
  showAll?: boolean;
  /** When set, each section gets id="cat-<slug>" and this scroll-margin-top (px) for jump links. */
  anchorOffset?: number;
  className?: string;
}) {
  const subs = useSubcategoriesAll();
  const groups = (categories ?? [])
    .map((c) => ({
      c,
      items: (subs.data ?? [])
        .filter((s) => s.category_id === c.id)
        .slice(0, showAll ? undefined : 8),
    }))
    .filter((g) => g.items.length > 0)
    .map((g) => ({
      ...g,
      items:
        showAll || g.items.length < 4
          ? g.items
          : g.items.slice(0, g.items.length - (g.items.length % 4)),
    }))
    .slice(from, from + count);

  return (
    <>
      {groups.map(({ c, items }) => (
        <section
          key={c.id}
          id={anchorOffset !== undefined ? `cat-${c.slug}` : undefined}
          style={anchorOffset !== undefined ? { scrollMarginTop: anchorOffset } : undefined}
          // Jump links need real section heights, so skip content-visibility when anchored.
          className={`${anchorOffset !== undefined ? "" : "cv-auto"} px-4 ${className}`}
        >
          <div className="flex items-center justify-between">
            <h2 className="section-title">{c.name}</h2>
            <Link
              to="/category/$slug"
              params={{ slug: c.slug }}
              className="press text-meta font-semibold text-primary"
            >
              See all
            </Link>
          </div>
          <div className="grid grid-cols-4 gap-x-2.5 gap-y-4 md:grid-cols-6 lg:grid-cols-8">
            {items.map((s) => (
              <Link
                key={s.id}
                to="/category/$slug"
                params={{ slug: c.slug }}
                search={{ sub: s.id } as never}
                className="press flex flex-col items-center gap-1.5"
              >
                <div className="grid aspect-square w-full place-items-center overflow-hidden rounded-xl bg-tint-mint ring-1 ring-black/5">
                  {s.image_url ? (
                    <ProductImage
                      src={s.image_url}
                      alt={s.name}
                      fit="cover"
                      className="h-full w-full bg-transparent"
                    />
                  ) : (
                    <span className="text-[28px]">{s.icon ?? c.icon ?? "🛍️"}</span>
                  )}
                </div>
                <span className="line-clamp-2 text-center text-caption font-medium leading-[14px]">
                  {s.name}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
