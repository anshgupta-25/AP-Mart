import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, Crown, ShieldAlert, Store, Bike, Headphones, User, Ban, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/super-admin/access")({
  head: () => ({
    meta: [
      { title: "Roles & Access — AP Mart Super Admin" },
      { name: "description", content: "Promote, demote, suspend and restore any AP Mart account across every role tier." },
      { property: "og:title", content: "Roles & Access — AP Mart Super Admin" },
      { property: "og:description", content: "Manage every role tier on the AP Mart platform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccessPage,
});

type UserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  created_at: string;
  roles: string[];
};

const ROLES = [
  { key: "super_admin", label: "Super Admin", icon: Crown, tone: "bg-amber-100 text-amber-700" },
  { key: "admin", label: "Admin", icon: ShieldAlert, tone: "bg-emerald-100 text-emerald-700" },
  { key: "support", label: "Support", icon: Headphones, tone: "bg-violet-100 text-violet-700" },
  { key: "shopkeeper", label: "Shopkeeper", icon: Store, tone: "bg-blue-100 text-blue-700" },
  { key: "delivery", label: "Delivery", icon: Bike, tone: "bg-orange-100 text-orange-700" },
  { key: "customer", label: "Customer", icon: User, tone: "bg-slate-100 text-slate-700" },
] as const;

function AccessPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [pending, setPending] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["super-admin", "users"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_users");
      if (error) throw error;
      return (data ?? []) as unknown as UserRow[];
    },
  });

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = data ?? [];
    if (!term) return list.slice(0, 100);
    return list
      .filter((u) =>
        [u.full_name, u.email, u.phone].some((v) => (v ?? "").toLowerCase().includes(term)),
      )
      .slice(0, 100);
  }, [data, q]);

  const toggleRole = useMutation({
    mutationFn: async ({ userId, role, has }: { userId: string; role: string; has: boolean }) => {
      const fn = has ? "admin_remove_role" : "admin_assign_role";
      const { error } = await supabase.rpc(fn as any, { _user_id: userId, _role: role as any });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.has ? "Role removed" : "Role granted");
      qc.invalidateQueries({ queryKey: ["super-admin"] });
    },
    onError: (e: any) => toast.error(cleanError(e?.message)),
    onSettled: () => setPending(null),
  });

  const setStatus = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: "active" | "suspended" }) => {
      const { error } = await supabase.rpc("admin_set_user_status", { _user_id: userId, _status: status });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Account status updated");
      qc.invalidateQueries({ queryKey: ["super-admin"] });
    },
    onError: (e: any) => toast.error(cleanError(e?.message)),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Roles &amp; Access</h1>
        <p className="text-sm text-muted-foreground">
          Tap a role chip to grant or revoke it. Admin and Super Admin tiers can only be changed here.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email or phone"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-11 rounded-xl pl-10"
        />
      </div>

      {error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {cleanError((error as any)?.message)}
        </div>
      ) : isLoading ? (
        <div className="grid place-items-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No accounts match that search.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((u) => {
            const suspended = u.status === "suspended" || u.status === "disabled";
            const isSelf = u.id === user?.id;
            return (
              <div key={u.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold truncate">{u.full_name || "Unnamed user"}</span>
                      {isSelf && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">You</span>}
                      {suspended && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">Suspended</span>}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{u.email || u.phone || "—"}</div>
                  </div>
                  <Button
                    size="sm"
                    variant={suspended ? "outline" : "ghost"}
                    disabled={isSelf || setStatus.isPending}
                    onClick={() => setStatus.mutate({ userId: u.id, status: suspended ? "active" : "suspended" })}
                    className="shrink-0 text-xs font-bold"
                  >
                    {suspended ? (<><RotateCcw className="h-3.5 w-3.5 mr-1" /> Restore</>) : (<><Ban className="h-3.5 w-3.5 mr-1" /> Suspend</>)}
                  </Button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {ROLES.map((r) => {
                    const has = (u.roles ?? []).includes(r.key);
                    const key = `${u.id}:${r.key}`;
                    const busy = pending === key && toggleRole.isPending;
                    return (
                      <button
                        key={r.key}
                        type="button"
                        disabled={busy}
                        onClick={() => { setPending(key); toggleRole.mutate({ userId: u.id, role: r.key, has }); }}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold transition border",
                          has ? `${r.tone} border-transparent` : "bg-transparent text-muted-foreground border-border hover:border-primary/40",
                          busy && "opacity-60",
                        )}
                      >
                        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <r.icon className="h-3 w-3" />}
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function cleanError(msg?: string) {
  if (!msg) return "Something went wrong";
  if (/Super Admin only/i.test(msg)) return msg.replace(/^.*?(Super Admin only)/i, "$1");
  if (/last Super Admin/i.test(msg)) return "You cannot remove the last Super Admin account.";
  if (/Forbidden/i.test(msg)) return "You do not have permission for this action.";
  return msg;
}
