import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Phone, Mail, MapPin, ShoppingBag, Store, Bike, Lock } from "lucide-react";
import { toast } from "sonner";
import { rupees } from "@/lib/format";
import { StorageImg, StorageLink } from "@/components/StorageImg";

export const Route = createFileRoute("/support/tickets/$id")({
  head: () => ({ meta: [{ title: "Ticket — AP Mart" }] }),
  component: Page,
});

const STATUS_OPTIONS = ["open", "assigned", "in_progress", "resolved", "closed"] as const;

function Page() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [resolveNotes, setResolveNotes] = useState("");
  const [showResolve, setShowResolve] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ch = supabase
      .channel("ticket-" + id)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_messages", filter: `ticket_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["ticket-messages", id] }),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "support_tickets", filter: `id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["ticket-context", id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, qc]);

  const ctx = useQuery({
    queryKey: ["ticket-context", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("support_ticket_context", {
        _ticket_id: id,
      });
      if (error) throw error;
      return data as any;
    },
  });

  const messages = useQuery({
    queryKey: ["ticket-messages", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("support_messages")
        .select("id, body, sender_id, sender_role, is_internal_note, created_at")
        .eq("ticket_id", id)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  const agents = useQuery({
    queryKey: ["support-agents-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("support_agents")
        .select("user_id, display_name, is_active")
        .eq("is_active", true);
      return data ?? [];
    },
  });

  const t = ctx.data?.ticket;

  const send = async () => {
    if (!reply.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc("post_ticket_message", {
      _ticket_id: id,
      _body: reply.trim(),
      _is_internal: internal,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      setReply("");
      qc.invalidateQueries({ queryKey: ["ticket-messages", id] });
    }
  };

  const setStatus = async (s: string, notes?: string) => {
    const payload: any = { _ticket_id: id, _status: s };
    if (notes !== undefined) payload._notes = notes;
    const { error } = await supabase.rpc("update_ticket_status", payload);
    if (error) toast.error(error.message);
    else {
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["ticket-context", id] });
    }
  };

  const assign = async (agentId: string) => {
    const { error } = await supabase.rpc("assign_ticket", {
      _ticket_id: id,
      _agent_id: agentId,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Assigned");
      qc.invalidateQueries({ queryKey: ["ticket-context", id] });
    }
  };

  if (ctx.isLoading)
    return (
      <div className="grid place-items-center p-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  if (ctx.error || !t)
    return <div className="p-6 text-center text-body text-destructive">Could not load ticket.</div>;

  const creator = ctx.data?.creator;
  const shop = ctx.data?.shop;
  const partner = ctx.data?.partner;
  const role = t.role_at_creation;

  return (
    <div className="mx-auto grid max-w-6xl gap-4 px-4 pb-8 pt-4 md:px-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div className="rounded-xl border border-border/70 bg-card p-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <div className="eyebrow capitalize">
                {t.ticket_number} · {role}
              </div>
              <h1 className="mt-1 text-subtitle font-bold leading-tight tracking-tight">
                {t.title}
              </h1>
              <div className="mt-1 text-small text-muted-foreground">
                {t.category.replace(/_/g, " ")} · created {new Date(t.created_at).toLocaleString()}
              </div>
            </div>
            <span className="rounded-full bg-secondary px-2.5 py-1 text-caption font-semibold capitalize">
              {t.status.replace(/_/g, " ")}
            </span>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-body leading-relaxed">{t.description}</p>
          {(ctx.data?.attachments ?? []).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {ctx.data!.attachments.map((a: any) => (
                <StorageLink
                  key={a.id}
                  href={a.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="block"
                >
                  <StorageImg
                    loading="lazy"
                    decoding="async"
                    src={a.file_url}
                    alt={a.file_name ?? "attachment"}
                    className="h-20 w-20 rounded-lg object-cover"
                  />
                </StorageLink>
              ))}
            </div>
          )}
          {t.status === "resolved" && (
            <div className="mt-3 space-y-1 rounded-lg bg-primary-soft p-3.5 text-small">
              <div className="text-small font-semibold text-primary-ink">Resolution</div>
              {t.resolution_notes && (
                <div className="whitespace-pre-wrap">{t.resolution_notes}</div>
              )}
              <div className="text-xs text-muted-foreground">
                Resolved {t.resolved_at ? new Date(t.resolved_at).toLocaleString() : ""}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
          <h2 className="section-title">Actions</h2>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => setStatus("in_progress")}>
              Mark in progress
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setShowResolve((v) => !v)}>
              Resolve…
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setStatus("closed")}>
              Close
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!user}
              onClick={() => user && assign(user.id)}
            >
              Assign to me
            </Button>
          </div>
          {showResolve && (
            <div className="space-y-2 rounded-xl bg-secondary p-3.5">
              <div className="text-small font-semibold">Resolution notes (sent to the user)</div>
              <Textarea
                rows={3}
                value={resolveNotes}
                onChange={(e) => setResolveNotes(e.target.value)}
                placeholder="Describe how the issue was resolved…"
              />
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowResolve(false);
                    setResolveNotes("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={async () => {
                    await setStatus("resolved", resolveNotes.trim() || undefined);
                    setShowResolve(false);
                    setResolveNotes("");
                  }}
                >
                  Mark resolved
                </Button>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-small font-semibold">Reassign</span>
            <Select onValueChange={assign}>
              <SelectTrigger className="w-full max-w-64">
                <SelectValue placeholder="Select agent…" />
              </SelectTrigger>
              <SelectContent>
                {(agents.data ?? []).map((a) => (
                  <SelectItem key={a.user_id} value={a.user_id}>
                    {a.display_name ?? a.user_id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Conversation */}
        <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
          <h2 className="section-title">Conversation</h2>
          <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
            {(messages.data ?? []).map((m) => {
              const mine = m.sender_role === "support";
              return (
                <div key={m.id} className={"flex " + (mine ? "justify-end" : "justify-start")}>
                  <div
                    className={
                      "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-small " +
                      (m.is_internal_note
                        ? "bg-tint-sun"
                        : mine
                          ? "rounded-br-md bg-primary-soft"
                          : "rounded-bl-md bg-secondary")
                    }
                  >
                    <div className="flex items-center gap-1 text-caption font-semibold capitalize text-muted-foreground">
                      {m.is_internal_note && <Lock className="h-3 w-3" />}
                      {m.is_internal_note ? "Internal note" : m.sender_role} ·{" "}
                      {new Date(m.created_at).toLocaleString()}
                    </div>
                    <div className="mt-1 whitespace-pre-wrap leading-relaxed">{m.body}</div>
                  </div>
                </div>
              );
            })}
            {(messages.data ?? []).length === 0 && (
              <div className="py-6 text-center text-small text-muted-foreground">
                No messages yet.
              </div>
            )}
          </div>
          <div className="bar-blur hairline-t sticky bottom-[calc(60px+env(safe-area-inset-bottom))] -mx-4 -mb-4 space-y-2.5 rounded-b-xl px-4 py-3 md:bottom-0">
            <Textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={2}
              placeholder="Write a reply…"
            />
            <div className="flex items-center justify-between gap-3">
              <label className="flex select-none items-center gap-2 text-small text-muted-foreground">
                <input
                  type="checkbox"
                  checked={internal}
                  onChange={(e) => setInternal(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                Internal note
              </label>
              <Button
                onClick={send}
                disabled={busy || !reply.trim()}
                className="h-9 rounded-full px-5"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Send
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Context panel */}
      <aside className="space-y-3">
        {creator && (
          <Panel
            title={
              role === "shopkeeper" ? "Owner" : role === "delivery" ? "Partner contact" : "Customer"
            }
          >
            <div className="font-semibold">{creator.full_name || "Unnamed"}</div>
            <Info icon={<Mail className="h-3 w-3" />}>{creator.email}</Info>
            <Info icon={<Phone className="h-3 w-3" />}>{creator.phone || "—"}</Info>
            {role === "customer" &&
              (ctx.data?.addresses ?? []).map((a: any) => (
                <Info key={a.id} icon={<MapPin className="h-3 w-3" />}>
                  {a.line1}, {a.city} {a.pincode}
                </Info>
              ))}
          </Panel>
        )}

        {role === "customer" && (
          <>
            {(ctx.data?.current_orders ?? []).length > 0 && (
              <Panel title="Current orders" icon={<ShoppingBag className="h-3.5 w-3.5" />}>
                {ctx.data!.current_orders.map((o: any) => (
                  <Row
                    key={o.id}
                    left={o.order_number}
                    right={`${rupees(o.total)} · ${o.status.replace(/_/g, " ")}`}
                  />
                ))}
              </Panel>
            )}
            <Panel title="Recent orders" icon={<ShoppingBag className="h-3.5 w-3.5" />}>
              {(ctx.data?.recent_orders ?? []).length === 0 && (
                <div className="text-xs text-muted-foreground">No orders yet.</div>
              )}
              {(ctx.data?.recent_orders ?? []).map((o: any) => (
                <Row
                  key={o.id}
                  left={o.order_number}
                  right={`${rupees(o.total)} · ${o.status.replace(/_/g, " ")}`}
                />
              ))}
            </Panel>
          </>
        )}

        {ctx.data?.referenced_order && (
          <Panel title="Referenced order" icon={<ShoppingBag className="h-3.5 w-3.5" />}>
            <div className="font-semibold">{ctx.data.referenced_order.order_number}</div>
            <Info>
              {rupees(ctx.data.referenced_order.total)} ·{" "}
              {String(ctx.data.referenced_order.status).replace(/_/g, " ")}
            </Info>
          </Panel>
        )}

        {shop?.shop && (
          <Panel title="Shop" icon={<Store className="h-3.5 w-3.5" />}>
            <div className="font-semibold">{shop.shop.name}</div>
            <Info icon={<MapPin className="h-3 w-3" />}>
              {shop.shop.address}, {shop.shop.city} {shop.shop.pincode}
            </Info>
            <Info icon={<Phone className="h-3 w-3" />}>{shop.shop.phone || "—"}</Info>
            <Info>Products: {shop.product_count}</Info>
            <div className="mt-2 text-xs font-semibold capitalize text-muted-foreground">
              Recent orders
            </div>
            {(shop.recent_orders ?? []).slice(0, 5).map((o: any) => (
              <Row
                key={o.id}
                left={o.order_number}
                right={`${rupees(o.total)} · ${String(o.status).replace(/_/g, " ")}`}
              />
            ))}
          </Panel>
        )}

        {partner?.partner && (
          <Panel title="Delivery partner" icon={<Bike className="h-3.5 w-3.5" />}>
            <div className="font-semibold">{partner.partner.name}</div>
            <Info icon={<Phone className="h-3 w-3" />}>{partner.partner.phone || "—"}</Info>
            <Info>Vehicle: {partner.partner.vehicle || "—"}</Info>
            <Info>Status: {partner.partner.is_online ? "Online" : "Offline"}</Info>
            <div className="mt-2 text-xs font-semibold capitalize text-muted-foreground">
              Assigned orders
            </div>
            {(partner.assigned_orders ?? []).length === 0 && (
              <div className="text-xs text-muted-foreground">None.</div>
            )}
            {(partner.assigned_orders ?? []).map((o: any) => (
              <Row
                key={o.id}
                left={o.order_number}
                right={`${rupees(o.total)} · ${String(o.status).replace(/_/g, " ")}`}
              />
            ))}
          </Panel>
        )}
      </aside>
    </div>
  );
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5 rounded-xl border border-border/70 bg-card p-4 text-small">
      <div className="mb-1 flex items-center gap-1.5 text-small font-semibold text-muted-foreground">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}
function Info({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-small text-muted-foreground">
      {icon}
      {children}
    </div>
  );
}
function Row({ left, right }: { left: string; right: string }) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-3 text-small">
      <span className="font-semibold">{left}</span>
      <span className="text-muted-foreground">{right}</span>
    </div>
  );
}
