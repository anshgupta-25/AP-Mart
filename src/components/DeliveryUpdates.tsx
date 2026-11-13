import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Truck } from "lucide-react";

export function DeliveryUpdates({ orderId }: { orderId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["delivery-messages", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_messages")
        .select("id, message, kind, created_at")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`delivery-messages-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "delivery_messages",
          filter: `order_id=eq.${orderId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["delivery-messages", orderId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [orderId, qc]);

  if (!data || data.length === 0) return null;

  return (
    <section className="rounded-xl border border-border/70 bg-card p-4">
      <h2 className="section-title mb-3 flex items-center gap-2">
        <Truck className="h-4 w-4 text-primary" /> Delivery updates
      </h2>
      <ul className="divide-y divide-border/60">
        {data.map((m) => (
          <li key={m.id} className="flex gap-3 py-2.5 first:pt-0 last:pb-0">
            <div className="w-14 shrink-0 pt-0.5 text-caption font-medium text-muted-foreground">
              {new Date(m.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
            <div className="text-meta">{m.message}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
