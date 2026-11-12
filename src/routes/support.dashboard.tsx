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
  open: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
  assigned: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  in_progress: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  resolved: "bg-green-500/15 text-green-700 dark:text-green-300",
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
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="font-display text-3xl font-extrabold">Support overview</h1>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={<Inbox className="h-4 w-4" />} label="Total" value={data.data?.total ?? 0} />
        <Stat icon={<Timer className="h-4 w-4" />} label="Open" value={data.data?.open ?? 0} />
        <Stat icon={<AlertCircle className="h-4 w-4" />} label="Unassigned" value={data.data?.unassigned ?? 0} />
        <Stat icon={<CheckCircle2 className="h-4 w-4" />} label="Resolved" value={data.data?.resolved ?? 0} />
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <TicketList title="Assigned to me" items={data.data?.mine ?? []} onDone={invalidate} />
        <TicketList title="Unassigned queue" items={data.data?.queue ?? []} onDone={invalidate} />
      </section>

      <TicketList title="All active complaints" items={data.data?.active ?? []} onDone={invalidate} />
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground font-semibold">{icon}{label}</div>
      <div className="font-display text-2xl font-extrabold mt-1">{value}</div>
    </div>
  );
}

function TicketList({ title, items, onDone }: { title: string; items: any[]; onDone: () => void }) {
  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="px-4 py-3 border-b border-border font-bold">
        {title} <span className="text-xs text-muted-foreground font-normal">({items.length})</span>
      </div>
      {items.length === 0 ? (
        <div className="p-6 text-sm text-muted-foreground">Nothing here.</div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((t) => (
            <li key={t.id} className="p-4 space-y-3">
              <header className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-base truncate">{t.title}</span>
                    <span className={`text-[10px] uppercase rounded-full px-2 py-0.5 font-bold ${STATUS_TONE[t.status] ?? "bg-secondary"}`}>
                      {t.status.replace(/_/g, " ")}
                    </span>
                    <span className="text-[10px] uppercase rounded-full bg-secondary px-2 py-0.5 font-bold">
                      {t.role_at_creation}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                    <span>{t.ticket_number}</span>·
                    <span>{t.category.replace(/_/g, " ")}</span>·
                    <span>{new Date(t.created_at).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to="/support/tickets/$id"
                    params={{ id: t.id }}
                    className="inline-flex items-center gap-1 text-xs font-bold rounded-full bg-secondary px-3 py-1.5 hover:bg-secondary/70"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Open
                  </Link>
                  {t.status !== "resolved" && t.status !== "closed" && (
                    <ResolveButton ticketId={t.id} onDone={onDone} />
                  )}
                </div>
              </header>

              {t.description && (
                <p className="text-sm text-foreground/90 whitespace-pre-wrap">{t.description}</p>
              )}

              <div className="grid sm:grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-secondary/40 p-3 space-y-1">
                  <div className="font-bold uppercase text-[10px] text-muted-foreground flex items-center gap-1">
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
                  <div className="rounded-xl bg-secondary/40 p-3 space-y-1">
                    <div className="font-bold uppercase text-[10px] text-muted-foreground flex items-center gap-1">
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
        className="h-8 bg-green-600 hover:bg-green-700 text-white text-xs font-bold gap-1">
        <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
      </Button>
    );
  }
  return (
    <div className="w-full mt-2 space-y-2 rounded-xl border border-green-500/30 bg-green-500/5 p-3">
      <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
        placeholder="Resolution notes (optional) — sent to user" />
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setNotes(""); }}>Cancel</Button>
        <Button size="sm" onClick={resolve} disabled={busy}
          className="bg-green-600 hover:bg-green-700 text-white gap-1">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          Mark resolved
        </Button>
      </div>
    </div>
  );
}
