import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

export function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setShow(window.scrollY > 700));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
  if (!show) return null;
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="press fixed left-1/2 top-[148px] z-40 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-foreground px-3.5 py-2 text-small font-semibold text-background shadow-float"
    >
      <ArrowUp className="h-3.5 w-3.5" /> Back to top
    </button>
  );
}
