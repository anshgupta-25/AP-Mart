import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { uploadFile } from "@/lib/storage";
import { Loader2, Paperclip, X } from "lucide-react";

const SUPPORT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/bmp",
];
const SUPPORT_MAX_BYTES = 5 * 1024 * 1024;

export const TICKET_CATEGORIES = [
  { value: "order_issue", label: "Order Issue" },
  { value: "payment_issue", label: "Payment Issue" },
  { value: "refund_issue", label: "Refund Issue" },
  { value: "delivery_issue", label: "Delivery Issue" },
  { value: "product_issue", label: "Product Issue" },
  { value: "shop_issue", label: "Shop Issue" },
  { value: "account_issue", label: "Account Issue" },
  { value: "technical_issue", label: "Technical Issue" },
] as const;

export function SupportTicketForm({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (ticketId: string) => void;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("order_issue");
  const [orderId, setOrderId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [orders, setOrders] = useState<{ id: string; order_number: string }[]>([]);

  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number")
        .eq("user_id", user.id)
        .order("placed_at", { ascending: false })
        .limit(20);
      setOrders((data ?? []) as any);
    })();
  }, [open, user]);

  const reset = () => {
    setTitle("");
    setDescription("");
    setCategory("order_issue");
    setOrderId("");
    setFile(null);
  };

  const submit = async () => {
    if (!title.trim() || !description.trim()) {
      toast.error("Please add a title and description");
      return;
    }
    setSubmitting(true);
    try {
      const { data: ticketId, error } = await (supabase as any).rpc("create_support_ticket", {
        _title: title.trim(),
        _description: description.trim(),
        _category: category,
        _order_id: orderId || null,
      });
      if (error) throw error;

      if (file && ticketId) {
        try {
          const stored = await uploadFile({
            bucket: "support-attachments",
            file,
            folder: `${user?.id}/${ticketId}`,
            allowedTypes: SUPPORT_TYPES,
            maxBytes: SUPPORT_MAX_BYTES,
          });
          await (supabase as any).from("ticket_attachments").insert({
            ticket_id: ticketId,
            uploaded_by: user?.id,
            file_url: stored.ref,
            file_name: file.name,
            mime: file.type,
          });
        } catch (upErr: any) {
          toast.error(
            "Ticket created but attachment failed: " + (upErr?.message ?? "upload error"),
          );
        }
      }

      toast.success("Ticket created — we'll be in touch shortly");
      reset();
      onOpenChange(false);
      onCreated?.(ticketId as string);
    } catch (e: any) {
      toast.error(e.message ?? "Could not create ticket");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-2xl p-5">
        <DialogHeader>
          <DialogTitle className="text-subtitle font-bold tracking-tight">
            Help & Support
          </DialogTitle>
          <DialogDescription>
            Describe your issue. Our support team will get back to you.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-small font-medium text-muted-foreground">
              Complaint title
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="Short summary"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-small font-medium text-muted-foreground">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TICKET_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {orders.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-small font-medium text-muted-foreground">
                Related order (optional)
              </Label>
              <Select
                value={orderId || "none"}
                onValueChange={(v) => setOrderId(v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {orders.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.order_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="desc" className="text-small font-medium text-muted-foreground">
              Description
            </Label>
            <Textarea
              id="desc"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              placeholder="Tell us what happened…"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-small font-medium text-muted-foreground">
              Image attachment (optional)
            </Label>
            {file ? (
              <div className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-small">
                <Paperclip className="h-4 w-4" />
                <span className="truncate flex-1">{file.name}</span>
                <Button type="button" size="icon" variant="ghost" onClick={() => setFile(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 5 * 1024 * 1024) {
                    toast.error("Max 5 MB");
                    return;
                  }
                  setFile(f);
                }}
              />
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Submit ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
