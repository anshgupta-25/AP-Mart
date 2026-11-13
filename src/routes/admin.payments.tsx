import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { rupees } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { refundPayment } from "@/lib/razorpay.functions";
import { CheckCircle2, Undo2, Wallet, XCircle } from "lucide-react";
import {
  EmptyState,
  PageContainer,
  PageHeader,
  Panel,
  Pill,
  Section,
  StatGrid,
  StatTile,
} from "@/components/admin/ui";

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
    <PageContainer>
      <PageHeader title="Payments" subtitle="Revenue, failed payments and refunds" />

      <StatGrid className="lg:grid-cols-3">
        <StatTile
          label="Revenue (total)"
          value={rupees(Number(s.revenue_total ?? 0))}
          icon={<Wallet />}
          tint="mint"
        />
        <StatTile
          label="Revenue today"
          value={rupees(Number(s.revenue_today ?? 0))}
          icon={<Wallet />}
          tint="sky"
        />
        <StatTile
          label="Successful payments"
          value={String(s.txn_count ?? 0)}
          icon={<CheckCircle2 />}
          tint="violet"
        />
        <StatTile
          label="Failed payments"
          value={<span className="text-destructive">{String(s.failed_count ?? 0)}</span>}
          icon={<XCircle />}
          tint="rose"
        />
        <StatTile
          label="Refunds issued"
          value={String(s.refund_count ?? 0)}
          icon={<Undo2 />}
          tint="sun"
        />
        <StatTile
          label="Refund total"
          value={rupees(Number(s.refund_total ?? 0))}
          icon={<Undo2 />}
          tint="peach"
        />
      </StatGrid>

      <Section title="Recent transactions">
        <Panel>
          <div className="md:hidden">
            {(txns.data ?? []).map((p: any) => (
              <div
                key={p.id}
                className="space-y-2 border-b border-border/70 px-4 py-3 last:border-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-subtitle font-semibold">{rupees(Number(p.amount))}</div>
                    <div className="mt-0.5 text-small text-muted-foreground">
                      {new Date(p.created_at).toLocaleString()}
                    </div>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 text-small text-muted-foreground">
                    <span className="capitalize">{p.method ?? p.provider}</span>
                    <span className="ml-2 font-mono">{p.provider_payment_id ?? ""}</span>
                  </div>
                  {p.status === "paid" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={refundMut.isPending}
                      onClick={() => {
                        if (confirm(`Refund ${rupees(Number(p.amount))}?`)) refundMut.mutate(p.id);
                      }}
                    >
                      Refund
                    </Button>
                  )}
                </div>
                {p.error_description && (
                  <div className="text-small text-destructive">{p.error_description}</div>
                )}
              </div>
            ))}
          </div>

          <table className="hidden w-full text-sm md:table">
            <thead className="text-left text-small font-medium text-muted-foreground">
              <tr className="border-b border-border/70">
                <th className="p-4 text-left font-medium">When</th>
                <th className="p-4 text-left font-medium">Payment</th>
                <th className="p-4 text-left font-medium">Method</th>
                <th className="p-4 text-right font-medium">Amount</th>
                <th className="p-4 text-left font-medium">Status</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {(txns.data ?? []).map((p: any) => (
                <tr
                  key={p.id}
                  className="border-b border-border/70 transition-colors last:border-0 hover:bg-secondary/50"
                >
                  <td className="whitespace-nowrap px-4 py-3">
                    {new Date(p.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{p.provider_payment_id ?? "—"}</td>
                  <td className="px-4 py-3 text-meta capitalize">{p.method ?? p.provider}</td>
                  <td className="px-4 py-3 text-right font-semibold">{rupees(Number(p.amount))}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} />
                    {p.error_description && (
                      <div className="mt-0.5 text-xs text-destructive">{p.error_description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {p.status === "paid" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={refundMut.isPending}
                        onClick={() => {
                          if (confirm(`Refund ${rupees(Number(p.amount))}?`))
                            refundMut.mutate(p.id);
                        }}
                      >
                        Refund
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(txns.data?.length ?? 0) === 0 && (
            <EmptyState
              icon={<Wallet />}
              title="No payments yet"
              description="Transactions will show up here."
            />
          )}
        </Panel>
      </Section>
    </PageContainer>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone: Record<string, "success" | "neutral" | "danger" | "warning"> = {
    paid: "success",
    pending: "neutral",
    failed: "danger",
    refunded: "warning",
    refund_initiated: "warning",
    cod: "neutral",
  };
  return <Pill tone={tone[status] ?? "neutral"}>{status.replace(/_/g, " ")}</Pill>;
}
