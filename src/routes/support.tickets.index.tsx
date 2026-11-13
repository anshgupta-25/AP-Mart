import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bike,
  Check,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Inbox,
  LayoutGrid,
  Package,
  RotateCcw,
  Search,
  ShoppingBasket,
  Store,
  Truck,
  UserRound,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { TICKET_CATEGORIES } from "@/components/SupportTicketForm";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/support/tickets/")({
  head: () => ({ meta: [{ title: "Support Tickets — AP Mart" }] }),
  component: Page,
});

type Icon = ComponentType<{ className?: string }>;

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
] as const;

const STATUS_DOT: Record<string, string> = {
  open: "bg-amber-500",
  assigned: "bg-sky-500",
  in_progress: "bg-sky-500",
  resolved: "bg-primary",
  closed: "bg-muted-foreground/50",
};

const ROLES: { value: string; label: string; icon: Icon }[] = [
  { value: "all", label: "Everyone", icon: Users },
  { value: "customer", label: "Customers", icon: UserRound },
  { value: "shopkeeper", label: "Shopkeepers", icon: Store },
  { value: "delivery", label: "Delivery partners", icon: Bike },
];

const CATEGORY_ICON: Record<string, Icon> = {
  order_issue: Package,
  payment_issue: CreditCard,
  refund_issue: RotateCcw,
  delivery_issue: Truck,
  product_issue: ShoppingBasket,
  shop_issue: Store,
  account_issue: UserRound,
  technical_issue: Wrench,
};
const CATEGORIES: { value: string; label: string; icon: Icon }[] = [
  { value: "all", label: "All categories", icon: LayoutGrid },
  ...TICKET_CATEGORIES.map((c) => ({
    value: c.value as string,
    label: c.label as string,
    icon: CATEGORY_ICON[c.value] ?? Inbox,
  })),
];
const categoryLabel = (v: string) =>
  CATEGORIES.find((c) => c.value === v)?.label ?? v.replace(/_/g, " ");

function timeAgo(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return d < 7 ? `${d}d` : new Date(iso).toLocaleDateString([], { day: "numeric", month: "short" });
}

function Page() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("all");
  const [role, setRole] = useState<string>("all");
  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    const ch = supabase
      .channel("support-tickets-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () =>
        qc.invalidateQueries({ queryKey: ["support-tickets-list"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const tickets = useQuery({
    queryKey: ["support-tickets-list"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("support_list_complaints");
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30000,
  });

  const all = tickets.data ?? [];
  const query = q.trim().toLowerCase();

  // Role/category/search narrow the list first; status tab counts reflect those filters.
  const narrowed = useMemo(
    () =>
      all.filter(
        (t) =>
          (role === "all" || t.role_at_creation === role) &&
          (cat === "all" || t.category === cat) &&
          (!query ||
            t.title.toLowerCase().includes(query) ||
            t.ticket_number.toLowerCase().includes(query) ||
            (t.full_name ?? "").toLowerCase().includes(query)),
      ),
    [all, role, cat, query],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: narrowed.length };
    for (const t of narrowed) c[t.status] = (c[t.status] ?? 0) + 1;
    return c;
  }, [narrowed]);
  const filtered = status === "all" ? narrowed : narrowed.filter((t) => t.status === status);

  const openCount = all.filter((t) => t.status !== "resolved" && t.status !== "closed").length;
  const hasFilters = role !== "all" || cat !== "all" || !!query;
  const clearFilters = () => {
    setRole("all");
    setCat("all");
    setQ("");
  };

  const roleItem = ROLES.find((r) => r.value === role) ?? ROLES[0];
  const catItem = CATEGORIES.find((c) => c.value === cat) ?? CATEGORIES[0];

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 pb-10 pt-5 md:px-6">
      {/* Title */}
      <header className="px-1">
        <h1 className="text-[20px] font-semibold tracking-[-0.02em]">Tickets</h1>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
          {tickets.isLoading ? "Loading…" : `${openCount} need attention · ${all.length} total`}
        </p>
      </header>

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-10 rounded-xl pl-10 text-[13.5px]"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title, ticket no. or name"
          />
          {q && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQ("")}
              className="absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-secondary"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterMenu
            label="Raised by"
            value={roleItem}
            active={role !== "all"}
            options={ROLES}
            selected={role}
            onSelect={setRole}
            onClear={() => setRole("all")}
          />
          <FilterMenu
            label="Category"
            value={catItem}
            active={cat !== "all"}
            options={CATEGORIES}
            selected={cat}
            onSelect={setCat}
            onClear={() => setCat("all")}
          />
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="press ml-auto px-1 text-[12px] font-medium text-primary"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Status tabs */}
      <div className="no-scrollbar -mx-4 overflow-x-auto px-4">
        <div className="flex w-max gap-1.5">
          {STATUS_TABS.map((s) => {
            const on = status === s.value;
            const n = counts[s.value] ?? 0;
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => setStatus(s.value)}
                className={cn(
                  "press inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium transition-colors",
                  on
                    ? "bg-foreground text-background"
                    : "bg-card text-foreground/75 ring-1 ring-inset ring-border/70 hover:bg-secondary",
                )}
              >
                {s.value !== "all" && (
                  <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[s.value])} />
                )}
                {s.label}
                <span
                  className={cn(
                    "tabular-nums",
                    on ? "text-background/60" : "text-muted-foreground",
                  )}
                >
                  {n}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      {tickets.isLoading ? (
        <div className="space-y-px overflow-hidden rounded-2xl border border-border/60 bg-card">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[72px] shimmer opacity-60" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-border/60 bg-card px-6 py-10 text-center">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-muted-foreground">
            <Inbox className="h-[18px] w-[18px]" />
          </span>
          <div className="mt-3 text-[14px] font-semibold">No tickets here</div>
          <p className="mt-1 max-w-xs text-[12.5px] text-muted-foreground">
            {hasFilters || status !== "all"
              ? "Nothing matches these filters. Try a different status or category."
              : "New tickets from customers, shops and delivery partners will show up here."}
          </p>
          {(hasFilters || status !== "all") && (
            <button
              type="button"
              onClick={() => {
                clearFilters();
                setStatus("all");
              }}
              className="press mt-4 h-8 rounded-full bg-secondary px-3.5 text-[12.5px] font-medium"
            >
              Reset filters
            </button>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-card">
          {filtered.map((t) => {
            const CatIcon = CATEGORY_ICON[t.category] ?? Inbox;
            return (
              <li key={t.id}>
                <Link
                  to="/support/tickets/$id"
                  params={{ id: t.id }}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-secondary/50 active:bg-secondary"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary text-foreground/70">
                    <CatIcon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 shrink-0 rounded-full",
                          STATUS_DOT[t.status] ?? "bg-muted-foreground/50",
                        )}
                        title={t.status.replace(/_/g, " ")}
                      />
                      <span className="truncate text-[13.5px] font-medium">{t.title}</span>
                      <span className="ml-auto shrink-0 text-[11.5px] tabular-nums text-muted-foreground">
                        {timeAgo(t.created_at)}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-[12px] text-muted-foreground">
                      {t.ticket_number} · {categoryLabel(t.category)} ·{" "}
                      <span className="capitalize">{t.full_name || t.role_at_creation}</span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function FilterMenu({
  label,
  value,
  active,
  options,
  selected,
  onSelect,
  onClear,
}: {
  label: string;
  value: { label: string; icon: Icon };
  active: boolean;
  options: { value: string; label: string; icon: Icon }[];
  selected: string;
  onSelect: (v: string) => void;
  onClear: () => void;
}) {
  const ValueIcon = value.icon;
  return (
    <div
      className={cn(
        "inline-flex h-8 items-center rounded-full text-[12.5px] transition-colors",
        active
          ? "bg-primary-soft text-primary-ink ring-1 ring-inset ring-primary/25"
          : "bg-card ring-1 ring-inset ring-border/70",
      )}
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "press inline-flex h-full items-center gap-1.5 rounded-full pl-3 outline-none",
            active ? "pr-1" : "pr-2.5",
          )}
        >
          <span className={active ? "text-primary-ink/70" : "text-muted-foreground"}>{label}:</span>
          {active && <ValueIcon className="h-3.5 w-3.5" />}
          <span className="max-w-[9.5rem] truncate font-medium">{value.label}</span>
          {!active && <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" collisionPadding={12} className="w-56">
          <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground">
            {label}
          </DropdownMenuLabel>
          {options.map((o, i) => {
            const OIcon = o.icon;
            return (
              <div key={o.value}>
                {i === 1 && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  className="gap-2.5 py-2 text-[13px]"
                  onSelect={() => onSelect(o.value)}
                >
                  <OIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1">{o.label}</span>
                  {o.value === selected && <Check className="h-3.5 w-3.5 text-primary" />}
                </DropdownMenuItem>
              </div>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      {active && (
        <button
          type="button"
          aria-label={`Clear ${label}`}
          onClick={onClear}
          className="press mr-1 grid h-6 w-6 place-items-center rounded-full hover:bg-primary/10"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
