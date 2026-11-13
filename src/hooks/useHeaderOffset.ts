import { useEffect, useState } from "react";

/** Height of the app-wide sticky header (if any) so page-level sticky bars sit right below it. */
export function useHeaderOffset() {
  const [h, setH] = useState(0);
  useEffect(() => {
    const el = document.querySelector("body header") as HTMLElement | null;
    const measure = () => setH(el ? Math.round(el.getBoundingClientRect().height) : 0);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  return h;
}
