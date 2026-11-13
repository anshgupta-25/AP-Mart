import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Lock,
  RotateCcw,
  SendHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { rupees } from "@/lib/format";
import { StorageImg, StorageLink } from "@/components/StorageImg";

const STATUSES: { value: string; label: string; dot: string; tone: string }[] = [
  { value: "open", label: "Open", dot: "bg-amber-500", tone: "bg-tint-sun" },
  { value: "assigned", label: "Assigned", dot: "bg-sky-500", tone: "bg-tint-sky" },
  { value: "in_progress", label: "In progress", dot: "bg-sky-500", tone: "bg-tint-sky" },
  { value: "resolved", label: "Resolved", dot: "bg-primary", tone: "bg-primary-soft" },
  { value: "closed", label: "Closed", dot: "bg-muted-foreground/60", tone: "bg-secondary" },
];
const statusOf = (v: string) => STATUSES.find((x) => x.value === v) ?? STATUSES[0];

function timeAgo(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d < 7 ? `${d}d ago` : new Date(iso).toLocaleDateString();
}
const fmt = (iso: string) =>
  new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

export function TicketView({ id }: { id: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState<string | null>(null);

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

  const setStatus = async (next: string, okMsg: string) => {
    const key = ["ticket-context", id];
    const prev = qc.getQueryData<any>(key);
    // Update the page immediately; roll back if the server rejects it.
    if (prev?.ticket) {
      qc.setQueryData(key, {
        ...prev,
        ticket: {
          ...prev.ticket,
          status: next,
          resolved_at: next === "resolved" ? new Date().toISOString() : prev.ticket.resolved_at,
        },
      });
    }
    setStatusBusy(next);
    // Always send _notes: with it omitted, Postgres cannot choose between the two
    // update_ticket_status overloads ("best candidate function" error).
    const payload: any = { _ticket_id: id, _status: next, _notes: null };
    const { error } = await supabase.rpc("update_ticket_status", payload);
    setStatusBusy(null);
    if (error) {
      toast.error(error.message);
      if (prev) qc.setQueryData(key, prev);
    } else {
      toast.success(okMsg);
      qc.invalidateQueries({ queryKey: key });
    }
  };

  const assign = async (agentId: string) => {
    const key = ["ticket-context", id];
    const prev = qc.getQueryData<any>(key);
    if (prev?.ticket)
      qc.setQueryData(key, { ...prev, ticket: { ...prev.ticket, assigned_to: agentId } });
    const { error } = await supabase.rpc("assign_ticket", {
      _ticket_id: id,
      _agent_id: agentId,
    });
    if (error) {
      toast.error(error.message);
      if (prev) qc.setQueryData(key, prev);
    } else {
      toast.success(agentId === user?.id ? "Assigned to you" : "Ticket reassigned");
      qc.invalidateQueries({ queryKey: key });
    }
  };

  if (ctx.isLoading)
    return (
      <div className="grid place-items-center p-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  if (ctx.error || !t)
    return <div className="p-6 text-center text-body text-destructive">Could not load ticket.</div>;

  const creator = ctx.data?.creator;
  const shop = ctx.data?.shop;
  const partner = ctx.data?.partner;
  const role = t.role_at_creation;
  const isDone = t.status === "resolved" || t.status === "closed";
  const status = statusOf(t.status);
  const attachments: any[] = ctx.data?.attachments ?? [];
  const msgs = messages.data ?? [];
  const agentName = (uid: string | null) => {
    if (!uid) return null;
    if (uid === user?.id) return "You";
    return agents.data?.find((a) => a.user_id === uid)?.display_name ?? "Agent";
  };
  const assignee = agentName(t.assigned_to);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-5 md:px-6 lg:grid lg:grid-cols-3 lg:gap-8">
      <div className="space-y-6 lg:col-span-2">
        {/* Header */}
        <header className="space-y-2.5 px-1">
          <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground">
            <span>{t.ticket_number}</span>
            <span className="opacity-40">•</span>
            <span className="capitalize">{t.category.replace(/_/g, " ")}</span>
            <span className="opacity-40">•</span>
            <span>{timeAgo(t.created_at)}</span>
          </div>
          <h1 className="text-[18px] font-semibold leading-snug tracking-[-0.02em]">{t.title}</h1>
          <div className="flex items-center justify-between gap-3 pt-0.5">
            <span
              className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[11.5px] font-medium ${status.tone}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </span>
            {isDone ? (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 rounded-full px-3.5 text-[12.5px] font-medium"
                disabled={!!statusBusy}
                onClick={() => setStatus("open", "Ticket reopened")}
              >
                {statusBusy === "open" ? <Loader2 className="animate-spin" /> : <RotateCcw />}
                Reopen
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-8 gap-1.5 rounded-full px-3.5 text-[12.5px] font-medium"
                disabled={!!statusBusy}
                onClick={() => setStatus("resolved", "Ticket resolved. User notified.")}
              >
                {statusBusy === "resolved" ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <CheckCircle2 />
                )}
                Resolve issue
              </Button>
            )}
          </div>
        </header>

        {/* Issue */}
        <Section label="Issue">
          <div className="px-4 py-3.5">
            <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-foreground/85">
              {t.description}
            </p>
            {attachments.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {attachments.map((a) => (
                  <StorageLink
                    key={a.id}
                    href={a.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-lg ring-1 ring-border/60"
                  >
                    <StorageImg
                      loading="lazy"
                      decoding="async"
                      src={a.file_url}
                      alt={a.file_name ?? "attachment"}
                      className="h-16 w-16 object-cover"
                    />
                  </StorageLink>
                ))}
              </div>
            )}
          </div>
          {t.status === "resolved" && t.resolution_notes && (
            <div className="border-t border-border/60 bg-primary-soft/50 px-4 py-3">
              <div className="text-[11px] font-semibold text-primary-ink">Resolution</div>
              <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-relaxed">
                {t.resolution_notes}
              </p>
            </div>
          )}
        </Section>

        {/* Details */}
        <Section label="Details">
          <PropRow label="Status">
            <DropdownMenu>
              <DropdownMenuTrigger
                disabled={!!statusBusy}
                className="press inline-flex items-center gap-1.5 rounded-full py-1 pl-2 pr-1.5 text-[13px] font-medium outline-none hover:bg-secondary"
              >
                {statusBusy ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                )}
                {status.label}
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {STATUSES.filter((x) => x.value !== "assigned" || t.status === "assigned").map(
                  (x) => (
                    <DropdownMenuItem
                      key={x.value}
                      className="gap-2 text-[13px]"
                      onSelect={() =>
                        x.value !== t.status &&
                        setStatus(x.value, `Marked ${x.label.toLowerCase()}`)
                      }
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${x.dot}`} />
                      <span className="flex-1">{x.label}</span>
                      {x.value === t.status && <Check className="h-3.5 w-3.5 text-primary" />}
                    </DropdownMenuItem>
                  ),
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </PropRow>
          <PropRow label="Assignee">
            <DropdownMenu>
              <DropdownMenuTrigger className="press inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-1.5 text-[13px] font-medium outline-none hover:bg-secondary">
                {assignee ? (
                  <>
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-primary-soft text-[10px] font-semibold text-primary-ink">
                      {assignee.slice(0, 1).toUpperCase()}
                    </span>
                    {assignee}
                  </>
                ) : (
                  <span className="pl-1 text-muted-foreground">Unassigned</span>
                )}
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {user && t.assigned_to !== user.id && (
                  <>
                    <DropdownMenuItem
                      className="text-[13px] font-medium text-primary"
                      onSelect={() => assign(user.id)}
                    >
                      Assign to me
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground">
                  Agents
                </DropdownMenuLabel>
                {(agents.data ?? []).map((a) => (
                  <DropdownMenuItem
                    key={a.user_id}
                    className="gap-2 text-[13px]"
                    onSelect={() => a.user_id !== t.assigned_to && assign(a.user_id)}
                  >
                    <span className="flex-1 truncate">
                      {a.display_name ?? a.user_id.slice(0, 8)}
                    </span>
                    {a.user_id === t.assigned_to && <Check className="h-3.5 w-3.5 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </PropRow>
          <PropRow label="Raised by">
            <span className="text-[13px] font-medium">
              {creator?.full_name || "Unnamed"}
              <span className="ml-1.5 font-normal capitalize text-muted-foreground">· {role}</span>
            </span>
          </PropRow>
          <PropRow label="Created">
            <span className="text-[13px] text-muted-foreground">{fmt(t.created_at)}</span>
          </PropRow>
          {t.resolved_at && t.status === "resolved" && (
            <PropRow label="Resolved">
              <span className="text-[13px] text-muted-foreground">{fmt(t.resolved_at)}</span>
            </PropRow>
          )}
        </Section>

        {/* Conversation */}
        <Section
          label="Conversation"
          right={
            msgs.length > 0 ? (
              <span className="text-[11px] text-muted-foreground">{msgs.length}</span>
            ) : null
          }
        >
          <div className="max-h-[440px] space-y-3 overflow-y-auto px-4 py-4">
            {msgs.map((m) => {
              const mine = m.sender_role === "support";
              return (
                <div key={m.id} className={"flex " + (mine ? "justify-end" : "justify-start")}>
                  <div className="max-w-[82%]">
                    <div
                      className={
                        "rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed " +
                        (m.is_internal_note
                          ? "bg-tint-sun"
                          : mine
                            ? "rounded-br-md bg-primary text-primary-foreground"
                            : "rounded-bl-md bg-secondary")
                      }
                    >
                      <div className="whitespace-pre-wrap">{m.body}</div>
                    </div>
                    <div
                      className={
                        "mt-1 flex items-center gap-1 px-1 text-[10.5px] text-muted-foreground " +
                        (mine ? "justify-end" : "")
                      }
                    >
                      {m.is_internal_note && <Lock className="h-2.5 w-2.5" />}
                      <span className="capitalize">
                        {m.is_internal_note ? "Internal note" : m.sender_role}
                      </span>
                      <span className="opacity-50">•</span>
                      {timeAgo(m.created_at)}
                    </div>
                  </div>
                </div>
              );
            })}
            {msgs.length === 0 && (
              <div className="py-6 text-center text-[12.5px] text-muted-foreground">
                No messages yet. Replies you send are visible to the user.
              </div>
            )}
          </div>
          <div className="flex items-end gap-2 border-t border-border/60 px-3 py-2.5">
            <button
              type="button"
              onClick={() => setInternal((v) => !v)}
              aria-pressed={internal}
              aria-label="Internal note"
              title={
                internal ? "Internal note (only support can see)" : "Make this an internal note"
              }
              className={`press grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors ${internal ? "bg-tint-sun text-foreground" : "text-muted-foreground hover:bg-secondary"}`}
            >
              <Lock className="h-4 w-4" />
            </button>
            <Textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={1}
              placeholder={internal ? "Internal note…" : "Reply to user…"}
              className={`min-h-9 flex-1 resize-none rounded-[18px] py-2 text-[13.5px] ${internal ? "bg-tint-sun" : ""}`}
            />
            <Button
              onClick={send}
              disabled={busy || !reply.trim()}
              size="icon"
              aria-label="Send"
              className="h-9 w-9 shrink-0"
            >
              {busy ? <Loader2 className="animate-spin" /> : <SendHorizontal />}
            </Button>
          </div>
        </Section>
      </div>

      {/* Context */}
      <aside className="mt-6 space-y-6 lg:mt-0">
        {creator && (
          <Section
            label={
              role === "shopkeeper" ? "Owner" : role === "delivery" ? "Partner contact" : "Customer"
            }
          >
            <PropRow label="Name">
              <span className="text-[13px] font-medium">{creator.full_name || "Unnamed"}</span>
            </PropRow>
            <PropRow label="Email">
              {creator.email ? (
                <a href={`mailto:${creator.email}`} className="truncate text-[13px] text-primary">
                  {creator.email}
                </a>
              ) : (
                <Muted>—</Muted>
              )}
            </PropRow>
            <PropRow label="Phone">
              {creator.phone ? (
                <a href={`tel:${creator.phone}`} className="text-[13px] text-primary">
                  {creator.phone}
                </a>
              ) : (
                <Muted>—</Muted>
              )}
            </PropRow>
            {role === "customer" &&
              (ctx.data?.addresses ?? []).map((a: any) => (
                <PropRow key={a.id} label="Address">
                  <span className="text-right text-[13px] text-muted-foreground">
                    {a.line1}, {a.city} {a.pincode}
                  </span>
                </PropRow>
              ))}
          </Section>
        )}

        {role === "customer" && (ctx.data?.current_orders ?? []).length > 0 && (
          <Section label="Current orders">
            {ctx.data!.current_orders.map((o: any) => (
              <OrderRow key={o.id} o={o} />
            ))}
          </Section>
        )}
        {role === "customer" && (
          <Section label="Recent orders">
            {(ctx.data?.recent_orders ?? []).length === 0 ? (
              <div className="px-4 py-3.5 text-[12.5px] text-muted-foreground">No orders yet.</div>
            ) : (
              ctx.data!.recent_orders.map((o: any) => <OrderRow key={o.id} o={o} />)
            )}
          </Section>
        )}

        {ctx.data?.referenced_order && (
          <Section label="Referenced order">
            <OrderRow o={ctx.data.referenced_order} />
          </Section>
        )}

        {shop?.shop && (
          <Section label="Shop">
            <PropRow label="Name">
              <span className="text-[13px] font-medium">{shop.shop.name}</span>
            </PropRow>
            <PropRow label="Address">
              <span className="text-right text-[13px] text-muted-foreground">
                {shop.shop.address}, {shop.shop.city} {shop.shop.pincode}
              </span>
            </PropRow>
            <PropRow label="Phone">
              {shop.shop.phone ? (
                <a href={`tel:${shop.shop.phone}`} className="text-[13px] text-primary">
                  {shop.shop.phone}
                </a>
              ) : (
                <Muted>—</Muted>
              )}
            </PropRow>
            <PropRow label="Products">
              <Muted>{shop.product_count}</Muted>
            </PropRow>
            {(shop.recent_orders ?? []).slice(0, 5).map((o: any) => (
              <OrderRow key={o.id} o={o} />
            ))}
          </Section>
        )}

        {partner?.partner && (
          <Section label="Delivery partner">
            <PropRow label="Name">
              <span className="text-[13px] font-medium">{partner.partner.name}</span>
            </PropRow>
            <PropRow label="Phone">
              {partner.partner.phone ? (
                <a href={`tel:${partner.partner.phone}`} className="text-[13px] text-primary">
                  {partner.partner.phone}
                </a>
              ) : (
                <Muted>—</Muted>
              )}
            </PropRow>
            <PropRow label="Vehicle">
              <Muted>{partner.partner.vehicle || "—"}</Muted>
            </PropRow>
            <PropRow label="Status">
              <Muted>{partner.partner.is_online ? "Online" : "Offline"}</Muted>
            </PropRow>
            {(partner.assigned_orders ?? []).map((o: any) => (
              <OrderRow key={o.id} o={o} />
            ))}
          </Section>
        )}
      </aside>
    </div>
  );
}

function Section({
  label,
  right,
  children,
}: {
  label: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {label}
        </h2>
        {right}
      </div>
      <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-card">
        {children}
      </div>
    </section>
  );
}

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 px-4 py-2">
      <span className="shrink-0 text-[12.5px] text-muted-foreground">{label}</span>
      <div className="flex min-w-0 justify-end">{children}</div>
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-[13px] text-muted-foreground">{children}</span>;
}

function OrderRow({ o }: { o: any }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 px-4 py-2">
      <span className="text-[13px] font-medium">{o.order_number}</span>
      <span className="text-[12.5px] capitalize text-muted-foreground">
        {rupees(o.total)} · {String(o.status).replace(/_/g, " ")}
      </span>
    </div>
  );
}
