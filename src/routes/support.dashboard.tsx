import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Inbox, AlertCircle, CheckCircle2, Timer, Phone, MapPin, Store, User, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/support/dashboard")({
  head: () => ({ meta: [{ title: "Support Dashboard — AP Mart" }] }),
  component: Page,
});

const STATUS_TONE: Record<string, string> = {
  open: "bg-tint-sun text-foreground",
  assigned: "bg-tint-sky text-foreground",
  in_progress: "bg-tint-sky text-foreground",
  resolved: "bg-primary-soft text-primary-ink",
  closed: "bg-muted text-muted-foreground",
};

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    const ch = supabase.channel("support-dash").on("postgres_changes",
      { event: "*", schema: "public", table: "support_tickets" },
      () => qc.invalidateQueries({ queryKey: ["support-dash-complaints"] })
    ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const data = useQuery({
    queryKey: ["support-dash-complaints", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("support_list_complaints");
      if (error) throw error;
      const rows: any[] = data ?? [];
      return {
        total: rows.length,
        open: rows.filter(r => ["open","assigned","in_progress"].includes(r.status)).length,
        unassigned: rows.filter(r => r.status === "open" && !r.assigned_to).length,
        resolved: rows.filter(r => r.status === "resolved").length,
        mine: rows.filter(r => r.assigned_to === user?.id && r.status !== "closed").slice(0, 10),
        queue: rows.filter(r => !r.assigned_to && r.status === "open").slice(0, 10),
        active: rows.filter(r => r.status !== "resolved" && r.status !== "closed").slice(0, 30),
      };
    },
    refetchInterval: 30000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["support-dash-complaints"] });

  return (
    <div className="space-y-5 px-4 pb-6 pt-4 md:px-6">
      <h1 className="large-title">Support overview</h1>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat tint="bg-tint-sky" icon={<Inbox className="h-[18px] w-[18px]" />} label="Total" value={data.data?.total ?? 0} />
        <Stat tint="bg-tint-sun" icon={<Timer className="h-[18px] w-[18px]" />} label="Open" value={data.data?.open ?? 0} />
        <Stat tint="bg-tint-rose" icon={<AlertCircle className="h-[18px] w-[18px]" />} label="Unassigned" value={data.data?.unassigned ?? 0} />
        <Stat tint="bg-tint-mint" icon={<CheckCircle2 className="h-[18px] w-[18px]" />} label="Resolved" value={data.data?.resolved ?? 0} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <TicketList title="Assigned to me" items={data.data?.mine ?? []} onDone={invalidate} />
        <TicketList title="Unassigned queue" items={data.data?.queue ?? []} onDone={invalidate} />
      </section>

      <TicketList title="All active complaints" items={data.data?.active ?? []} onDone={invalidate} />
    </div>
  );
}

function Stat({ icon, label, value, tint }: { icon: React.ReactNode; label: string; value: number; tint: string }) {
  return (
    <div className={`rounded-xl p-3.5 ${tint}`}>
      <div className="text-foreground/60">{icon}</div>
      <div className="mt-2.5 text-page font-bold leading-none tracking-tight">{value}</div>
      <div className="mt-1 text-small text-foreground/60">{label}</div>
    </div>
  );
}

function TicketList({ title, items, onDone }: { title: string; items: any[]; onDone: () => void }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
      <div className="hairline-b px-4 py-3 section-title">
        {title} <span className="text-small font-normal text-muted-foreground">({items.length})</span>
      </div>
      {items.length === 0 ? (
        <div className="p-6 text-center text-small text-muted-foreground">Nothing here.</div>
      ) : (
        <ul className="divide-y divide-border/60">
          {items.map((t) => (
            <li key={t.id} className="space-y-2.5 p-4">
              <header className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="truncate text-body font-medium">{t.title}</span>
                    <span className={`text-caption capitalize rounded-full px-2 py-0.5 font-semibold ${STATUS_TONE[t.status] ?? "bg-secondary"}`}>
                      {t.status.replace(/_/g, " ")}
                    </span>
                    <span className="text-caption capitalize rounded-full bg-secondary px-2 py-0.5 font-semibold">
                      {t.role_at_creation}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-small text-muted-foreground">
                    <span>{t.ticket_number}</span>·
                    <span>{t.category.replace(/_/g, " ")}</span>·
                    <span>{new Date(t.created_at).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to="/support/tickets/$id"
                    params={{ id: t.id }}
                    className="press inline-flex h-8 items-center gap-1 rounded-full bg-secondary px-3.5 text-small font-semibold"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Open
                  </Link>
                  {t.status !== "resolved" && t.status !== "closed" && (
                    <ResolveButton ticketId={t.id} onDone={onDone} />
                  )}
                </div>
              </header>

              {t.description && (
                <p className="whitespace-pre-wrap text-small leading-relaxed text-foreground/80">{t.description}</p>
              )}

              <div className="grid gap-2 text-small sm:grid-cols-2">
                <div className="space-y-1 rounded-lg bg-secondary/70 p-3">
                  <div className="flex items-center gap-1 text-caption font-semibold text-muted-foreground">
                    <User className="h-3 w-3" /> Raised by
                  </div>
                  <div className="font-semibold">{t.full_name || "—"}</div>
                  {t.phone && (
                    <a href={`tel:${t.phone}`} className="flex items-center gap-1 text-primary">
                      <Phone className="h-3 w-3" /> {t.phone}
                    </a>
                  )}
                  {(t.address_line || t.city || t.pincode) && (
                    <div className="flex items-start gap-1 text-muted-foreground">
                      <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                      <span>{[t.address_line, t.city, t.pincode].filter(Boolean).join(", ")}</span>
                    </div>
                  )}
                </div>

                {t.role_at_creation === "shopkeeper" && (t.shop_name || t.shop_address) && (
                  <div className="space-y-1 rounded-lg bg-secondary/70 p-3">
                    <div className="flex items-center gap-1 text-caption font-semibold text-muted-foreground">
                      <Store className="h-3 w-3" /> Shop
                    </div>
                    <div className="font-semibold">{t.shop_name || "—"}</div>
                    {t.shop_phone && (
                      <a href={`tel:${t.shop_phone}`} className="flex items-center gap-1 text-primary">
                        <Phone className="h-3 w-3" /> {t.shop_phone}
                      </a>
                    )}
                    {t.shop_address && (
                      <div className="flex items-start gap-1 text-muted-foreground">
                        <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                        <span>{t.shop_address}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ResolveButton({ ticketId, onDone }: { ticketId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const resolve = async () => {
    setBusy(true);
    const { error } = await (supabase as any).rpc("update_ticket_status", {
      _ticket_id: ticketId,
      _status: "resolved",
      _notes: notes.trim() || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Ticket resolved. User notified.");
    setOpen(false); setNotes("");
    onDone();
  };

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}
        className="h-8 gap-1 rounded-full px-3.5 text-small">
        <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
      </Button>
    );
  }
  return (
    <div className="mt-2 w-full space-y-2 rounded-xl bg-primary-soft p-3">
      <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
        placeholder="Resolution notes (optional) — sent to user" />
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setNotes(""); }}>Cancel</Button>
        <Button size="sm" onClick={resolve} disabled={busy} className="gap-1">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          Mark resolved
        </Button>
      </div>
    </div>
  );
}
