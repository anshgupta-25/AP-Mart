import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Clock, Search, X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ProductImage } from "@/components/ProductImage";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerProducts } from "@/hooks/useCustomerProducts";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { rupees } from "@/lib/format";
import { cn } from "@/lib/utils";

const RECENT_KEY = "apmart.recent-searches";

function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 6) : [];
  } catch {
    return [];
  }
}
function writeRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 6)));
  } catch {
    /* storage unavailable */
  }
}

/** Full-screen product search. Uses the existing catalog RPC (`list_customer_products` with `_search`). */
export function SearchSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [term, setTerm] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const debounced = useDebouncedValue(term.trim(), 250);

  useEffect(() => {
    if (open) {
      setRecent(readRecent());
      setTerm("");
      const t = window.setTimeout(() => inputRef.current?.focus(), 80);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  const cats = useQuery({
    queryKey: ["header-categories"],
    staleTime: 5 * 60_000,
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id, slug, name, icon").eq("is_active", true).order("display_order").limit(12);
      return (data ?? []) as { id: string; slug: string; name: string; icon: string | null }[];
    },
  });

  const results = useCustomerProducts({ search: debounced || null, limit: 12, enabled: open && debounced.length >= 2, key: "search-sheet" });

  const submit = (q: string) => {
    const v = q.trim();
    if (!v) return;
    writeRecent([v, ...readRecent().filter((x) => x.toLowerCase() !== v.toLowerCase())]);
    onOpenChange(false);
    navigate({ to: "/products", search: { q: v } as any });
  };

  const showResults = debounced.length >= 2;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="top" className="h-dvh max-w-none gap-0 rounded-none border-0 p-0 [&>button]:hidden">
        <SheetTitle className="sr-only">Search products</SheetTitle>
        <div className="hairline-b bg-tint-mint pt-safe">
          <form
            className="flex items-center gap-2 px-3 py-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              submit(term);
            }}
          >
            <button type="button" aria-label="Close search" onClick={() => onOpenChange(false)} className="press grid h-10 w-10 shrink-0 place-items-center rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl bg-card px-3 shadow-soft">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Search for atta, dal, milk and more"
                enterKeyHint="search"
                className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-muted-foreground"
              />
              {term && (
                <button type="button" aria-label="Clear" onClick={() => setTerm("")} className="grid h-6 w-6 place-items-center rounded-full bg-secondary">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-background px-4 pb-8 pt-4">
          {!showResults && (
            <div className="space-y-6">
              {recent.length > 0 && (
                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="section-title">Recent searches</h2>
                    <button
                      type="button"
                      className="text-meta font-semibold text-primary"
                      onClick={() => {
                        writeRecent([]);
                        setRecent([]);
                      }}
                    >
                      Clear
                    </button>
                  </div>
                  <div className="divide-y divide-border/60 rounded-xl border border-border/70 bg-card">
                    {recent.map((r) => (
                      <button key={r} type="button" onClick={() => submit(r)} className="flex w-full items-center gap-3 px-3.5 py-3 text-left text-body">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {r}
                      </button>
                    ))}
                  </div>
                </section>
              )}
              {(cats.data?.length ?? 0) > 0 && (
                <section>
                  <h2 className="section-title mb-2">Browse categories</h2>
                  <div className="flex flex-wrap gap-2">
                    {cats.data!.map((c) => (
                      <Link
                        key={c.id}
                        to="/category/$slug"
                        params={{ slug: c.slug }}
                        onClick={() => onOpenChange(false)}
                        className="press inline-flex h-8 items-center gap-1.5 rounded-full border border-border/70 bg-card px-3.5 text-meta font-medium"
                      >
                        <span>{c.icon}</span>
                        {c.name}
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {showResults && (
            <div>
              {results.isLoading && <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl shimmer" />)}</div>}
              {!results.isLoading && (results.data?.length ?? 0) === 0 && (
                <div className="py-12 text-center">
                  <div className="text-subtitle font-semibold">No matches for "{debounced}"</div>
                  <p className="mt-1 text-meta text-muted-foreground">Try a different word or browse a category.</p>
                </div>
              )}
              {(results.data?.length ?? 0) > 0 && (
                <>
                  <div className="divide-y divide-border/60 rounded-xl border border-border/70 bg-card">
                    {results.data!.map((p) => (
                      <Link
                        key={p.id}
                        to="/product/$slug"
                        params={{ slug: p.slug }}
                        onClick={() => {
                          writeRecent([debounced, ...readRecent().filter((x) => x.toLowerCase() !== debounced.toLowerCase())]);
                          onOpenChange(false);
                        }}
                        className="flex items-center gap-3 px-3 py-2.5"
                      >
                        <ProductImage src={p.image_url} alt={p.name} fit="contain" className="h-12 w-12 shrink-0 rounded-lg bg-secondary/60" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-body font-medium">{p.name}</div>
                          <div className="text-small text-muted-foreground">{p.unit}</div>
                        </div>
                        <div className="text-body font-semibold">{rupees(p.price)}</div>
                      </Link>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => submit(debounced)}
                    className={cn("press mt-3 flex h-11 w-full items-center justify-center rounded-xl bg-primary text-body font-semibold text-primary-foreground")}
                  >
                    See all results for "{debounced}"
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Header icon that opens the SearchSheet. */
export function SearchButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="Search"
        onClick={() => setOpen(true)}
        className={cn("press grid h-9 w-9 place-items-center rounded-full bg-card shadow-soft", className)}
      >
        <Search className="h-4 w-4" />
      </button>
      <SearchSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
