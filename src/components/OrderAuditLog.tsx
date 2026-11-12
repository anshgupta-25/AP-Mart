import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { History, ArrowRight } from "lucide-react";

type Row = {
  id: string;
  event_type: string;
  from_value: string | null;
  to_value: string | null;
  actor_role: string | null;
  meta: any;
  created_at: string;
};

const labelFor = (e: string) =>
  ({
    created: "Order created",
    status_change: "Status changed",
    partner_assigned: "Delivery partner assigned",
    partner_unassigned: "Delivery partner removed",
    partner_reassigned: "Delivery partner reassigned",
    shop_change: "Shop changed",
    payment_status: "Payment status",
  } as Record<string, string>)[e] ?? e;

export function OrderAuditLog({ orderId }: { orderId: string }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["order-audit", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_audit_log")
        .select("id, event_type, from_value, to_value, actor_role, meta, created_at")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
    refetchInterval: 30000,
  });

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="font-bold flex items-center gap-2 mb-3">
        <History className="h-4 w-4 text-primary" /> Audit log
      </h2>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No events recorded yet.</p>
      ) : (
        <ol className="relative border-l-2 border-border ml-2 space-y-3">
          {data.map((r) => (
            <li key={r.id} className="pl-4 relative">
              <span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full bg-primary border-2 border-card" />
              <div className="text-sm font-semibold">{labelFor(r.event_type)}</div>
              {(r.from_value || r.to_value) && (
                <div className="text-xs text-muted-foreground inline-flex items-center gap-1 flex-wrap">
                  {r.from_value && (
                    <span className="px-1.5 py-0.5 rounded bg-secondary/60 font-mono">
                      {truncate(r.from_value)}
                    </span>
                  )}
                  {r.from_value && r.to_value && <ArrowRight className="h-3 w-3" />}
                  {r.to_value && (
                    <span className="px-1.5 py-0.5 rounded bg-primary/15 text-primary font-mono">
                      {truncate(r.to_value)}
                    </span>
                  )}
                </div>
              )}
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {new Date(r.created_at).toLocaleString()} · by {r.actor_role ?? "system"}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function truncate(s: string) {
  if (s.length <= 36) return s;
  return s.slice(0, 8) + "…" + s.slice(-4);
}
