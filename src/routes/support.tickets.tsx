import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Phone,
  MapPin,
  Store,
  User,
  CheckCircle2,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { TICKET_CATEGORIES } from "@/components/SupportTicketForm";
import { toast } from "sonner";

export const Route = createFileRoute("/support/tickets")({
  head: () => ({ meta: [{ title: "Support Tickets — AP Mart" }] }),
  component: Page,
});

const STATUSES = ["all", "open", "assigned", "in_progress", "resolved", "closed"] as const;
const ROLES = ["all", "customer", "shopkeeper", "delivery"] as const;

const STATUS_TONE: Record<string, string> = {
  open: "bg-tint-sun text-foreground",
  assigned: "bg-tint-sky text-foreground",
  in_progress: "bg-tint-sky text-foreground",
  resolved: "bg-primary-soft text-primary-ink",
  closed: "bg-muted text-muted-foreground",
};

function Page() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("all");
  const [role, setRole] = useState<string>("all");
  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    const ch = supabase
      .channel("support-tickets-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () =>
        qc.invalidateQueries({ queryKey: ["support-tickets-list"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const tickets = useQuery({
    queryKey: ["support-tickets-list"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("support_list_complaints");
      if (error) throw error;
      return (data ?? []) as any[];
    },
    refetchInterval: 30000,
  });

  const filtered = (tickets.data ?? []).filter(
    (t) =>
      (status === "all" || t.status === status) &&
      (role === "all" || t.role_at_creation === role) &&
      (cat === "all" || t.category === cat) &&
      (!q.trim() ||
        t.title.toLowerCase().includes(q.toLowerCase()) ||
        t.ticket_number.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div className="space-y-4 px-4 pb-6 pt-4 md:px-6">
      <h1 className="large-title">Tickets</h1>

      <div className="grid gap-2.5 md:grid-cols-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-10"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title or number"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger>
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger>
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">all</SelectItem>
            {TICKET_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {tickets.isLoading ? (
        <div className="h-32 rounded-xl shimmer" />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border/70 bg-card p-8 text-center text-small text-muted-foreground">
          No tickets match your filters.
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((t) => (
            <article
              key={t.id}
              className="space-y-2.5 rounded-xl border border-border/70 bg-card p-4"
            >
              <header className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="truncate text-body font-medium">{t.title}</span>
                    <span
                      className={`text-caption capitalize rounded-full px-2 py-0.5 font-semibold ${STATUS_TONE[t.status] ?? "bg-secondary"}`}
                    >
                      {t.status.replace(/_/g, " ")}
                    </span>
                    <span className="text-caption capitalize rounded-full bg-secondary px-2 py-0.5 font-semibold">
                      {t.role_at_creation}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-small text-muted-foreground">
                    <span>{t.ticket_number}</span>·<span>{t.category.replace(/_/g, " ")}</span>·
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
                    <ResolveButton
                      ticketId={t.id}
                      onDone={() => qc.invalidateQueries({ queryKey: ["support-tickets-list"] })}
                    />
                  )}
                </div>
              </header>

              <p className="whitespace-pre-wrap text-small leading-relaxed text-foreground/80">
                {t.description}
              </p>

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
                      <a
                        href={`tel:${t.shop_phone}`}
                        className="flex items-center gap-1 text-primary"
                      >
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
            </article>
          ))}
        </div>
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
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Ticket resolved. User notified.");
    setOpen(false);
    setNotes("");
    onDone();
  };

  if (!open) {
    return (
      <Button
        size="sm"
        onClick={() => setOpen(true)}
        className="h-8 gap-1 rounded-full px-3.5 text-small"
      >
        <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
      </Button>
    );
  }
  return (
    <div className="mt-2 w-full space-y-2 rounded-xl bg-primary-soft p-3">
      <Textarea
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Resolution notes (optional) — sent to user"
      />
      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setNotes("");
          }}
        >
          Cancel
        </Button>
        <Button size="sm" onClick={resolve} disabled={busy} className="gap-1">
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
          Mark resolved
        </Button>
      </div>
    </div>
  );
}
