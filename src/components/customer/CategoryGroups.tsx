import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProductImage } from "@/components/ProductImage";
import type { CategoryLite } from "./CategoryGrid";

type Sub = {
  id: string;
  category_id: string;
  name: string;
  icon: string | null;
  image_url: string | null;
};

function useSubcategoriesAll() {
  return useQuery({
    queryKey: ["home-subcategories"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("subcategories")
        .select("id, category_id, name, icon, image_url")
        .eq("is_active", true)
        .order("display_order");
      return (data ?? []) as Sub[];
    },
  });
}

export function CategoryGroups({
  categories,
  from = 0,
  count = 3,
}: {
  categories?: CategoryLite[];
  from?: number;
  count?: number;
}) {
  const subs = useSubcategoriesAll();
  const groups = (categories ?? [])
    .map((c) => ({ c, items: (subs.data ?? []).filter((s) => s.category_id === c.id).slice(0, 8) }))
    .filter((g) => g.items.length > 0)
    .map((g) => ({
      ...g,
      items:
        g.items.length >= 4 ? g.items.slice(0, g.items.length - (g.items.length % 4)) : g.items,
    }))
    .slice(from, from + count);

  return (
    <>
      {groups.map(({ c, items }) => (
        <section key={c.id} className="cv-auto space-y-3 px-4">
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
