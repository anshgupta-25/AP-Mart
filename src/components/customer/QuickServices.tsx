import { Link } from "@tanstack/react-router";

const ITEMS = [
  { label: "Milk", emoji: "🥛", to: "/products?cat=dairy" },
  { label: "Fruits", emoji: "🍎", to: "/products?cat=fruits" },
  { label: "Veggies", emoji: "🥦", to: "/products?cat=vegetables" },
  { label: "Snacks", emoji: "🍪", to: "/products?cat=snacks" },
  { label: "Drinks", emoji: "🥤", to: "/products?cat=beverages" },
  { label: "Bakery", emoji: "🥐", to: "/products?cat=bakery" },
  { label: "Care", emoji: "🧴", to: "/products?cat=personal-care" },
  { label: "Frozen", emoji: "🧊", to: "/products?cat=frozen" },
];

export function QuickServices() {
  return (
    <div className="scrollbar-hide flex gap-3 overflow-x-auto px-4 pb-1">
      {ITEMS.map((it) => (
        <Link
          key={it.label}
          to={it.to as any}
          className="flex shrink-0 flex-col items-center gap-1.5"
        >
          <div className="grid h-16 w-16 place-items-center rounded-xl bg-secondary text-3xl">
            {it.emoji}
          </div>
          <span className="text-caption font-medium">{it.label}</span>
        </Link>
      ))}
    </div>
  );
}
