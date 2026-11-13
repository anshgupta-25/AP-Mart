import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { rupees } from "@/lib/format";
import { ClipboardList, Clock, Store, Truck, Wallet } from "lucide-react";
import { EmptyState, PageContainer, PageHeader, Panel, Pill, Section, StatGrid, StatTile, orderTone, rowLink } from "@/components/admin/ui";



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
    <PageContainer>
      <PageHeader title="Overview" subtitle="Marketplace activity over the last 7 days" />

      <StatGrid className="lg:grid-cols-5">
        <StatTile label="Orders" value={String(stats.data?.total ?? 0)} icon={<ClipboardList />} tint="sky" />
        <StatTile label="Revenue" value={rupees(stats.data?.revenue ?? 0)} icon={<Wallet />} tint="mint" />
        <StatTile label="Awaiting shop" value={String(stats.data?.awaiting ?? 0)} icon={<Clock />} tint="sun" />
        <StatTile label="Shops" value={String(stats.data?.shops ?? 0)} icon={<Store />} tint="violet" />
        <StatTile label="Partners" value={String(stats.data?.partners ?? 0)} icon={<Truck />} tint="peach" />
      </StatGrid>

      <Section title="Recent orders">
        <Panel>
          {(recent.data ?? []).map((o) => (
            <Link key={o.id} to="/admin/orders/$id" params={{ id: o.id }} className={rowLink}>
              <div className="min-w-0">
                <div className="text-subtitle font-semibold">{o.order_number}</div>
                <div className="mt-0.5 text-small text-muted-foreground">{new Date(o.placed_at).toLocaleString()}</div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-subtitle font-semibold">{rupees(o.total)}</span>
                <Pill tone={orderTone(o.status)}>{o.status.replace(/_/g, " ")}</Pill>
              </div>
            </Link>
          ))}
          {(recent.data?.length ?? 0) === 0 && (
            <EmptyState icon={<ClipboardList />} title="No orders yet" description="New orders will appear here as they come in." />
          )}
        </Panel>
      </Section>
    </PageContainer>
  );
}

