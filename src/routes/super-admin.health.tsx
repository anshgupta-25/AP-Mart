import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Database, Loader2, HardDriveDownload, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/super-admin/health")({
  head: () => ({
    meta: [
      { title: "Database Health & Backups — AP Mart" },
      { name: "description", content: "Table volumes, recent write activity and backup guidance for the AP Mart platform." },
      { property: "og:title", content: "Database Health & Backups — AP Mart" },
      { property: "og:description", content: "Database health and backup overview." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HealthPage,
});

const TABLES = [
  "orders",
  "order_items",
  "products",
  "shop_products",
  "shops",
  "profiles",
  "user_roles",
  "notifications",
  "payments",
  "support_tickets",
] as const;

function HealthPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["super-admin", "db-health"],
    queryFn: async () => {
      const results = await Promise.all(
        TABLES.map(async (t) => {
          const { count, error } = await supabase.from(t as any).select("id", { count: "exact", head: true });
          return { table: t, count: error ? null : (count ?? 0) };
        }),
      );
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { count: recentOrders } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .gte("placed_at", since);
      return { results, recentOrders: recentOrders ?? 0 };
    },
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Database health</h1>
        <p className="text-sm text-muted-foreground">Row volumes and write activity across the platform's core tables.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Activity className="h-4 w-4 text-emerald-600" /> Orders in the last 24 hours
        </div>
        <div className="mt-2 text-3xl font-extrabold">{data?.recentOrders ?? 0}</div>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-5 py-3 text-sm font-bold">
            <Database className="h-4 w-4 text-emerald-600" /> Table volumes
          </div>
          <ul className="divide-y divide-border">
            {(data?.results ?? []).map((r) => (
              <li key={r.table} className="flex items-center justify-between px-5 py-2.5 text-xs">
                <code className="font-mono">{r.table}</code>
                <span className="font-bold">{r.count === null ? "—" : r.count.toLocaleString("en-IN")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-5">
        <div className="flex items-center gap-2 text-sm font-bold">
          <HardDriveDownload className="h-4 w-4 text-muted-foreground" /> Backup &amp; restore
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          The platform database is backed up automatically by the managed hosting layer with point-in-time recovery.
          Restores are performed from your project's backend settings — deliberately not exposed as an in-app button, since a
          mis-click would overwrite live production data.
        </p>
      </div>
    </div>
  );
}
