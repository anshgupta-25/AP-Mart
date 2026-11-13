import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Database, Loader2, HardDriveDownload, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/super-admin/health")({
  head: () => ({
    meta: [
      { title: "Database Health & Backups — AP Mart" },
      {
        name: "description",
        content:
          "Table volumes, recent write activity and backup guidance for the AP Mart platform.",
      },
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
          const { count, error } = await supabase
            .from(t as any)
            .select("id", { count: "exact", head: true });
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
        <h1 className="large-title">Database health</h1>
        <p className="mt-0.5 text-small text-muted-foreground">
          Row volumes and write activity across the platform's core tables.
        </p>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-3.5">
        <span className="mb-2.5 grid h-9 w-9 place-items-center rounded-lg bg-tint-mint text-primary-ink">
          <Activity className="h-[17px] w-[17px]" />
        </span>
        <div className="text-small text-muted-foreground">Orders in the last 24 hours</div>
        <div className="mt-0.5 text-xl font-semibold tracking-tight">{data?.recentOrders ?? 0}</div>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
          <div className="section-title flex items-center gap-2 border-b border-border/70 px-4 py-3">
            <Database className="h-4 w-4 text-primary" /> Table volumes
          </div>
          <ul className="divide-y divide-border/70">
            {(data?.results ?? []).map((r) => (
              <li
                key={r.table}
                className="flex items-center justify-between px-4 py-2.5 text-small"
              >
                <code className="font-mono text-small">{r.table}</code>
                <span className="font-semibold">
                  {r.count === null ? "—" : r.count.toLocaleString("en-IN")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-dashed border-border bg-secondary/50 p-4">
        <div className="flex items-center gap-2 text-body font-semibold">
          <HardDriveDownload className="h-4 w-4 text-muted-foreground" /> Backup &amp; restore
        </div>
        <p className="mt-1 text-small leading-relaxed text-muted-foreground">
          The platform database is backed up automatically by the managed hosting layer with
          point-in-time recovery. Restores are performed from your project's backend settings —
          deliberately not exposed as an in-app button, since a mis-click would overwrite live
          production data.
        </p>
      </div>
    </div>
  );
}
