import { cn } from "@/lib/utils";
import { ProductImage } from "@/components/ProductImage";
import { StorageImg } from "@/components/StorageImg";

/**
 * Single entry point for catalog/media images. Storage refs (`storage://…`) and plain URLs both work.
 * `aspect` reserves the box so pages don't shift while images load; `fit` is cover for photos, contain for packshots.
 */
export function SmartImage({
  src,
  alt,
  aspect = "square",
  fit = "cover",
  className,
  eager = false,
  fallback,
}: {
  src?: string | null;
  alt: string;
  aspect?: "square" | "portrait" | "landscape" | "banner";
  fit?: "cover" | "contain";
  className?: string;
  eager?: boolean;
  fallback?: string;
}) {
  const ratio = { square: "aspect-square", portrait: "aspect-[4/5]", landscape: "aspect-[4/3]", banner: "aspect-[12/5]" }[aspect];
  if (!src) {
    return (
      <div className={cn("grid place-items-center rounded-xl bg-secondary text-muted-foreground/40", ratio, className)} aria-label={alt}>
        {fallback ?? <span className="text-[22px]">🛍️</span>}
      </div>
    );
  }
  return src.startsWith("storage://") ? (
    <StorageImg
      src={src}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={cn("h-full w-full", fit === "cover" ? "object-cover" : "object-contain", ratio, className)}
    />
  ) : (
    <ProductImage src={src} alt={alt} fit={fit} eager={eager} className={cn(ratio, className)} />
  );
}
