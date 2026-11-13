import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LifeBuoy, Plus } from "lucide-react";
import { SupportTicketForm } from "@/components/SupportTicketForm";

export const Route = createFileRoute("/support/my-tickets")({
  head: () => ({ meta: [{ title: "My Tickets — AP Mart" }] }),
  component: Page,
});

function Page() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  const tickets = useQuery({
    queryKey: ["my-tickets", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await (supabase as any)
        .from("support_tickets")
        .select("id, ticket_number, title, category, status, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
    enabled: !!user,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 pb-6 pt-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="large-title">Support</h1>
        <Button size="sm" onClick={() => setOpen(true)} className="rounded-full px-3.5">
          <Plus className="h-4 w-4" /> New ticket
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
        {(tickets.data ?? []).length === 0 ? (
          <div className="p-8 text-center">
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-tint-sky text-foreground/70">
              <LifeBuoy className="h-5 w-5" />
            </div>
            <div className="mt-2.5 text-body font-semibold">No tickets yet</div>
            <p className="mt-0.5 text-small text-muted-foreground">
              Need help? Raise a ticket and we'll get back to you.
            </p>
            <Button onClick={() => setOpen(true)} className="mt-4 h-9 rounded-full px-5">
              New ticket
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {tickets.data!.map((t) => (
              <li key={t.id}>
                <Link
                  to="/support/ticket/$id"
                  params={{ id: t.id }}
                  className="press block min-h-12 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-body font-medium">{t.title}</span>
                    <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-caption font-semibold capitalize">
                      {t.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="mt-0.5 text-caption text-muted-foreground">
                    {t.ticket_number} · {t.category.replace(/_/g, " ")} ·{" "}
                    {new Date(t.created_at).toLocaleString()}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <SupportTicketForm
        open={open}
        onOpenChange={setOpen}
        onCreated={(id) => nav({ to: "/support/ticket/$id" as any, params: { id } as any })}
      />
    </div>
  );
}
