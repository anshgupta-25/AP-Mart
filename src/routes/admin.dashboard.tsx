import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RoleShell } from "@/components/RoleShell";
import { rupees } from "@/lib/format";
import { ADMIN_NAV as NAV } from "@/lib/adminNav";



export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({ meta: [{ title: "Admin Dashboard — AP Mart" }] }),
  component: Page,
});

function Page() {
  const qc = useQueryClient();

  useEffect(() => {
    const ch = supabase.channel("admin-all").on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      qc.invalidateQueries({ queryKey: ["admin-recent"] });
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const stats = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [orders, shops, partners] = await Promise.all([
        supabase.from("orders").select("status, total").gte("placed_at", sevenDaysAgo),
        supabase.from("shops").select("id"),
        supabase.from("delivery_partners").select("id"),
      ]);
      const all = orders.data ?? [];
      return {
        total: all.length,
        revenue: all.reduce((a, b) => a + Number(b.total ?? 0), 0),
        awaiting: all.filter(o => o.status === "awaiting_shop").length,
        shops: shops.data?.length ?? 0,
        partners: partners.data?.length ?? 0,
      };
    },
    refetchInterval: 30000,
  });

  const recent = useQuery({
    queryKey: ["admin-recent"],
    queryFn: async () => (await supabase.from("orders").select("id, order_number, status, total, placed_at").order("placed_at", { ascending: false }).limit(20)).data ?? [],
    refetchInterval: 30000,
  });

  return (
    <RoleShell role="admin" nav={NAV} requireRoles={["admin"]}>
      <div className="p-4 md:p-6">
        <h1 className="font-display text-3xl font-extrabold">Admin overview</h1>
        <section className="mt-5 grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat label="Orders" value={String(stats.data?.total ?? 0)} />
          <Stat label="Revenue" value={rupees(stats.data?.revenue ?? 0)} />
          <Stat label="Awaiting shop" value={String(stats.data?.awaiting ?? 0)} />
          <Stat label="Shops" value={String(stats.data?.shops ?? 0)} />
          <Stat label="Partners" value={String(stats.data?.partners ?? 0)} />
        </section>

        <section className="mt-6">
          <h2 className="font-bold mb-3">Recent orders</h2>
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {(recent.data ?? []).map(o => (
              <Link
                key={o.id}
                to="/admin/orders/$id"
                params={{ id: o.id }}
                className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border last:border-0 text-sm hover:bg-secondary/50 transition"
              >
                <span className="font-semibold">{o.order_number}</span>
                <span className="text-xs text-muted-foreground">{new Date(o.placed_at).toLocaleString()}</span>
                <span className="text-xs uppercase rounded-full bg-secondary px-2 py-1 font-bold">{o.status.replace(/_/g, " ")}</span>
                <span className="font-bold">{rupees(o.total)}</span>
              </Link>
            ))}
            {(recent.data?.length ?? 0) === 0 && <div className="p-6 text-sm text-muted-foreground">No orders yet.</div>}
          </div>
        </section>
      </div>
    </RoleShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground font-semibold">{label}</div>
      <div className="font-display text-xl font-extrabold mt-1">{value}</div>
    </div>
  );
}

export { NAV as ADMIN_NAV };
