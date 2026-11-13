import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The design-system type scale (see styles.css) must be known to tailwind-merge as font sizes,
// otherwise `text-micro text-foreground` is treated as two colours and the size is dropped.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["micro", "caption", "small", "meta", "body", "subtitle", "page"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Human-readable message from anything thrown (Error, Supabase error object, string…). */
export function errorMessage(e: unknown, fallback = "Something went wrong"): string {
  if (e instanceof Error && e.message) return e.message;
  if (
    typeof e === "object" &&
    e !== null &&
    "message" in e &&
    typeof e.message === "string" &&
    e.message
  ) {
    return e.message;
  }
  if (typeof e === "string" && e) return e;
  return fallback;
}
