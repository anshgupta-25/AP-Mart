import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, ShieldCheck, Store as StoreIcon, Truck, User as UserIcon, LifeBuoy, X, Ban, Check, Tag } from "lucide-react";
import { toast } from "sonner";
import { RoleShell } from "@/components/RoleShell";
import { ADMIN_NAV } from "./admin.dashboard";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/customers")({
  component: () => (
    <RoleShell role="admin" nav={ADMIN_NAV} requireRoles={["admin"]}>
      <CustomersPage />
    </RoleShell>
  ),
});

type AppRole = "super_admin" | "admin" | "customer" | "shopkeeper" | "delivery" | "support";
/** Roles an admin may assign from this screen (super_admin is intentionally excluded). */
const ROLES: AppRole[] = ["admin", "shopkeeper", "delivery", "support", "customer"];
const ICONS: Partial<Record<AppRole, any>> = { super_admin: ShieldCheck, admin: Shield, shopkeeper: StoreIcon, delivery: Truck, support: LifeBuoy, customer: UserIcon };
const iconFor = (r: AppRole) => ICONS[r] ?? Tag;

function CustomersPage() {
  const qc = useQueryClient();
  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_users");
      if (error) throw error;
      // Defence in depth: the RPC already hides Super Admin accounts/roles from
      // non-Super-Admins, but never render the protected role even if it leaks.
      return (data ?? [])
        .filter((u: any) => !(u.roles ?? []).includes("super_admin"))
        .map((u: any) => ({ ...u, roles: (u.roles ?? []).filter((r: string) => r !== "super_admin") }));
    },
  });


  const assign = useMutation({
    mutationFn: async ({ user_id, role }: { user_id: string; role: AppRole }) => {
      if (role === "super_admin") throw new Error("Not permitted");
      const { error } = await supabase.rpc("admin_assign_role", { _user_id: user_id, _role: role });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Role added"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async ({ user_id, role }: { user_id: string; role: AppRole }) => {
      if (role === "super_admin") throw new Error("Not permitted");
      const { error } = await supabase.rpc("admin_remove_role", { _user_id: user_id, _role: role });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Role removed"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e: any) => toast.error(e.message),
  });


  const setStatus = useMutation({
    mutationFn: async ({ user_id, status }: { user_id: string; status: "active" | "disabled" }) => {
      const { error } = await supabase.rpc("admin_set_user_status", { _user_id: user_id, _status: status });
      if (error) throw error;
    },
    onSuccess: (_d, v) => { toast.success(v.status === "disabled" ? "User disabled" : "User enabled"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Users & roles</h1>
        <p className="text-muted-foreground mt-1">Assign admin, shopkeeper, delivery or customer roles.</p>
      </div>

      {users.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <>
          <div className="hidden md:block rounded-2xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-left">
                <tr>
                  <th className="p-3">Name / Email</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Joined</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Roles</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(users.data ?? []).map((u: any) => (
                  <tr key={u.id} className="border-t border-border align-top">
                    <td className="p-3 font-medium">
                      {u.full_name || "—"}
                      <div className="text-xs text-muted-foreground">{u.email || "—"}</div>
                      {u.pending_request_count > 0 && <div className="text-[10px] mt-0.5 text-yellow-700 dark:text-yellow-300 font-bold">{u.pending_request_count} pending request</div>}
                    </td>
                    <td className="p-3 text-muted-foreground">{u.phone || "—"}</td>
                    <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold ${u.status === "disabled" ? "bg-destructive/15 text-destructive" : "bg-green-500/15 text-green-700 dark:text-green-300"}`}>
                        {u.status === "disabled" ? "Disabled" : "Active"}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1.5">
                        {(u.roles ?? []).length === 0 && <span className="text-xs text-muted-foreground">No roles</span>}
                        {(u.roles ?? []).map((r: AppRole) => {
                          const Icon = iconFor(r);
                          return (
                            <span key={r} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-1 text-xs font-semibold">
                              <Icon className="h-3 w-3" />{r}
                              <button onClick={() => remove.mutate({ user_id: u.id, role: r })} className="ml-1 hover:bg-primary/20 rounded-full">
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {ROLES.filter((r) => !(u.roles ?? []).includes(r)).map((r) => (
                          <Button key={r} size="sm" variant="outline" className="h-6 text-[10px] px-2"
                            onClick={() => assign.mutate({ user_id: u.id, role: r })}>
                            + {r}
                          </Button>
                        ))}
                      </div>
                    </td>
                    <td className="p-3">
                      {u.status === "disabled" ? (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setStatus.mutate({ user_id: u.id, status: "active" })}>
                          <Check className="h-3 w-3 mr-1"/>Enable
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setStatus.mutate({ user_id: u.id, status: "disabled" })}>
                          <Ban className="h-3 w-3 mr-1"/>Disable
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {(users.data ?? []).map((u: any) => (
              <div key={u.id} className="rounded-2xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold">{u.full_name || "—"}</div>
                    <div className="text-[11px] text-muted-foreground">{u.email || "—"}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{u.phone || "No phone"}</div>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-bold ${u.status === "disabled" ? "bg-destructive/15 text-destructive" : "bg-green-500/15 text-green-700 dark:text-green-300"}`}>
                    {u.status === "disabled" ? "Disabled" : "Active"}
                  </span>
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase text-muted-foreground mb-1.5">Current roles</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(u.roles ?? []).length === 0 && <span className="text-xs text-muted-foreground">No roles</span>}
                    {(u.roles ?? []).map((r: AppRole) => {
                      const Icon = iconFor(r);
                      return (
                        <span key={r} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-1 text-xs font-semibold">
                          <Icon className="h-3 w-3" />{r}
                          <button onClick={() => remove.mutate({ user_id: u.id, role: r })} className="ml-1 hover:bg-primary/20 rounded-full">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
                {ROLES.filter((r) => !(u.roles ?? []).includes(r)).length > 0 && (
                  <div>
                    <div className="text-[11px] font-bold uppercase text-muted-foreground mb-1.5">Add role</div>
                    <div className="flex flex-wrap gap-1.5">
                      {ROLES.filter((r) => !(u.roles ?? []).includes(r)).map((r) => (
                        <Button key={r} size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => assign.mutate({ user_id: u.id, role: r })}>
                          + {r}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                {u.status === "disabled" ? (
                  <Button size="sm" variant="outline" className="w-full h-8 text-xs" onClick={() => setStatus.mutate({ user_id: u.id, status: "active" })}>
                    <Check className="h-3 w-3 mr-1"/>Enable user
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="w-full h-8 text-xs text-destructive border-destructive/30" onClick={() => setStatus.mutate({ user_id: u.id, status: "disabled" })}>
                    <Ban className="h-3 w-3 mr-1"/>Disable user
                  </Button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
