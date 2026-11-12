import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ScrollText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/super-admin/audit")({
  head: () => ({
    meta: [
      { title: "Security Audit Log — AP Mart Super Admin" },
      { name: "description", content: "Immutable record of every role change, suspension and privileged action on AP Mart." },
      { property: "og:title", content: "Security Audit Log — AP Mart Super Admin" },
      { property: "og:description", content: "Immutable record of every privileged action on the platform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuditPage,
});

const LABELS: Record<string, string> = {
  role_assigned: "Role granted",
  role_removed: "Role revoked",
  account_activated: "Account restored",
  account_suspended: "Account suspended",
};

function AuditPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["super-admin", "audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("security_audit_log")
        .select("id, event_type, actor_id, actor_role, target_user_id, detail, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Security audit log</h1>
        <p className="text-sm text-muted-foreground">
          Append-only. Entries cannot be edited or deleted by anyone, including Super Admins.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {(error as any)?.message ?? "Could not load the audit log"}
        </div>
      ) : isLoading ? (
        <div className="grid place-items-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (data ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <ScrollText className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No privileged actions recorded yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-bold">Event</th>
                <th className="px-3 py-2 font-bold">Detail</th>
                <th className="px-3 py-2 font-bold">By</th>
                <th className="px-3 py-2 font-bold">When</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((row: any) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-3 py-2 font-semibold">{LABELS[row.event_type] ?? row.event_type.replace(/_/g, " ")}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {row.detail?.role ? String(row.detail.role) : row.detail?.status ? String(row.detail.status) : "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{row.actor_role ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{new Date(row.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
