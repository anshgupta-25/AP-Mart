import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Phone, MapPin, Store, User, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/complaints")({
  head: () => ({ meta: [{ title: "Complaints — AP Mart Admin" }] }),
  component: Page,
});

const STATUS_TONE: Record<string, string> = {
  open: "bg-tint-sun text-[oklch(0.45_0.1_75)]",
  assigned: "bg-tint-sky text-[oklch(0.42_0.1_235)]",
  in_progress: "bg-tint-sky text-[oklch(0.42_0.1_235)]",
  resolved: "bg-primary-soft text-primary-ink",
  closed: "bg-muted text-muted-foreground",
};

function Page() {
  const qc = useQueryClient();

  useEffect(() => {
    const ch = supabase
      .channel("admin-complaints")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () =>
        qc.invalidateQueries({ queryKey: ["admin-complaints"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-complaints"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("admin_list_complaints");
      if (error) throw error;
      return (data ?? []) as any[];
    },
    refetchInterval: 30000,
  });

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-4 md:px-6 md:py-6">
      <div>
        <h1 className="large-title">Complaints</h1>
        <p className="mt-0.5 text-meta text-muted-foreground">
          Help & Support tickets raised by customers and shopkeepers.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-40 rounded-xl shimmer" />
          ))}
        </div>
      ) : (data ?? []).length === 0 ? (
        <div className="rounded-xl border border-border/70 bg-card px-6 py-10 text-center">
          <div className="text-subtitle font-semibold">No complaints</div>
          <p className="mt-0.5 text-meta text-muted-foreground">
            Tickets raised by customers and shopkeepers will appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:gap-4">
          {data!.map((t) => (
            <article
              key={t.id}
              className="space-y-4 rounded-xl border border-border/70 bg-card p-4"
            >
              <header className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="truncate text-subtitle font-semibold">{t.title}</span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-caption font-semibold capitalize ${STATUS_TONE[t.status] ?? "bg-secondary"}`}
                    >
                      {t.status.replace(/_/g, " ")}
                    </span>
                    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-caption font-medium capitalize text-muted-foreground">
                      {t.role_at_creation}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-small text-muted-foreground">
                    <span>{t.ticket_number}</span>·<span>{t.category.replace(/_/g, " ")}</span>·
                    <span>{new Date(t.created_at).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {t.status !== "resolved" && t.status !== "closed" && (
                    <ResolveButton
                      ticketId={t.id}
                      onDone={() => qc.invalidateQueries({ queryKey: ["admin-complaints"] })}
                    />
                  )}
                </div>
              </header>

              <p className="whitespace-pre-wrap text-body leading-relaxed text-foreground/90">
                {t.description}
              </p>

              <div className="grid gap-3 text-meta sm:grid-cols-2">
                <div className="space-y-1 rounded-xl bg-secondary/70 p-3.5">
                  <div className="eyebrow flex items-center gap-1">
                    <User className="h-3 w-3" /> Raised by
                  </div>
                  <div className="font-medium">{t.full_name || "—"}</div>
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
                  <div className="space-y-1 rounded-xl bg-secondary/70 p-3.5">
                    <div className="eyebrow flex items-center gap-1">
                      <Store className="h-3 w-3" /> Shop
                    </div>
                    <div className="font-medium">{t.shop_name || "—"}</div>
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
      <Button size="sm" onClick={() => setOpen(true)} className="gap-1">
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
