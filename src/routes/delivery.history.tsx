import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { RoleShell } from "@/components/RoleShell";
import { rupees } from "@/lib/format";
import { DELIVERY_NAV } from "./delivery.dashboard";

export const Route = createFileRoute("/delivery/history")({ component: Page });

function Page() {
  const { user } = useAuth();
  const [pid, setPid] = useState<string | null>(null);
  useEffect(() => { if (user) supabase.from("delivery_partners").select("id").eq("user_id", user.id).maybeSingle().then(({ data }) => setPid(data?.id ?? null)); }, [user]);
  const q = useQuery({
    queryKey: ["delivery-history", pid],
    queryFn: async () => {
      if (!pid) return [];
      const { data } = await supabase.from("orders").select("id, order_number, total, status, placed_at").eq("partner_id", pid).eq("status", "delivered").order("placed_at", { ascending: false }).limit(50);
      return data ?? [];
    },
    enabled: !!pid,
  });
  return (
    <RoleShell role="delivery" nav={DELIVERY_NAV} requireRoles={["delivery", "admin"]}>
      <div className="p-4 md:p-6">
        <h1 className="font-display text-2xl font-bold">Delivery history</h1>
        <div className="mt-5 space-y-2">
          {(q.data ?? []).map(o => (
            <div key={o.id} className="rounded-2xl border border-border bg-card p-3 flex justify-between text-sm">
              <span>{o.order_number}</span>
              <span className="font-bold">{rupees(o.total)}</span>
            </div>
          ))}
          {(q.data?.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">No delivered orders yet.</p>}
        </div>
      </div>
    </RoleShell>
  );
}
