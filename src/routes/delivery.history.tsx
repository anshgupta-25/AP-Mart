import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { rupees } from "@/lib/format";
import { PageHeader, Panel, EmptyState } from "@/components/data";
import { History } from "lucide-react";

export const Route = createFileRoute("/delivery/history")({ component: Page });

function Page() {
  const { user } = useAuth();
  const [pid, setPid] = useState<string | null>(null);
  useEffect(() => {
    if (user)
      supabase
        .from("delivery_partners")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => setPid(data?.id ?? null));
  }, [user]);
  const q = useQuery({
    queryKey: ["delivery-history", pid],
    queryFn: async () => {
      if (!pid) return [];
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, total, status, placed_at")
        .eq("partner_id", pid)
        .eq("status", "delivered")
        .order("placed_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    enabled: !!pid,
  });
  const rows = q.data ?? [];
  const total = rows.reduce((sum, o) => sum + Number(o.total ?? 0), 0);
  return (
    <div className="space-y-5 px-4 py-4 md:px-6">
      <PageHeader title="History" />
      <div className="rounded-xl bg-tint-mint p-4">
        <div className="text-small text-foreground/60">Delivered orders</div>
        <div className="mt-1 text-page font-bold leading-none tracking-tight">{rows.length}</div>
        <div className="mt-1.5 text-small text-foreground/60">Order value {rupees(total)}</div>
      </div>
      {rows.length > 0 ? (
        <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70 bg-card">
          {rows.map((o) => (
            <div key={o.id} className="flex min-h-12 items-center justify-between px-4 py-2.5">
              <div>
                <div className="text-body font-medium">{o.order_number}</div>
                <div className="text-caption text-muted-foreground">
                  {o.placed_at ? new Date(o.placed_at).toLocaleDateString() : ""}
                </div>
              </div>
              <span className="text-body font-semibold">{rupees(o.total)}</span>
            </div>
          ))}
        </div>
      ) : (
        <Panel>
          <EmptyState
            icon={<History />}
            title="No delivered orders yet"
            description="Completed deliveries will be listed here."
          />
        </Panel>
      )}
    </div>
  );
}
