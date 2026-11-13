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
    const ch = supabase
      .channel("my-ticket-" + id)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `ticket_id=eq.${id}`,
        },
        () => qc.invalidateQueries({ queryKey: ["my-ticket-msgs", id] }),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "support_tickets", filter: `id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["my-ticket", id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, qc]);

  const ticket = useQuery({
    queryKey: ["my-ticket", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("support_tickets")
        .select(
          "id, ticket_number, title, description, category, status, created_at, user_id, resolved_at, resolution_notes, resolved_by",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const messages = useQuery({
    queryKey: ["my-ticket-msgs", id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("support_messages")
        .select("id, body, sender_role, created_at, is_internal_note")
        .eq("ticket_id", id)
        .order("created_at", { ascending: true });
      return (data ?? []) as any[];
    },
  });

  const attachments = useQuery({
    queryKey: ["my-ticket-att", id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("ticket_attachments")
        .select("id, file_url, file_name")
        .eq("ticket_id", id);
      return (data ?? []) as any[];
    },
  });

  const send = async () => {
    if (!reply.trim()) return;
    setBusy(true);
    const { error } = await (supabase as any).rpc("post_ticket_message", {
      _ticket_id: id,
      _body: reply.trim(),
      _is_internal: false,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      setReply("");
      qc.invalidateQueries({ queryKey: ["my-ticket-msgs", id] });
    }
  };

  if (ticket.isLoading)
    return (
      <div className="grid place-items-center p-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  if (!ticket.data)
    return (
      <div className="p-10 text-center text-body text-muted-foreground">Ticket not found.</div>
    );

  const closed = ticket.data.status === "closed";
  const isOwner = ticket.data.user_id === user?.id;

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 pb-6 pt-4">
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="eyebrow">{ticket.data.ticket_number}</div>
            <h1 className="mt-1 text-subtitle font-bold leading-tight tracking-tight">
              {ticket.data.title}
            </h1>
            <div className="mt-1 text-small text-muted-foreground">
              {ticket.data.category.replace(/_/g, " ")} ·{" "}
              {new Date(ticket.data.created_at).toLocaleString()}
            </div>
          </div>
          <span className="rounded-full bg-secondary px-2.5 py-1 text-caption font-semibold capitalize">
            {ticket.data.status.replace(/_/g, " ")}
          </span>
        </div>
        <p className="mt-3 whitespace-pre-wrap text-body leading-relaxed">
          {ticket.data.description}
        </p>
        {(attachments.data ?? []).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {attachments.data!.map((a) => (
              <StorageLink key={a.id} href={a.file_url} target="_blank" rel="noreferrer">
                <StorageImg
                  loading="lazy"
                  decoding="async"
                  src={a.file_url}
                  alt={a.file_name ?? ""}
                  className="h-20 w-20 rounded-lg object-cover"
                />
              </StorageLink>
            ))}
          </div>
        )}
        {ticket.data.status === "resolved" && (
          <div className="mt-3 space-y-1 rounded-lg bg-primary-soft p-3.5 text-small">
            <div className="text-small font-semibold text-primary-ink">Resolution</div>
            {ticket.data.resolution_notes ? (
              <div className="whitespace-pre-wrap">{ticket.data.resolution_notes}</div>
            ) : (
              <div className="text-muted-foreground">Marked resolved by our team.</div>
            )}
            <div className="text-xs text-muted-foreground">
              Resolved{" "}
              {ticket.data.resolved_at ? new Date(ticket.data.resolved_at).toLocaleString() : ""}
            </div>
          </div>
        )}
      </div>

      <section className="space-y-3">
        <h2 className="section-title">Conversation</h2>
        <div className="space-y-3">
          {(messages.data ?? [])
            .filter((m) => !m.is_internal_note)
            .map((m) => {
              const support = m.sender_role === "support";
              return (
                <div key={m.id} className={"flex " + (support ? "justify-start" : "justify-end")}>
                  <div
                    className={
                      "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-small " +
                      (support ? "rounded-bl-md bg-secondary" : "rounded-br-md bg-primary-soft")
                    }
                  >
                    <div className="text-caption font-semibold text-muted-foreground">
                      {support ? "Support" : "You"} · {new Date(m.created_at).toLocaleString()}
                    </div>
                    <div className="mt-1 whitespace-pre-wrap leading-relaxed">{m.body}</div>
                  </div>
                </div>
              );
            })}
          {(messages.data ?? []).filter((m) => !m.is_internal_note).length === 0 && (
            <div className="rounded-xl border border-border/70 bg-card p-5 text-center text-small text-muted-foreground">
              No replies yet. We'll respond soon.
            </div>
          )}
          {closed && (
            <div className="pt-2 text-center text-small text-muted-foreground">
              This ticket is closed.
            </div>
          )}
        </div>
      </section>

      {isOwner && !closed && (
        <div className="bar-blur hairline-t pb-safe sticky bottom-0 -mx-4 space-y-2.5 px-4 py-3">
          <Textarea
            rows={2}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Write a reply…"
          />
          <Button
            onClick={send}
            disabled={busy || !reply.trim()}
            className="h-11 w-full rounded-xl"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Send reply
          </Button>
        </div>
      )}
    </div>
  );
}
