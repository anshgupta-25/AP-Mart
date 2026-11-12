import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RoleShell } from "@/components/RoleShell";
import { ADMIN_NAV } from "./admin.dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/support")({
  head: () => ({ meta: [{ title: "Support Admin — AP Mart" }] }),
  component: () => (
    <RoleShell role="admin" nav={ADMIN_NAV} requireRoles={["admin"]}>
      <Page />
    </RoleShell>
  ),
});

function Page() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const stats = useQuery({
    queryKey: ["admin-support-stats"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("admin_support_stats");
      if (error) throw error;
      return data as any;
    },
    refetchInterval: 15000,
  });

  const addAgent = async () => {
    if (!email.trim()) return;
    setBusy(true);
    const { error } = await (supabase as any).rpc("admin_set_support_agent", {
      _user_email: email.trim(), _is_active: true,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Agent added"); setEmail(""); qc.invalidateQueries({ queryKey: ["admin-support-stats"] }); }
  };

  const remove = async (userId: string) => {
    if (!confirm("Remove this support executive?")) return;
    const { error } = await (supabase as any).rpc("admin_remove_support_agent", { _user_id: userId });
    if (error) toast.error(error.message);
    else { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["admin-support-stats"] }); }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="font-display text-3xl font-extrabold">Support</h1>

      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Total tickets" value={stats.data?.total ?? 0} />
        <Stat label="Open" value={stats.data?.open ?? 0} />
        <Stat label="Resolved" value={stats.data?.resolved ?? 0} />
        <Stat label="Closed" value={stats.data?.closed ?? 0} />
        <Stat label="Avg resolution (min)" value={Math.round(Number(stats.data?.avg_resolution_minutes ?? 0))} />
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <h2 className="font-bold">Add Support Executive</h2>
        <div className="flex gap-2">
          <Input placeholder="user@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button onClick={addAgent} disabled={busy} className="gradient-primary text-primary-foreground">Add</Button>
        </div>
        <p className="text-xs text-muted-foreground">User must have signed up first. They'll receive the `support` role and gain access to /support.</p>
      </section>

      <section className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border font-bold">Executive performance</div>
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-xs uppercase">
            <tr><th className="text-left p-3">Agent</th><th className="text-left p-3">Active</th><th className="text-right p-3">Open</th><th className="text-right p-3">Resolved</th><th className="text-right p-3">Avg min</th><th /></tr>
          </thead>
          <tbody>
            {(stats.data?.agents ?? []).map((a: any) => (
              <tr key={a.user_id} className="border-t border-border">
                <td className="p-3 font-semibold">{a.display_name}</td>
                <td className="p-3">{a.is_active ? "Yes" : "No"}</td>
                <td className="p-3 text-right">{a.assigned}</td>
                <td className="p-3 text-right">{a.resolved}</td>
                <td className="p-3 text-right">{Math.round(Number(a.avg_minutes ?? 0))}</td>
                <td className="p-3 text-right">
                  <Button size="icon" variant="ghost" onClick={() => remove(a.user_id)}><Trash2 className="h-4 w-4" /></Button>
                </td>
              </tr>
            ))}
            {(stats.data?.agents ?? []).length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground text-sm">No support executives yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground font-semibold">{label}</div>
      <div className="font-display text-2xl font-extrabold mt-1">{value}</div>
    </div>
  );
}
