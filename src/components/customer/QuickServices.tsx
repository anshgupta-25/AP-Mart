import { Link } from "@tanstack/react-router";

const ITEMS = [
  { label: "Milk", emoji: "🥛", to: "/products?cat=dairy", bg: "bg-blue-100" },
  { label: "Fruits", emoji: "🍎", to: "/products?cat=fruits", bg: "bg-red-100" },
  { label: "Veggies", emoji: "🥦", to: "/products?cat=vegetables", bg: "bg-green-100" },
  { label: "Snacks", emoji: "🍪", to: "/products?cat=snacks", bg: "bg-amber-100" },
  { label: "Drinks", emoji: "🥤", to: "/products?cat=beverages", bg: "bg-orange-100" },
  { label: "Bakery", emoji: "🥐", to: "/products?cat=bakery", bg: "bg-yellow-100" },
  { label: "Care", emoji: "🧴", to: "/products?cat=personal-care", bg: "bg-pink-100" },
  { label: "Frozen", emoji: "🧊", to: "/products?cat=frozen", bg: "bg-sky-100" },
];

export function QuickServices() {
  return (
    <div className="px-4">
      <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
        {ITEMS.map((it) => (
          <Link
            key={it.label}
            to={it.to as any}
            className="shrink-0 flex flex-col items-center gap-1.5"
          >
            <div className={`${it.bg} h-16 w-16 rounded-2xl grid place-items-center text-3xl shadow-soft`}>
              {it.emoji}
            </div>
            <span className="text-[11px] font-semibold text-foreground/80">{it.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
