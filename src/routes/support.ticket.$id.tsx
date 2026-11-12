import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { StorageImg, StorageLink } from "@/components/StorageImg";

export const Route = createFileRoute("/support/ticket/$id")({
  head: () => ({ meta: [{ title: "Ticket — AP Mart" }] }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ch = supabase.channel("my-ticket-" + id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages", filter: `ticket_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["my-ticket-msgs", id] }))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "support_tickets", filter: `id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["my-ticket", id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  const ticket = useQuery({
    queryKey: ["my-ticket", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("support_tickets")
        .select("id, ticket_number, title, description, category, status, created_at, user_id, resolved_at, resolution_notes, resolved_by")
        .eq("id", id).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const messages = useQuery({
    queryKey: ["my-ticket-msgs", id],
    queryFn: async () => {
      const { data } = await (supabase as any).from("support_messages")
        .select("id, body, sender_role, created_at, is_internal_note")
        .eq("ticket_id", id).order("created_at", { ascending: true });
      return (data ?? []) as any[];
    },
  });

  const attachments = useQuery({
    queryKey: ["my-ticket-att", id],
    queryFn: async () => {
      const { data } = await (supabase as any).from("ticket_attachments")
        .select("id, file_url, file_name").eq("ticket_id", id);
      return (data ?? []) as any[];
    },
  });

  const send = async () => {
    if (!reply.trim()) return;
    setBusy(true);
    const { error } = await (supabase as any).rpc("post_ticket_message", {
      _ticket_id: id, _body: reply.trim(), _is_internal: false,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else { setReply(""); qc.invalidateQueries({ queryKey: ["my-ticket-msgs", id] }); }
  };

  if (ticket.isLoading) return <div className="p-8 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!ticket.data) return <div className="p-6 text-sm text-muted-foreground">Ticket not found.</div>;

  const closed = ticket.data.status === "closed";
  const isOwner = ticket.data.user_id === user?.id;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <div className="text-xs text-muted-foreground font-semibold">{ticket.data.ticket_number}</div>
            <h1 className="font-display text-xl font-extrabold">{ticket.data.title}</h1>
            <div className="text-xs text-muted-foreground mt-0.5">{ticket.data.category.replace(/_/g, " ")} · {new Date(ticket.data.created_at).toLocaleString()}</div>
          </div>
          <span className="text-xs uppercase rounded-full bg-secondary px-2 py-1 font-bold">{ticket.data.status.replace(/_/g, " ")}</span>
        </div>
        <p className="mt-3 text-sm whitespace-pre-wrap">{ticket.data.description}</p>
        {(attachments.data ?? []).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {attachments.data!.map(a => (
              <StorageLink key={a.id} href={a.file_url} target="_blank" rel="noreferrer">
                <StorageImg loading="lazy" decoding="async" src={a.file_url} alt={a.file_name ?? ""} className="h-20 w-20 object-cover rounded-lg border border-border" />
              </StorageLink>
            ))}
          </div>
        )}
        {ticket.data.status === "resolved" && (
          <div className="mt-3 rounded-xl bg-green-500/10 border border-green-500/30 p-3 text-sm space-y-1">
            <div className="text-[10px] uppercase font-bold text-green-700 dark:text-green-300">Resolution</div>
            {ticket.data.resolution_notes
              ? <div className="whitespace-pre-wrap">{ticket.data.resolution_notes}</div>
              : <div className="text-muted-foreground">Marked resolved by our team.</div>}
            <div className="text-xs text-muted-foreground">
              Resolved {ticket.data.resolved_at ? new Date(ticket.data.resolved_at).toLocaleString() : ""}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
        {(messages.data ?? []).filter(m => !m.is_internal_note).map(m => (
          <div key={m.id} className={"rounded-xl p-3 text-sm " + (m.sender_role === "support" ? "bg-primary/10 border border-primary/30" : "bg-secondary border border-border")}>
            <div className="text-[10px] uppercase font-bold text-muted-foreground">{m.sender_role === "support" ? "Support" : "You"} · {new Date(m.created_at).toLocaleString()}</div>
            <div className="mt-1 whitespace-pre-wrap">{m.body}</div>
          </div>
        ))}
        {((messages.data ?? []).filter(m => !m.is_internal_note).length === 0) && (
          <div className="text-xs text-muted-foreground">No replies yet. We'll respond soon.</div>
        )}

        {isOwner && !closed && (
          <div className="pt-2 space-y-2">
            <Textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a reply…" />
            <div className="flex justify-end">
              <Button onClick={send} disabled={busy || !reply.trim()} className="gradient-primary text-primary-foreground">
                {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Send
              </Button>
            </div>
          </div>
        )}
        {closed && <div className="text-xs text-muted-foreground pt-2">This ticket is closed.</div>}
      </div>
    </div>
  );
}
