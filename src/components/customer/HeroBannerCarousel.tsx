import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

type Banner = {
  id: string;
  title: string;
  subtitle: string;
  cta: string;
  to: string;
  gradient: string;
  emoji: string;
  tag?: string;
};

const BANNERS: Banner[] = [
  {
    id: "10min",
    title: "10-min delivery",
    subtitle: "Fresh groceries at lightning speed",
    cta: "Shop now",
    to: "/products",
    gradient: "gradient-banner-fresh",
    emoji: "⚡",
    tag: "Free above ₹199",
  },
  {
    id: "mango",
    title: "Mango Festival",
    subtitle: "Alphonso, Kesar & more · Up to 40% off",
    cta: "Explore",
    to: "/products?cat=fruits",
    gradient: "gradient-banner-mango",
    emoji: "🥭",
    tag: "Limited stock",
  },
  {
    id: "sale",
    title: "Monsoon Stock-Up",
    subtitle: "Buy more, save more on daily essentials",
    cta: "Browse deals",
    to: "/products",
    gradient: "gradient-banner-night",
    emoji: "🛒",
    tag: "Up to 60% off",
  },
  {
    id: "bakery",
    title: "Fresh from the oven",
    subtitle: "Breads, cakes & pastries baked today",
    cta: "Order now",
    to: "/products?cat=bakery",
    gradient: "gradient-banner-pink",
    emoji: "🥐",
    tag: "New arrivals",
  },
];

export function HeroBannerCarousel() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => setI((v) => (v + 1) % BANNERS.length), 4500);
    return () => window.clearInterval(t);
  }, []);

  const b = BANNERS[i];

  return (
    <div className="px-4">
      <div className="relative h-[150px] rounded-3xl overflow-hidden shadow-card">
        <AnimatePresence mode="wait">
          <motion.div
            key={b.id}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className={`absolute inset-0 ${b.gradient} text-white p-5 flex flex-col justify-between`}
          >
            <div>
              {b.tag && (
                <span className="inline-block rounded-full bg-white/20 backdrop-blur px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                  {b.tag}
                </span>
              )}
              <h2 className="mt-1.5 font-display text-2xl font-extrabold leading-tight drop-shadow-sm">
                {b.title}
              </h2>
              <p className="text-[12px] text-white/90 leading-snug max-w-[68%]">{b.subtitle}</p>
            </div>
            <Link
              to={b.to as any}
              className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white text-foreground px-3.5 py-1.5 text-[12px] font-bold shadow-soft"
            >
              {b.cta} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <div className="absolute -right-4 -bottom-6 text-[140px] leading-none opacity-90 select-none">
              {b.emoji}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
      {/* Dots */}
      <div className="flex items-center justify-center gap-1.5 mt-2.5">
        {BANNERS.map((_, idx) => (
          <button
            key={idx}
            aria-label={`Slide ${idx + 1}`}
            onClick={() => setI(idx)}
            className={`h-1.5 rounded-full transition-all ${
              idx === i ? "w-6 bg-primary" : "w-1.5 bg-border"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
