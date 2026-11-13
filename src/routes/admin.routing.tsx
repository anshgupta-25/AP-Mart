import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Route as RouteIcon, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/admin/routing")({
  head: () => ({ meta: [{ title: "Routing logs — AP Mart Admin" }] }),
  component: Page,
});

type Row = {
  id: string;
  order_id: string | null;
  pincode: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  candidates_considered: number;
  chosen_shop_id: string | null;
  chosen_distance_km: number | null;
  outcome: string;
  reason: string | null;
  created_at: string;
};

function Page() {
  const q = useQuery({
    queryKey: ["admin-routing-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_routing_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
    refetchInterval: 15000,
  });

  const rows = q.data ?? [];
  const assigned = rows.filter((r) => r.outcome === "assigned").length;
  const rejected = rows.length - assigned;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-4 md:px-6 md:py-6">
      <header>
        <h1 className="large-title">Order routing</h1>
        <p className="mt-0.5 text-meta text-muted-foreground">
          Every routing decision — pincode match, distance, product availability, and the chosen shop (or why nothing matched).
        </p>
      </header>

      <div className="grid grid-cols-3 gap-3 md:gap-4">
        <Stat label="Decisions (last 200)" value={rows.length} />
        <Stat label="Assigned" value={assigned} tone="ok" />
        <Stat label="Rejected" value={rejected} tone="warn" />
      </div>

      <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
        {rows.map((r) => (
          <div key={r.id} className="space-y-1.5 border-b border-border/70 p-4 text-sm last:border-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-semibold">
                {r.outcome === "assigned" ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                <span className="text-meta capitalize">{r.outcome.replace(/_/g, " ")}</span>
              </div>
              <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
            </div>
            <div className="text-muted-foreground">
              Pincode <span className="text-foreground font-mono">{r.pincode ?? "—"}</span> •
              Candidates <span className="text-foreground">{r.candidates_considered}</span>
              {r.chosen_distance_km != null && <> • Distance <span className="text-foreground">{Number(r.chosen_distance_km).toFixed(2)} km</span></>}
            </div>
            {r.chosen_shop_id && (
              <div className="text-xs text-muted-foreground">Shop <span className="font-mono">{r.chosen_shop_id}</span></div>
            )}
            {r.order_id && (
              <div className="text-xs text-muted-foreground">Order <span className="font-mono">{r.order_id}</span></div>
            )}
            {r.reason && <div className="text-xs">{r.reason}</div>}
          </div>
        ))}
        {rows.length === 0 && <div className="px-6 py-10 text-center"><div className="text-subtitle font-semibold">No routing decisions yet</div><p className="mt-0.5 text-meta text-muted-foreground">Decisions appear here as orders are placed.</p></div>}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" }) {
  const color = tone === "ok" ? "text-primary" : tone === "warn" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4">
      <div className="text-meta text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-xl font-semibold tracking-tight ${color}`}>{value}</div>
    </div>
  );
}
