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
        { event: "INSERT", schema: "public", table: "delivery_messages", filter: `order_id=eq.${orderId}` },
        () => qc.invalidateQueries({ queryKey: ["delivery-messages", orderId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [orderId, qc]);

  if (!data || data.length === 0) return null;

  return (
    <section className="mt-6 rounded-3xl border border-border bg-card p-5 md:p-6 shadow-card">
      <h2 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
        <Truck className="h-5 w-5 text-primary" /> Delivery updates
      </h2>
      <ul className="space-y-3">
        {data.map((m: any) => (
          <li key={m.id} className="flex gap-3">
            <div className="text-xs font-semibold text-muted-foreground w-16 shrink-0 pt-0.5">
              {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
            <div className="text-sm">{m.message}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
