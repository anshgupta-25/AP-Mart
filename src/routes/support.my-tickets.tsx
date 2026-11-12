import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
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
      const { data } = await (supabase as any).from("support_tickets")
        .select("id, ticket_number, title, category, status, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
    enabled: !!user,
  });

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold">My support tickets</h1>
        <Button onClick={() => setOpen(true)} className="gradient-primary text-primary-foreground">
          <Plus className="h-4 w-4 mr-1" /> New ticket
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {(tickets.data ?? []).length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            You haven't created any tickets yet.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {tickets.data!.map(t => (
              <li key={t.id}>
                <Link to="/support/ticket/$id" params={{ id: t.id }} className="block p-4 hover:bg-secondary/40">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold truncate">{t.title}</span>
                    <span className="text-[10px] uppercase rounded-full bg-secondary px-2 py-0.5 font-bold">{t.status.replace(/_/g, " ")}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {t.ticket_number} · {t.category.replace(/_/g, " ")} · {new Date(t.created_at).toLocaleString()}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <SupportTicketForm open={open} onOpenChange={setOpen} onCreated={(id) => nav({ to: "/support/ticket/$id" as any, params: { id } as any })} />
    </div>
  );
}
