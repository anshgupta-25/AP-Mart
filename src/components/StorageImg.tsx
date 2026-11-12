import { forwardRef, useRef, type ImgHTMLAttributes } from "react";
import { useStorageUrl } from "@/hooks/useStorageUrl";

/**
 * Drop-in replacement for `<img>` that understands `storage://bucket/path` references.
 * Plain http(s) URLs render exactly as before. If a signed URL fails (expired), it is
 * re-signed once before the normal `onError` is surfaced.
 */
export const StorageImg = forwardRef<HTMLImageElement, ImgHTMLAttributes<HTMLImageElement>>(
  function StorageImg({ src, onError, ...rest }, ref) {
    const { url, retry, isRef } = useStorageUrl(src);
    const retried = useRef<string | null>(null);
    if (isRef && !url) return <span aria-hidden className={rest.className} />;
    if (!url) return <img ref={ref} {...rest} src={src} onError={onError} />;
    return (
      <img
        ref={ref}
        {...rest}
        src={url}
        onError={(e) => {
          if (isRef && retried.current !== src) {
            retried.current = src ?? null;
            retry();
            return;
          }
          onError?.(e);
        }}
      />
    );
  },
);

/** `<a>` whose href may be a storage:// reference (resolved to a signed URL on click/render). */
export function StorageLink({
  href,
  children,
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const { url } = useStorageUrl(href);
  return (
    <a {...rest} href={url ?? undefined} aria-busy={!url}>
      {children}
    </a>
  );
}
