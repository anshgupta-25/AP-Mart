import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Shield,
  ShieldCheck,
  Store as StoreIcon,
  Truck,
  User as UserIcon,
  LifeBuoy,
  X,
  Ban,
  Check,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/customers")({
  component: CustomersPage,
});

type AppRole = "super_admin" | "admin" | "customer" | "shopkeeper" | "delivery" | "support";
/** Roles an admin may assign from this screen (super_admin is intentionally excluded). */
const ROLES: AppRole[] = ["admin", "shopkeeper", "delivery", "support", "customer"];
const ICONS: Partial<Record<AppRole, LucideIcon>> = {
  super_admin: ShieldCheck,
  admin: Shield,
  shopkeeper: StoreIcon,
  delivery: Truck,
  support: LifeBuoy,
  customer: UserIcon,
};
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
        .filter((u) => !(u.roles ?? []).includes("super_admin"))
        .map((u) => ({
          ...u,
          roles: (u.roles ?? []).filter((r: string) => r !== "super_admin"),
        }));
    },
  });

  const assign = useMutation({
    mutationFn: async ({ user_id, role }: { user_id: string; role: AppRole }) => {
      if (role === "super_admin") throw new Error("Not permitted");
      const { error } = await supabase.rpc("admin_assign_role", { _user_id: user_id, _role: role });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role added");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async ({ user_id, role }: { user_id: string; role: AppRole }) => {
      if (role === "super_admin") throw new Error("Not permitted");
      const { error } = await supabase.rpc("admin_remove_role", { _user_id: user_id, _role: role });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role removed");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ user_id, status }: { user_id: string; status: "active" | "disabled" }) => {
      const { error } = await supabase.rpc("admin_set_user_status", {
        _user_id: user_id,
        _status: status,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.status === "disabled" ? "User disabled" : "User enabled");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-4 md:px-6 md:py-6">
      <div>
        <h1 className="large-title">Users & roles</h1>
        <p className="mt-0.5 text-meta text-muted-foreground">
          Assign admin, shopkeeper, delivery or customer roles.
        </p>
      </div>

      {users.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 rounded-xl shimmer" />
          ))}
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-border/70 bg-card md:block">
            <table className="w-full text-sm">
              <thead className="text-left text-small font-medium text-muted-foreground">
                <tr className="border-b border-border/70">
                  <th className="p-4 font-medium">Name / Email</th>
                  <th className="p-4 font-medium">Phone</th>
                  <th className="p-4 font-medium">Joined</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium">Roles</th>
                  <th className="p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(users.data ?? []).map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-border/70 align-top transition-colors last:border-0 hover:bg-secondary/50"
                  >
                    <td className="p-4 font-medium">
                      {u.full_name || "—"}
                      <div className="text-xs text-muted-foreground">{u.email || "—"}</div>
                      {u.pending_request_count > 0 && (
                        <div className="mt-1 text-caption font-semibold text-[oklch(0.5_0.12_70)]">
                          {u.pending_request_count} pending request
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-muted-foreground">{u.phone || "—"}</td>
                    <td className="whitespace-nowrap p-4 text-xs text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-caption font-semibold ${u.status === "disabled" ? "bg-tint-rose text-[oklch(0.45_0.12_15)]" : "bg-primary-soft text-primary-ink"}`}
                      >
                        {u.status === "disabled" ? "Disabled" : "Active"}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1.5">
                        {(u.roles ?? []).length === 0 && (
                          <span className="text-xs text-muted-foreground">No roles</span>
                        )}
                        {(u.roles ?? []).map((r: AppRole) => {
                          const Icon = iconFor(r);
                          return (
                            <span
                              key={r}
                              className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary-ink"
                            >
                              <Icon className="h-3 w-3" />
                              {r}
                              <button
                                onClick={() => remove.mutate({ user_id: u.id, role: r })}
                                className="ml-1 hover:bg-primary/20 rounded-full"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {ROLES.filter((r) => !(u.roles ?? []).includes(r)).map((r) => (
                          <Button
                            key={r}
                            size="sm"
                            variant="secondary"
                            className="h-7 rounded-full px-3 text-caption"
                            onClick={() => assign.mutate({ user_id: u.id, role: r })}
                          >
                            + {r}
                          </Button>
                        ))}
                      </div>
                    </td>
                    <td className="p-4">
                      {u.status === "disabled" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setStatus.mutate({ user_id: u.id, status: "active" })}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Enable
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="text-destructive"
                          onClick={() => setStatus.mutate({ user_id: u.id, status: "disabled" })}
                        >
                          <Ban className="h-3 w-3 mr-1" />
                          Disable
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {(users.data ?? []).map((u) => (
              <div key={u.id} className="space-y-4 rounded-xl border border-border/70 bg-card p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-subtitle font-semibold">{u.full_name || "—"}</div>
                    <div className="text-small text-muted-foreground">{u.email || "—"}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {u.phone || "No phone"}
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-caption font-semibold ${u.status === "disabled" ? "bg-tint-rose text-[oklch(0.45_0.12_15)]" : "bg-primary-soft text-primary-ink"}`}
                  >
                    {u.status === "disabled" ? "Disabled" : "Active"}
                  </span>
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1.5">
                    Current roles
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(u.roles ?? []).length === 0 && (
                      <span className="text-xs text-muted-foreground">No roles</span>
                    )}
                    {(u.roles ?? []).map((r: AppRole) => {
                      const Icon = iconFor(r);
                      return (
                        <span
                          key={r}
                          className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary-ink"
                        >
                          <Icon className="h-3 w-3" />
                          {r}
                          <button
                            onClick={() => remove.mutate({ user_id: u.id, role: r })}
                            className="ml-1 hover:bg-primary/20 rounded-full"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
                {ROLES.filter((r) => !(u.roles ?? []).includes(r)).length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1.5">Add role</div>
                    <div className="flex flex-wrap gap-1.5">
                      {ROLES.filter((r) => !(u.roles ?? []).includes(r)).map((r) => (
                        <Button
                          key={r}
                          size="sm"
                          variant="secondary"
                          className="h-8 rounded-full px-3 text-xs"
                          onClick={() => assign.mutate({ user_id: u.id, role: r })}
                        >
                          + {r}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                {u.status === "disabled" ? (
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => setStatus.mutate({ user_id: u.id, status: "active" })}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Enable user
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    className="w-full text-destructive"
                    onClick={() => setStatus.mutate({ user_id: u.id, status: "disabled" })}
                  >
                    <Ban className="h-3 w-3 mr-1" />
                    Disable user
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
