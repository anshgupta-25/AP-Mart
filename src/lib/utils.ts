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
