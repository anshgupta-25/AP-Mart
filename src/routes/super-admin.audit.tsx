import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ScrollText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/super-admin/audit")({
  head: () => ({
    meta: [
      { title: "Security Audit Log — AP Mart Super Admin" },
      {
        name: "description",
        content:
          "Immutable record of every role change, suspension and privileged action on AP Mart.",
      },
      { property: "og:title", content: "Security Audit Log — AP Mart Super Admin" },
      {
        property: "og:description",
        content: "Immutable record of every privileged action on the platform.",
      },
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
    <div className="space-y-5">
      <div>
        <h1 className="large-title">Security audit log</h1>
        <p className="mt-0.5 text-small text-muted-foreground">
          Append-only. Entries cannot be edited or deleted by anyone, including Super Admins.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-small text-destructive">
          {(error as any)?.message ?? "Could not load the audit log"}
        </div>
      ) : isLoading ? (
        <div className="grid place-items-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (data ?? []).length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-tint-mint text-primary-ink">
            <ScrollText className="h-5 w-5" />
          </span>
          <p className="mt-3 text-small text-muted-foreground">
            No privileged actions recorded yet.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
          <div className="md:hidden">
            {(data ?? []).map((row: any) => (
              <div key={row.id} className="border-b border-border/70 px-4 py-3 last:border-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-body font-medium">
                    {LABELS[row.event_type] ?? row.event_type.replace(/_/g, " ")}
                  </span>
                  <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-caption font-semibold text-muted-foreground">
                    {row.actor_role ?? "—"}
                  </span>
                </div>
                <div className="mt-0.5 text-small text-muted-foreground">
                  {row.detail?.role
                    ? String(row.detail.role)
                    : row.detail?.status
                      ? String(row.detail.status)
                      : "—"}{" "}
                  · {new Date(row.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
          <table className="hidden w-full text-left text-small md:table">
            <thead className="bg-secondary/60 text-small font-medium text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Event</th>
                <th className="px-4 py-2.5 font-medium">Detail</th>
                <th className="px-4 py-2.5 font-medium">By</th>
                <th className="px-4 py-2.5 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((row: any) => (
                <tr key={row.id} className="border-t border-border/70 hover:bg-secondary/50">
                  <td className="px-4 py-2.5 font-medium">
                    {LABELS[row.event_type] ?? row.event_type.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {row.detail?.role
                      ? String(row.detail.role)
                      : row.detail?.status
                        ? String(row.detail.status)
                        : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{row.actor_role ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {new Date(row.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
