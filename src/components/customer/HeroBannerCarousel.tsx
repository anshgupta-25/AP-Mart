import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StorageImg } from "@/components/StorageImg";

type Offer = {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  link_url: string | null;
  badge: string | null;
};

type Fallback = { id: string; title: string; sub: string; to: string; bg: string; emoji: string };

const FALLBACK: Fallback[] = [
  {
    id: "local",
    title: "Fresh from stores near you",
    sub: "Trusted local shops",
    to: "/products",
    bg: "bg-tint-mint",
    emoji: "🧺",
  },
  {
    id: "fruits",
    title: "Fruits & vegetables",
    sub: "Picked fresh every morning",
    to: "/category/fruits-vegetables",
    bg: "bg-tint-sun",
    emoji: "🥭",
  },
  {
    id: "dairy",
    title: "Dairy & bakery",
    sub: "Daily staples in one order",
    to: "/category/dairy-bread-eggs",
    bg: "bg-tint-sky",
    emoji: "🥛",
  },
];

function useOffers() {
  return useQuery({
    queryKey: ["home-offers"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("offers")
        .select("id, title, subtitle, image_url, link_url, badge, starts_at, ends_at")
        .eq("is_active", true)
        .eq("scope", "global")
        .order("display_order");
      return (
        (data ?? []) as (Offer & { starts_at: string | null; ends_at: string | null })[]
      ).filter(
        (o) =>
          o.image_url && (!o.starts_at || o.starts_at <= now) && (!o.ends_at || o.ends_at >= now),
      );
    },
  });
}

function OfferLink({
  href,
  className,
  children,
}: {
  href: string | null;
  className: string;
  children: React.ReactNode;
}) {
  const [path, qs] = (href && href.startsWith("/") ? href : "/products").split("?");
  const search = qs ? Object.fromEntries(new URLSearchParams(qs)) : undefined;
  return (
    <Link to={path} search={search} className={className}>
      {children}
    </Link>
  );
}

export function HeroBannerCarousel() {
  const offers = useOffers();
  const rail = "scrollbar-hide flex snap-x snap-mandatory scroll-px-4 gap-2.5 overflow-x-auto px-4";

  if (offers.data && offers.data.length > 0) {
    return (
      <div className={rail}>
        {offers.data.map((o) => (
          <OfferLink
            key={o.id}
            href={o.link_url}
            className="press relative h-[132px] w-[86%] shrink-0 snap-start overflow-hidden rounded-2xl bg-secondary md:w-[40%]"
          >
            <StorageImg
              src={o.image_url ?? undefined}
              alt={o.title}
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
            />
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, rgba(0,0,0,.58), rgba(0,0,0,.22) 62%, rgba(0,0,0,0))",
              }}
            />
            <div className="relative z-10 flex h-full max-w-[68%] flex-col justify-end p-3.5 text-white">
              {o.badge && (
                <span className="mb-1 w-fit rounded-full bg-white/90 px-2 py-0.5 text-micro font-semibold text-foreground">
                  {o.badge}
                </span>
              )}
              <div className="text-subtitle font-bold leading-tight tracking-tight">{o.title}</div>
              {o.subtitle && <div className="mt-0.5 text-small text-white/85">{o.subtitle}</div>}
            </div>
          </OfferLink>
        ))}
      </div>
    );
  }

  return (
    <div className={rail}>
      {FALLBACK.map((b) => (
        <OfferLink
          key={b.id}
          href={b.to}
          className={`press relative flex h-[88px] w-[84%] shrink-0 snap-start items-center overflow-hidden rounded-xl px-4 md:w-[40%] ${b.bg}`}
        >
          <div className="relative z-10 max-w-[68%]">
            <h2 className="text-body font-bold leading-tight tracking-tight">{b.title}</h2>
            <p className="mt-0.5 truncate text-caption text-foreground/60">{b.sub}</p>
            <span className="mt-1.5 inline-flex text-caption font-semibold text-primary-ink">
              Shop now ›
            </span>
          </div>
          <span className="pointer-events-none absolute -right-1 top-1/2 -translate-y-1/2 select-none text-[56px] leading-none">
            {b.emoji}
          </span>
        </OfferLink>
      ))}
    </div>
  );
}
