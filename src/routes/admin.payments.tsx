import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { RoleShell } from "@/components/RoleShell";
import { rupees } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { refundPayment } from "@/lib/razorpay.functions";
import { ADMIN_NAV } from "./admin.dashboard";

export const Route = createFileRoute("/admin/payments")({
  head: () => ({ meta: [{ title: "Payments — Admin" }] }),
  component: Page,
});

function Page() {
  const qc = useQueryClient();
  const doRefund = useServerFn(refundPayment);

  const summary = useQuery({
    queryKey: ["admin-payments-summary"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_payments_summary");
      if (error) throw error;
      return data as any;
    },
  });

  const txns = useQuery({
    queryKey: ["admin-payments-list"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_payments", { _limit: 200 });
      if (error) throw error;
      return data ?? [];
    },
  });

  const refundMut = useMutation({
    mutationFn: async (paymentId: string) => doRefund({ data: { paymentId } }),
    onSuccess: () => {
      toast.success("Refund issued");
      qc.invalidateQueries({ queryKey: ["admin-payments-summary"] });
      qc.invalidateQueries({ queryKey: ["admin-payments-list"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Refund failed"),
  });

  const s = summary.data ?? {};

  return (
    <RoleShell role="admin" nav={ADMIN_NAV} requireRoles={["admin"]}>
      <div className="p-4 md:p-6">
        <h1 className="font-display text-3xl font-extrabold">Payments</h1>

        <section className="mt-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Revenue (total)" value={rupees(Number(s.revenue_total ?? 0))} />
          <Stat label="Revenue today" value={rupees(Number(s.revenue_today ?? 0))} />
          <Stat label="Successful txns" value={String(s.txn_count ?? 0)} />
          <Stat label="Failed payments" value={String(s.failed_count ?? 0)} accent="destructive" />
          <Stat label="Refunds issued" value={String(s.refund_count ?? 0)} />
          <Stat label="Refund total" value={rupees(Number(s.refund_total ?? 0))} />
        </section>

        <section className="mt-8">
          <h2 className="font-bold mb-3">Recent transactions</h2>
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left p-3">When</th>
                  <th className="text-left p-3">Payment</th>
                  <th className="text-left p-3">Method</th>
                  <th className="text-right p-3">Amount</th>
                  <th className="text-left p-3">Status</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {(txns.data ?? []).map((p: any) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="p-3 whitespace-nowrap">{new Date(p.created_at).toLocaleString()}</td>
                    <td className="p-3 font-mono text-xs">{p.provider_payment_id ?? "—"}</td>
                    <td className="p-3 uppercase text-xs">{p.method ?? p.provider}</td>
                    <td className="p-3 text-right font-semibold">{rupees(Number(p.amount))}</td>
                    <td className="p-3">
                      <StatusBadge status={p.status} />
                      {p.error_description && <div className="text-xs text-destructive mt-0.5">{p.error_description}</div>}
                    </td>
                    <td className="p-3 text-right">
                      {p.status === "paid" && (
                        <Button
                          size="sm" variant="outline" className="rounded-xl"
                          disabled={refundMut.isPending}
                          onClick={() => {
                            if (confirm(`Refund ${rupees(Number(p.amount))}?`)) refundMut.mutate(p.id);
                          }}
                        >Refund</Button>
                      )}
                    </td>
                  </tr>
                ))}
                {(txns.data?.length ?? 0) === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No payments yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </RoleShell>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "destructive" }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground font-semibold">{label}</div>
      <div className={`font-display text-2xl font-extrabold mt-1 ${accent === "destructive" ? "text-destructive" : ""}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "bg-primary/15 text-primary",
    pending: "bg-muted text-muted-foreground",
    failed: "bg-destructive/15 text-destructive",
    refunded: "bg-accent/20 text-accent-foreground",
    refund_initiated: "bg-accent/10 text-accent-foreground",
    cod: "bg-secondary text-secondary-foreground",
  };
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${map[status] ?? "bg-secondary"}`}>{status}</span>;
}
