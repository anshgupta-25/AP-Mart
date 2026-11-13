import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/support")({
  head: () => ({ meta: [{ title: "Support Admin — AP Mart" }] }),
  component: Page,
});

function Page() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const stats = useQuery({
    queryKey: ["admin-support-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_support_stats");
      if (error) throw error;
      return data as any;
    },
    refetchInterval: 15000,
  });

  const addAgent = async () => {
    if (!email.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_set_support_agent", {
      _user_email: email.trim(),
      _is_active: true,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Agent added");
      setEmail("");
      qc.invalidateQueries({ queryKey: ["admin-support-stats"] });
    }
  };

  const remove = async (userId: string) => {
    if (!confirm("Remove this support executive?")) return;
    const { error } = await supabase.rpc("admin_remove_support_agent", {
      _user_id: userId,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["admin-support-stats"] });
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-4 md:px-6 md:py-6">
      <div>
        <h1 className="large-title">Support</h1>
        <p className="mt-0.5 text-meta text-muted-foreground">
          Ticket volume and support team performance
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">
        <Stat label="Total tickets" value={stats.data?.total ?? 0} />
        <Stat label="Open" value={stats.data?.open ?? 0} />
        <Stat label="Resolved" value={stats.data?.resolved ?? 0} />
        <Stat label="Closed" value={stats.data?.closed ?? 0} />
        <Stat
          label="Avg resolution (min)"
          value={Math.round(Number(stats.data?.avg_resolution_minutes ?? 0))}
        />
      </section>

      <section className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
        <h2 className="section-title">Add support executive</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="user@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button onClick={addAgent} disabled={busy}>
            Add
          </Button>
        </div>
        <p className="text-small text-muted-foreground">
          User must have signed up first. They'll receive the `support` role and gain access to
          /support.
        </p>
      </section>

      <section className="overflow-hidden rounded-xl border border-border/70 bg-card">
        <div className="section-title border-b border-border/70 px-4 py-3">
          Executive performance
        </div>
        <div className="md:hidden">
          {(stats.data?.agents ?? []).map((a: any) => (
            <div
              key={a.user_id}
              className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3 last:border-0"
            >
              <div className="min-w-0">
                <div className="truncate text-body font-medium">{a.display_name}</div>
                <div className="mt-0.5 text-small text-muted-foreground">
                  {a.is_active ? "Active" : "Inactive"} · {a.assigned} open · {a.resolved} resolved
                  · {Math.round(Number(a.avg_minutes ?? 0))} min avg
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove(a.user_id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {(stats.data?.agents ?? []).length === 0 && (
            <div className="px-6 py-10 text-center text-body text-muted-foreground">
              No support executives yet.
            </div>
          )}
        </div>
        <table className="hidden w-full text-sm md:table">
          <thead className="text-left text-small font-medium text-muted-foreground">
            <tr className="border-b border-border/70">
              <th className="p-4 text-left font-medium">Agent</th>
              <th className="p-4 text-left font-medium">Active</th>
              <th className="p-4 text-right font-medium">Open</th>
              <th className="p-4 text-right font-medium">Resolved</th>
              <th className="p-4 text-right font-medium">Avg min</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(stats.data?.agents ?? []).map((a: any) => (
              <tr
                key={a.user_id}
                className="border-b border-border/70 last:border-0 hover:bg-secondary/50"
              >
                <td className="px-4 py-3 font-medium">{a.display_name}</td>
                <td className="px-4 py-3">{a.is_active ? "Yes" : "No"}</td>
                <td className="px-4 py-3 text-right">{a.assigned}</td>
                <td className="px-4 py-3 text-right">{a.resolved}</td>
                <td className="px-4 py-3 text-right">{Math.round(Number(a.avg_minutes ?? 0))}</td>
                <td className="px-4 py-3 text-right">
                  <Button size="icon" variant="ghost" onClick={() => remove(a.user_id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {(stats.data?.agents ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-body text-muted-foreground">
                  No support executives yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4">
      <div className="text-small text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}
