import { cn } from "@/lib/utils";
import apmartLogo from "@/assets/apmart-logo.png";
// Same logo, original 192px export (35 KB vs 220 KB): marks render at 28-56px.
import apmartLogoSmall from "@/assets/apmart-logo-192.png";

const MARK_SIZES = {
  xs: "h-7 w-7",
  sm: "h-8 w-8",
  md: "h-9 w-9",
  lg: "h-12 w-12",
} as const;

export function LogoMark({
  size = "md",
  className = "",
}: {
  size?: keyof typeof MARK_SIZES;
  className?: string;
}) {
  return (
    <img
      src={apmartLogoSmall || apmartLogo || "/apmart-logo.png"}
      alt="AP Mart logo"
      width={96}
      height={96}
      decoding="async"
      fetchPriority="high"
      onError={(e) => {
        const img = e.currentTarget;
        if (!img.src.endsWith("/apmart-logo.png")) img.src = "/apmart-logo.png";
      }}
      className={cn(
        MARK_SIZES[size],
        "shrink-0 rounded-xl object-contain ",
        className
      )}
    />
  );
}

export function Logo({
  size = "md",
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const t = { sm: "text-subtitle", md: "text-subtitle", lg: "text-page" }[size];
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark size={size} />
      <div className="leading-none">
        <div className={`font-display font-bold tracking-tight ${t} text-foreground`}>
          AP <span className="text-primary">Mart</span>
        </div>
      </div>
    </div>
  );
}

