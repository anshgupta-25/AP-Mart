import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LeafletMap } from "@/components/maps/LeafletMap";
import { LocationPicker, type LatLng } from "@/components/maps/LocationPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Store,
  UserMinus,
  UserPlus,
  Search,
  MoreVertical,
  MapIcon,
  Loader2,
  Edit3,
  Trash2,
  Pause,
  Play,
  Eye,
  Package,
  IndianRupee,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { rupees } from "@/lib/format";
import { StorageImg } from "@/components/StorageImg";

export const Route = createFileRoute("/admin/shops")({ component: Page });

type ShopRow = {
  id: string;
  owner_id: string | null;
  owner_email: string | null;
  owner_name: string | null;
  owner_phone: string | null;
  owner_status: string | null;
  name: string;
  address: string;
  city: string | null;
  state: string | null;
  pincode: string;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  is_open: boolean;
  status: string;
  logo_url: string | null;
  service_radius_km: number;
  created_at: string;
  updated_at: string;
  today_orders: number;
  monthly_revenue: number;
  acceptance_rate: number | null;
  total_orders: number;
};

type SortKey = "name" | "orders" | "revenue" | "created" | "acceptance";

function Page() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [editShop, setEditShop] = useState<ShopRow | null>(null);
  const [deleteShop, setDeleteShop] = useState<ShopRow | null>(null);

  const [search, setSearch] = useState("");
  const [fOpen, setFOpen] = useState<"all" | "open" | "closed">("all");
  const [fStatus, setFStatus] = useState<"all" | "active" | "suspended">("all");
  const [fAssign, setFAssign] = useState<"all" | "assigned" | "unassigned">("all");
  const [fState, setFState] = useState<string>("all");
  const [fCity, setFCity] = useState<string>("all");
  const [fPin, setFPin] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("name");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;

  const q = useQuery({
    queryKey: ["admin-shops"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_shops");
      if (error) throw error;
      return (data ?? []) as ShopRow[];
    },
    staleTime: 30_000,
  });

  // Realtime — refresh on shops/user_roles changes
  useEffect(() => {
    const ch = supabase
      .channel("admin-shops-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "shops" }, () =>
        qc.invalidateQueries({ queryKey: ["admin-shops"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () =>
        qc.invalidateQueries({ queryKey: ["admin-shops"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const shops = q.data ?? [];

  // Options for filters
  const states = useMemo(
    () => Array.from(new Set(shops.map((s) => s.state).filter(Boolean))).sort() as string[],
    [shops],
  );
  const cities = useMemo(
    () =>
      Array.from(
        new Set(
          shops
            .filter((s) => fState === "all" || s.state === fState)
            .map((s) => s.city)
            .filter(Boolean),
        ),
      ).sort() as string[],
    [shops, fState],
  );
  const pincodes = useMemo(
    () => Array.from(new Set(shops.map((s) => s.pincode).filter(Boolean))).sort(),
    [shops],
  );

  // Summary
  const summary = useMemo(
    () => ({
      total: shops.length,
      active: shops.filter((s) => s.status === "active").length,
      suspended: shops.filter((s) => s.status === "suspended").length,
      open: shops.filter((s) => s.is_open && s.status === "active").length,
      closed: shops.filter((s) => !s.is_open || s.status !== "active").length,
      unassigned: shops.filter((s) => !s.owner_id).length,
    }),
    [shops],
  );

  // Filter + sort + paginate
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const out = shops.filter((s) => {
      if (fOpen === "open" && !s.is_open) return false;
      if (fOpen === "closed" && s.is_open) return false;
      if (fStatus !== "all" && s.status !== fStatus) return false;
      if (fAssign === "assigned" && !s.owner_id) return false;
      if (fAssign === "unassigned" && s.owner_id) return false;
      if (fState !== "all" && s.state !== fState) return false;
      if (fCity !== "all" && s.city !== fCity) return false;
      if (fPin !== "all" && s.pincode !== fPin) return false;
      if (term) {
        const hay = [
          s.name,
          s.owner_name,
          s.owner_email,
          s.owner_phone,
          s.phone,
          s.city,
          s.state,
          s.pincode,
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
    out.sort((a, b) => {
      switch (sort) {
        case "orders":
          return b.total_orders - a.total_orders;
        case "revenue":
          return Number(b.monthly_revenue) - Number(a.monthly_revenue);
        case "created":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "acceptance":
          return (Number(b.acceptance_rate) || 0) - (Number(a.acceptance_rate) || 0);
        default:
          return a.name.localeCompare(b.name);
      }
    });
    return out;
  }, [shops, search, fOpen, fStatus, fAssign, fState, fCity, fPin, sort]);

  useEffect(() => {
    setPage(1);
  }, [search, fOpen, fStatus, fAssign, fState, fCity, fPin, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const valid = shops.filter((s) => s.latitude != null && s.longitude != null);
  const mapCenter: [number, number] =
    valid.length > 0
      ? [
          valid.reduce((a, s) => a + (s.latitude || 0), 0) / valid.length,
          valid.reduce((a, s) => a + (s.longitude || 0), 0) / valid.length,
        ]
      : [12.9716, 77.5946];

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-shops"] });

  const setStatus = async (id: string, status: "active" | "suspended") => {
    const { error } = await supabase.rpc("admin_set_shop_status", {
      _shop_id: id,
      _status: status,
    });
    if (error) toast.error(error.message);
    else {
      toast.success(status === "active" ? "Shop activated" : "Shop suspended");
      refresh();
    }
  };

  const doDelete = async () => {
    if (!deleteShop) return;
    const { error } = await supabase.rpc("admin_delete_shop", { _shop_id: deleteShop.id });
    if (error) {
      // Surface the real reason (e.g. active orders) and keep the dialog open.
      toast.error(error.message.replace(/^.*?:\s*/, ""));
      return;
    }
    toast.success("Shop deleted successfully.");
    setDeleteShop(null);
    refresh();
  };

  return (
    <>
      <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-4 md:px-6 md:py-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <h1 className="large-title">Shops</h1>
            <p className="mt-0.5 text-meta text-muted-foreground">
              Manage all shops, owners and delivery configuration.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="secondary"
              onClick={() => setMapOpen(true)}
              disabled={valid.length === 0}
            >
              <MapIcon className="h-4 w-4 mr-1" />
              Full map
            </Button>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-1" />
                  Add shopkeeper
                </Button>
              </DialogTrigger>
              <AddShopkeeperDialog
                onDone={() => {
                  setAddOpen(false);
                  refresh();
                }}
              />
            </Dialog>
          </div>
        </header>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-6">
          <SummaryCard label="Total shops" value={summary.total} />
          <SummaryCard label="Active" value={summary.active} tone="green" />
          <SummaryCard label="Suspended" value={summary.suspended} tone="red" />
          <SummaryCard label="Open now" value={summary.open} tone="green" />
          <SummaryCard label="Closed" value={summary.closed} tone="muted" />
          <SummaryCard label="Unassigned" value={summary.unassigned} tone="amber" />
        </div>

        {/* Mini map */}
        {valid.length > 0 && (
          <div className="relative z-0 isolate">
            <LeafletMap
              center={mapCenter}
              zoom={10}
              className="h-44 w-full overflow-hidden rounded-xl sm:h-52"
            >
              {(RL) => {
                const { Marker, Popup, Circle } = RL;
                return (
                  <>
                    {valid.map((s) => (
                      <div key={s.id}>
                        <Marker position={[s.latitude!, s.longitude!]}>
                          <Popup>
                            <div className="font-bold">{s.name}</div>
                            <div className="text-xs">
                              {s.address}, {s.city}
                            </div>
                            <div className="text-xs">
                              Radius {s.service_radius_km} km · {s.is_open ? "Open" : "Closed"}
                            </div>
                          </Popup>
                        </Marker>
                        <Circle
                          center={[s.latitude!, s.longitude!]}
                          radius={(Number(s.service_radius_km) || 8) * 1000}
                          pathOptions={{
                            color: "hsl(var(--primary))",
                            weight: 1,
                            fillOpacity: 0.05,
                          }}
                        />
                      </div>
                    ))}
                  </>
                );
              }}
            </LeafletMap>
          </div>
        )}

        {/* Search + filters */}
        <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search shop, owner, email, phone, city, state, pincode…"
              className="pl-10"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
            <FilterSelect
              label="Open/Closed"
              value={fOpen}
              onChange={(v) => setFOpen(v as any)}
              options={[
                ["all", "All"],
                ["open", "Open"],
                ["closed", "Closed"],
              ]}
            />
            <FilterSelect
              label="Status"
              value={fStatus}
              onChange={(v) => setFStatus(v as any)}
              options={[
                ["all", "All"],
                ["active", "Active"],
                ["suspended", "Suspended"],
              ]}
            />
            <FilterSelect
              label="Owner"
              value={fAssign}
              onChange={(v) => setFAssign(v as any)}
              options={[
                ["all", "All"],
                ["assigned", "Assigned"],
                ["unassigned", "Unassigned"],
              ]}
            />
            <FilterSelect
              label="State"
              value={fState}
              onChange={(v) => {
                setFState(v);
                setFCity("all");
              }}
              options={[["all", "All"], ...states.map((s) => [s, s] as [string, string])]}
            />
            <FilterSelect
              label="City"
              value={fCity}
              onChange={setFCity}
              options={[["all", "All"], ...cities.map((c) => [c, c] as [string, string])]}
            />
            <FilterSelect
              label="Pincode"
              value={fPin}
              onChange={setFPin}
              options={[["all", "All"], ...pincodes.map((p) => [p, p] as [string, string])]}
            />
            <FilterSelect
              label="Sort by"
              value={sort}
              onChange={(v) => setSort(v as SortKey)}
              options={[
                ["name", "Name"],
                ["orders", "Orders"],
                ["revenue", "Revenue"],
                ["created", "Newest"],
                ["acceptance", "Acceptance"],
              ]}
            />
          </div>
        </div>

        {/* Results */}
        {q.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-56 rounded-xl shimmer" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-border/70 bg-card px-6 py-10 text-center">
            <div className="text-subtitle font-semibold">No shops found</div>
            <p className="mt-0.5 text-meta text-muted-foreground">Try changing your filters.</p>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 md:gap-4 xl:grid-cols-3">
              {pageRows.map((s) => (
                <ShopCard
                  key={s.id}
                  shop={s}
                  onEdit={() => setEditShop(s)}
                  onDelete={() => setDeleteShop(s)}
                  onSuspend={() => setStatus(s.id, "suspended")}
                  onActivate={() => setStatus(s.id, "active")}
                  onOwnerChanged={refresh}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <div className="text-xs text-muted-foreground">
                  Page {page} of {totalPages} · {filtered.length} shops
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Prev
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Full map dialog */}
      <Dialog open={mapOpen} onOpenChange={setMapOpen}>
        <DialogContent className="max-w-5xl w-[95vw]">
          <DialogHeader>
            <DialogTitle>All shops on the map</DialogTitle>
          </DialogHeader>
          <div className="relative z-0 isolate">
            <LeafletMap
              center={mapCenter}
              zoom={10}
              className="h-[70vh] w-full overflow-hidden rounded-xl"
            >
              {(RL) => {
                const { Marker, Popup, Circle } = RL;
                return (
                  <>
                    {valid.map((s) => (
                      <div key={s.id}>
                        <Marker position={[s.latitude!, s.longitude!]}>
                          <Popup>
                            <div className="font-bold">{s.name}</div>
                            <div className="text-xs">
                              {s.address}, {s.city}
                            </div>
                            <div className="text-xs">Owner: {s.owner_email || "Unassigned"}</div>
                            <div className="text-xs">
                              Radius {s.service_radius_km} km · {s.is_open ? "Open" : "Closed"}
                            </div>
                          </Popup>
                        </Marker>
                        <Circle
                          center={[s.latitude!, s.longitude!]}
                          radius={(Number(s.service_radius_km) || 8) * 1000}
                          pathOptions={{
                            color: "hsl(var(--primary))",
                            weight: 1,
                            fillOpacity: 0.06,
                          }}
                        />
                      </div>
                    ))}
                  </>
                );
              }}
            </LeafletMap>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      {editShop && (
        <EditShopDialog
          shop={editShop}
          onClose={() => setEditShop(null)}
          onDone={() => {
            setEditShop(null);
            refresh();
          }}
        />
      )}

      {/* Delete confirm */}
      <Dialog open={!!deleteShop} onOpenChange={(o) => !o && setDeleteShop(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete shop?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete{" "}
            <span className="font-semibold text-foreground">{deleteShop?.name}</span> and its
            product listings. The shop must have no active orders. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteShop(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={doDelete}>
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------- helpers ----------

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "green" | "red" | "amber" | "muted";
}) {
  const dot = {
    default: "bg-foreground/30",
    green: "bg-primary",
    red: "bg-destructive",
    amber: "bg-accent",
    muted: "bg-muted-foreground/40",
  }[tone];
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4">
      <div className="flex items-center gap-2 text-meta text-muted-foreground">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div>
      <div className="mb-1.5 text-small font-medium text-muted-foreground">{label}</div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-10 rounded-xl border-0 bg-secondary">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function StatusBadge({ shop }: { shop: ShopRow }) {
  if (shop.status === "suspended") return <Badge variant="destructive">Suspended</Badge>;
  if (!shop.is_open) return <Badge variant="secondary">Closed</Badge>;
  return <Badge>Open</Badge>;
}

function ShopCard({
  shop,
  onEdit,
  onDelete,
  onSuspend,
  onActivate,
  onOwnerChanged,
}: {
  shop: ShopRow;
  onEdit: () => void;
  onDelete: () => void;
  onSuspend: () => void;
  onActivate: () => void;
  onOwnerChanged: () => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4 md:p-5">
      <div className="flex items-start gap-3">
        {shop.logo_url ? (
          <StorageImg
            loading="lazy"
            decoding="async"
            src={shop.logo_url}
            alt=""
            className="h-12 w-12 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-tint-mint text-primary-ink">
            <Store className="h-5 w-5" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="truncate text-subtitle font-semibold">{shop.name}</div>
            <StatusBadge shop={shop} />
          </div>
          <div className="text-xs text-muted-foreground truncate">{shop.address}</div>
          <div className="text-xs text-muted-foreground truncate">
            {[shop.city, shop.state, shop.pincode].filter(Boolean).join(" · ")}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0"
              aria-label="Shop actions"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={onEdit}>
              <Edit3 className="h-4 w-4 mr-2" />
              Edit shop
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/admin/products" search={{ shop: shop.id } as any}>
                <Eye className="h-4 w-4 mr-2" />
                View products
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/admin/orders" search={{ shop: shop.id } as any}>
                <Package className="h-4 w-4 mr-2" />
                View orders
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/admin/earnings" search={{ shop: shop.id } as any}>
                <IndianRupee className="h-4 w-4 mr-2" />
                Earnings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {shop.status === "active" ? (
              <DropdownMenuItem onClick={onSuspend}>
                <Pause className="h-4 w-4 mr-2" />
                Suspend
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={onActivate}>
                <Play className="h-4 w-4 mr-2" />
                Activate
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <Stat label="Today" value={String(shop.today_orders)} />
        <Stat label="Revenue (m)" value={rupees(Number(shop.monthly_revenue) || 0)} />
        <Stat
          label="Accept"
          value={shop.acceptance_rate != null ? `${shop.acceptance_rate}%` : "—"}
        />
      </div>

      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
        <span>
          Radius <span className="font-semibold text-foreground">{shop.service_radius_km} km</span>
        </span>
        <span>·</span>
        <span>{shop.phone || "No phone"}</span>
      </div>

      <div className="text-xs">
        Owner:{" "}
        {shop.owner_id ? (
          <>
            <span className="font-semibold">{shop.owner_name || shop.owner_email}</span>
            {shop.owner_status === "disabled" && (
              <Badge variant="destructive" className="ml-2 text-micro">
                Disabled
              </Badge>
            )}
            {shop.owner_phone && (
              <span className="text-muted-foreground"> · {shop.owner_phone}</span>
            )}
          </>
        ) : (
          <span className="font-semibold text-[oklch(0.5_0.12_70)]">Unassigned</span>
        )}
      </div>

      <OwnerAssignInline
        shopId={shop.id}
        hasOwner={Boolean(shop.owner_id)}
        onDone={onOwnerChanged}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary/70 p-2.5">
      <div className="text-caption text-muted-foreground">{label}</div>
      <div className="truncate text-body font-semibold">{value}</div>
    </div>
  );
}

// ---------- add/edit dialogs ----------

function AddShopkeeperDialog({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [pincode, setPincode] = useState("");
  const [radius, setRadius] = useState("8");
  const [loc, setLoc] = useState<LatLng | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || !shopName.trim() || !address.trim() || !city.trim() || !pincode.trim()) {
      toast.error("Fill all required fields");
      return;
    }
    if (!/^[0-9]{6}$/.test(pincode.trim())) {
      toast.error("Pincode must be 6 digits");
      return;
    }
    if (!loc) {
      toast.error("Pick the shop location on the map");
      return;
    }
    const r = Number(radius);
    if (!(r > 0 && r <= 100)) {
      toast.error("Radius must be between 1 and 100 km");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("admin_create_shopkeeper", {
      _user_email: email.trim(),
      _shop_name: shopName.trim(),
      _address: address.trim(),
      _city: city.trim(),
      _pincode: pincode.trim(),
      _lat: loc.lat,
      _lng: loc.lng,
      _phone: phone.trim() || undefined,
      _radius: r,
    });
    if (!error && stateVal.trim()) {
      // Backfill state via admin_update_shop after creation is not straightforward without shop id;
      // admin_create_shopkeeper handles the shop. We update state through a follow-up query by name+pincode.
      await supabase
        .from("shops")
        .update({ state: stateVal.trim() })
        .eq("name", shopName.trim())
        .eq("pincode", pincode.trim());
    }
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Shopkeeper added");
      onDone();
    }
  };

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Add shopkeeper</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <label className="text-meta font-medium">Owner email *</label>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="owner@example.com"
          />
          <p className="text-caption text-muted-foreground mt-1">
            User must already have an account. They'll be granted the shopkeeper role.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-meta font-medium">Shop name *</label>
            <Input value={shopName} onChange={(e) => setShopName(e.target.value)} />
          </div>
          <div>
            <label className="text-meta font-medium">Shop phone</label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-meta font-medium">Address *</label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-meta font-medium">City *</label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div>
            <label className="text-meta font-medium">State</label>
            <Input value={stateVal} onChange={(e) => setStateVal(e.target.value)} />
          </div>
          <div>
            <label className="text-meta font-medium">Pincode *</label>
            <Input
              inputMode="numeric"
              maxLength={6}
              value={pincode}
              onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
            />
          </div>
        </div>
        <div>
          <label className="text-meta font-medium">Service radius (km)</label>
          <Input type="number" value={radius} onChange={(e) => setRadius(e.target.value)} />
        </div>
        <div>
          <label className="text-meta font-medium">Location *</label>
          <LocationPicker value={loc} onChange={setLoc} height="h-56" />
          {loc && (
            <p className="text-caption text-muted-foreground mt-1">
              {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
            </p>
          )}
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={busy}>
          {busy ? "Adding…" : "Add shopkeeper"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function EditShopDialog({
  shop,
  onClose,
  onDone,
}: {
  shop: ShopRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(shop.name);
  const [phone, setPhone] = useState(shop.phone ?? "");
  const [address, setAddress] = useState(shop.address);
  const [city, setCity] = useState(shop.city ?? "");
  const [stateVal, setStateVal] = useState(shop.state ?? "");
  const [pincode, setPincode] = useState(shop.pincode);
  const [radius, setRadius] = useState(String(shop.service_radius_km));
  const [isOpen, setIsOpen] = useState(shop.is_open);
  const [logoUrl, setLogoUrl] = useState(shop.logo_url ?? "");
  const [loc, setLoc] = useState<LatLng | null>(
    shop.latitude != null && shop.longitude != null
      ? { lat: shop.latitude, lng: shop.longitude }
      : null,
  );
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!/^[0-9]{6}$/.test(pincode.trim())) {
      toast.error("Pincode must be 6 digits");
      return;
    }
    const r = Number(radius);
    if (!(r > 0 && r <= 100)) {
      toast.error("Radius must be between 1 and 100 km");
      return;
    }
    if (!loc) {
      toast.error("Set the shop location");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("admin_update_shop", {
      _shop_id: shop.id,
      _name: name.trim(),
      _address: address.trim(),
      _city: city.trim(),
      _state: stateVal.trim() || undefined,
      _pincode: pincode.trim(),
      _phone: phone.trim() || undefined,
      _lat: loc.lat,
      _lng: loc.lng,
      _radius: r,
      _is_open: isOpen,
      _logo_url: logoUrl.trim() || undefined,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Shop updated");
      onDone();
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit shop</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-meta font-medium">Shop name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="text-meta font-medium">Shop phone</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-meta font-medium">Address</label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-meta font-medium">City</label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div>
              <label className="text-meta font-medium">State</label>
              <Input value={stateVal} onChange={(e) => setStateVal(e.target.value)} />
            </div>
            <div>
              <label className="text-meta font-medium">Pincode</label>
              <Input
                inputMode="numeric"
                maxLength={6}
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-meta font-medium">Radius (km)</label>
              <Input type="number" value={radius} onChange={(e) => setRadius(e.target.value)} />
            </div>
            <div>
              <label className="text-meta font-medium">Open now</label>
              <div className="h-9 flex items-center">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isOpen}
                    onChange={(e) => setIsOpen(e.target.checked)}
                  />
                  {isOpen ? "Open" : "Closed"}
                </label>
              </div>
            </div>
          </div>
          <div>
            <label className="text-meta font-medium">Logo URL</label>
            <Input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
          <div>
            <label className="text-meta font-medium">Location</label>
            <LocationPicker value={loc} onChange={setLoc} height="h-56" />
            {loc && (
              <p className="text-caption text-muted-foreground mt-1">
                {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- owner autocomplete ----------

function OwnerAssignInline({
  shopId,
  hasOwner,
  onDone,
}: {
  shopId: string;
  hasOwner: boolean;
  onDone: () => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);

  const search = useQuery({
    queryKey: ["admin-user-search", q],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_search_users", { _q: q, _limit: 8 });
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        email: string;
        full_name: string | null;
        phone: string | null;
        status: string;
      }[];
    },
    enabled: q.trim().length >= 2,
    staleTime: 15_000,
  });

  const assign = async (email: string) => {
    setBusy(true);
    const { error } = await supabase.rpc("admin_assign_shop_owner", {
      _shop_id: shopId,
      _user_email: email,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Owner assigned");
      setQ("");
      setOpen(false);
      onDone();
    }
  };

  const remove = async () => {
    setRemoving(true);
    const { error } = await supabase.rpc("admin_unassign_shop_owner", { _shop_id: shopId });
    setRemoving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Owner removed");
      onDone();
    }
  };

  return (
    <div className="mt-1 flex gap-2 items-stretch">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="flex-1">
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder="Search user by name, email, phone…"
              className="h-9 text-xs"
            />
          </div>
        </PopoverTrigger>
        <PopoverContent
          className="w-[300px] p-1"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {q.trim().length < 2 ? (
            <div className="text-xs text-muted-foreground p-2">Type at least 2 characters…</div>
          ) : search.isLoading ? (
            <div className="p-2 text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Searching…
            </div>
          ) : (search.data?.length ?? 0) === 0 ? (
            <div className="p-2 text-xs text-muted-foreground">No users found.</div>
          ) : (
            <ul className="max-h-64 overflow-y-auto">
              {search.data!.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    disabled={busy || u.status === "disabled"}
                    onClick={() => assign(u.email)}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-muted disabled:opacity-50"
                  >
                    <div className="text-xs font-semibold truncate">{u.full_name || u.email}</div>
                    <div className="text-caption text-muted-foreground truncate">
                      {u.email}
                      {u.phone ? ` · ${u.phone}` : ""}
                    </div>
                    {u.status === "disabled" && (
                      <div className="text-micro text-destructive">Disabled — cannot assign</div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </PopoverContent>
      </Popover>
      {hasOwner && (
        <Button
          size="sm"
          variant="outline"
          onClick={remove}
          disabled={removing}
          aria-label="Remove shop owner"
        >
          {removing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserMinus className="h-4 w-4" />
          )}
        </Button>
      )}
    </div>
  );
}
