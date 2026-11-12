import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export function FastDeliveryBadge({ className, size = "sm" }: { className?: string; size?: "xs" | "sm" | "md" }) {
  const px = size === "xs" ? "px-1.5 py-0.5 text-[9px]" : size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[10px]";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-red-600 text-white font-extrabold uppercase tracking-wide shadow-sm animate-pulse",
        px,
        className,
      )}
    >
      <Zap className="h-3 w-3" />
      Fast delivery
    </span>
  );
}

/** Renders the correct badge for any delivery_type stored on an order. */
export function DeliveryTypeBadge({ type, className, size = "sm" }: { type?: string | null; className?: string; size?: "xs" | "sm" | "md" }) {
  const px = size === "xs" ? "px-1.5 py-0.5 text-[9px]" : size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[10px]";
  const map: Record<string, { label: string; bg: string; icon: string }> = {
    express_delivery: { label: "Express", bg: "bg-purple-600 text-white animate-pulse", icon: "🚀" },
    fast_delivery: { label: "Fast", bg: "bg-red-600 text-white animate-pulse", icon: "⚡" },
    standard_delivery: { label: "Standard", bg: "bg-emerald-600 text-white", icon: "🚚" },
    pickup: { label: "Pickup", bg: "bg-amber-500 text-white", icon: "🏪" },
  };
  const t = map[type ?? "standard_delivery"] ?? map.standard_delivery;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full font-extrabold uppercase tracking-wide shadow-sm", t.bg, px, className)}>
      <span>{t.icon}</span>{t.label}
    </span>
  );
}

export function PriorityDot({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex h-2.5 w-2.5", className)}>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600" />
    </span>
  );
}

/** Returns mm:ss remaining until `deadline`. "00:00" when expired. */
export function useCountdown(deadline: Date | null): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [deadline]);
  if (!deadline) return "";
  const ms = Math.max(0, deadline.getTime() - now);
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
