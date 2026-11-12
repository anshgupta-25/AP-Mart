import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageCircle, Send } from "lucide-react";

const QUICK = [
  { kind: "eta_2", label: "Arriving in 2 minutes" },
  { kind: "eta_5", label: "Arriving in 5 minutes" },
  { kind: "eta_10", label: "Arriving in 10 minutes" },
  { kind: "delay", label: "Traffic delay" },
  { kind: "no_contact", label: "Unable to contact you" },
  { kind: "answer_phone", label: "Please answer your phone" },
  { kind: "reached", label: "I've reached your location" },
  { kind: "delivered", label: "Order delivered" },
];

export function MessageCustomerDialog({
  orderId,
  orderNumber,
  triggerLabel = "Message customer",
  className = "",
}: {
  orderId: string;
  orderNumber?: string;
  triggerLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const [sending, setSending] = useState(false);

  const send = async (kind: string, message?: string) => {
    setSending(true);
    const { error } = await supabase.rpc("partner_send_message" as any, {
      _order_id: orderId,
      _kind: kind,
      _custom_message: message ?? null,
    });
    setSending(false);
    if (error) return toast.error(error.message);
    toast.success("Customer notified");
    if (kind === "custom") setCustom("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className={`rounded-xl ${className}`}>
          <MessageCircle className="h-4 w-4 mr-1" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Message customer{orderNumber ? ` — ${orderNumber}` : ""}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-2">
          {QUICK.map((q) => (
            <Button
              key={q.kind}
              variant="secondary"
              disabled={sending}
              onClick={() => send(q.kind)}
              className="justify-start rounded-xl"
            >
              {q.label}
            </Button>
          ))}
        </div>
        <div className="mt-3 space-y-2">
          <div className="text-xs font-semibold text-muted-foreground">Custom message</div>
          <Textarea
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            maxLength={280}
            rows={3}
            placeholder="e.g. Sorry, there is traffic. I'll be about 5 minutes late."
          />
          <Button
            disabled={sending || !custom.trim()}
            onClick={() => send("custom", custom.trim())}
            className="w-full rounded-xl gradient-primary text-primary-foreground"
          >
            <Send className="h-4 w-4 mr-1" /> Send custom message
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Only the customer for this order will receive this notification.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
