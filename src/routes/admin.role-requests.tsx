import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Store, Truck, Check, X, Clock, type LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import type { Database } from "@/integrations/supabase/types";
type Fns = Database["public"]["Functions"];
type RoleRequest = Fns["admin_list_role_requests"]["Returns"][number];
/** Free-form application details stored in role_requests.data (JSON). */
type RequestData = {
  shop_name?: string;
  shop_address?: string;
  shop_phone?: string;
  vehicle_type?: string;
  phone?: string;
};
type DialogProps = { request: RoleRequest; onClose: () => void; onDone: () => void };

export const Route = createFileRoute("/admin/role-requests")({
  head: () => ({ meta: [{ title: "Role requests — AP Mart Admin" }] }),
  component: RoleRequestsPage,
});

function RoleRequestsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("pending");
  const [approve, setApprove] = useState<RoleRequest | null>(null);
  const [reject, setReject] = useState<RoleRequest | null>(null);

  const reqs = useQuery({
    queryKey: ["admin-role-requests", filter],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "admin_list_role_requests",
        filter === "all" ? {} : { _status: filter },
      );
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 10000,
  });

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-4 md:px-6 md:py-6">
      <div className="space-y-4">
        <div>
          <h1 className="large-title">Role requests</h1>
          <p className="mt-0.5 text-meta text-muted-foreground">
            Review applications from customers who want to become shopkeepers or delivery partners.
          </p>
        </div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {["pending", "approved", "rejected", "all"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`press whitespace-nowrap rounded-full px-4 py-2 text-meta font-medium capitalize transition ${filter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {reqs.isLoading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-36 rounded-xl shimmer" />
          ))}
        </div>
      ) : (reqs.data ?? []).length === 0 ? (
        <div className="rounded-xl border border-border/70 bg-card px-6 py-10 text-center">
          <div className="text-subtitle font-semibold">
            No {filter !== "all" ? filter : ""} requests
          </div>
          <p className="mt-0.5 text-meta text-muted-foreground">
            New applications will appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:gap-4">
          {(reqs.data ?? []).map((r) => (
            <div key={r.id} className="rounded-xl border border-border/70 bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {r.requested_role === "shopkeeper" ? (
                      <Store className="h-4 w-4 text-primary" />
                    ) : (
                      <Truck className="h-4 w-4 text-primary" />
                    )}
                    <span className="text-subtitle font-semibold capitalize">
                      {r.requested_role}
                    </span>
                    <StatusPill status={r.status} />
                  </div>
                  <div className="text-body font-medium">{r.full_name || "—"}</div>
                  <div className="text-meta text-muted-foreground">
                    {r.email || "—"} • {r.phone || "no phone"}
                  </div>
                  <div className="text-caption text-muted-foreground mt-0.5">
                    Submitted {formatDistanceToNow(new Date(r.submitted_at), { addSuffix: true })}
                  </div>
                </div>
                {r.status === "pending" && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setReject(r)}>
                      <X className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                    <Button size="sm" onClick={() => setApprove(r)}>
                      <Check className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                  </div>
                )}
              </div>

              <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                {Object.entries(r.data ?? {})
                  .filter(([k]) => !["approved_shop_id", "partner_id"].includes(k))
                  .map(([k, v]) => (
                    <div key={k} className="rounded-xl bg-secondary/70 px-3.5 py-2.5">
                      <div className="text-small font-medium capitalize text-muted-foreground">
                        {k.replace(/_/g, " ")}
                      </div>
                      <div className="text-sm break-words">{String(v) || "—"}</div>
                    </div>
                  ))}
              </div>

              {r.status === "rejected" && r.rejection_reason && (
                <div className="mt-2 text-xs text-destructive">Reason: {r.rejection_reason}</div>
              )}
            </div>
          ))}
        </div>
      )}

      <ApproveDialog
        request={approve}
        onClose={() => setApprove(null)}
        onDone={() => qc.invalidateQueries({ queryKey: ["admin-role-requests"] })}
      />
      <RejectDialog
        request={reject}
        onClose={() => setReject(null)}
        onDone={() => qc.invalidateQueries({ queryKey: ["admin-role-requests"] })}
      />
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { c: string; Icon: LucideIcon }> = {
    pending: { c: "bg-tint-sun text-[oklch(0.45_0.1_75)]", Icon: Clock },
    approved: { c: "bg-primary-soft text-primary-ink", Icon: Check },
    rejected: { c: "bg-tint-rose text-[oklch(0.45_0.12_15)]", Icon: X },
  };
  const m = map[status] ?? map.pending;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-caption font-semibold capitalize ${m.c}`}
    >
      <m.Icon className="h-3 w-3" />
      {status}
    </span>
  );
}

function ApproveDialog({
  request,
  onClose,
  onDone,
}: Omit<DialogProps, "request"> & { request: RoleRequest | null }) {
  if (!request) return null;
  return request.requested_role === "shopkeeper" ? (
    <ApproveShopkeeper request={request} onClose={onClose} onDone={onDone} />
  ) : (
    <ApproveDelivery request={request} onClose={onClose} onDone={onDone} />
  );
}

function ApproveShopkeeper({ request, onClose, onDone }: DialogProps) {
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [shopId, setShopId] = useState<string>("");
  const d = (request.data ?? {}) as RequestData;
  const [form, setForm] = useState({
    name: d.shop_name ?? "",
    address: d.shop_address ?? "",
    city: "",
    pincode: "",
    phone: d.shop_phone ?? "",
    lat: "",
    lng: "",
    radius: "8",
  });

  const shops = useQuery({
    queryKey: ["admin-shops-unowned"],
    queryFn: async () =>
      (await supabase.from("shops").select("id, name, address, owner_id").order("name")).data ?? [],
  });

  const m = useMutation({
    mutationFn: async () => {
      const args: Fns["admin_approve_shopkeeper_request"]["Args"] = { _request_id: request.id };
      if (mode === "existing") {
        if (!shopId) throw new Error("Pick a shop");
        args._shop_id = shopId;
      } else {
        if (!form.name || !form.address || !form.lat || !form.lng)
          throw new Error("Fill all required fields");
        Object.assign(args, {
          _shop_name: form.name,
          _address: form.address,
          _city: form.city,
          _pincode: form.pincode,
          _phone: form.phone,
          _lat: parseFloat(form.lat),
          _lng: parseFloat(form.lng),
          _radius: parseFloat(form.radius) || 8,
        });
      }
      const { error } = await supabase.rpc("admin_approve_shopkeeper_request", args);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Approved");
      onDone();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Approve shopkeeper — {request.full_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode("new")}
              className={`press rounded-xl p-3 text-body font-medium ${mode === "new" ? "bg-primary-soft text-primary-ink" : "bg-secondary text-muted-foreground"}`}
            >
              Create new shop
            </button>
            <button
              onClick={() => setMode("existing")}
              className={`press rounded-xl p-3 text-body font-medium ${mode === "existing" ? "bg-primary-soft text-primary-ink" : "bg-secondary text-muted-foreground"}`}
            >
              Assign existing shop
            </button>
          </div>

          {mode === "new" ? (
            <div className="space-y-3">
              <Field
                id="n"
                label="Shop name *"
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
              />
              <Field
                id="a"
                label="Address *"
                value={form.address}
                onChange={(v) => setForm({ ...form, address: v })}
              />
              <div className="grid grid-cols-2 gap-2">
                <Field
                  id="c"
                  label="City"
                  value={form.city}
                  onChange={(v) => setForm({ ...form, city: v })}
                />
                <Field
                  id="p"
                  label="Pincode"
                  value={form.pincode}
                  onChange={(v) => setForm({ ...form, pincode: v })}
                />
              </div>
              <Field
                id="ph"
                label="Phone"
                value={form.phone}
                onChange={(v) => setForm({ ...form, phone: v })}
              />
              <div className="grid grid-cols-3 gap-2">
                <Field
                  id="lat"
                  label="Latitude *"
                  value={form.lat}
                  onChange={(v) => setForm({ ...form, lat: v })}
                />
                <Field
                  id="lng"
                  label="Longitude *"
                  value={form.lng}
                  onChange={(v) => setForm({ ...form, lng: v })}
                />
                <Field
                  id="r"
                  label="Radius km"
                  value={form.radius}
                  onChange={(v) => setForm({ ...form, radius: v })}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Existing shop</Label>
              <Select value={shopId} onValueChange={setShopId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a shop to assign…" />
                </SelectTrigger>
                <SelectContent>
                  {(shops.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} {s.owner_id ? "(reassign)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                The selected shop will be re-owned by this user.
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => m.mutate()}
            disabled={m.isPending}
            className="bg-primary text-primary-foreground"
          >
            {m.isPending ? "Approving…" : "Approve"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApproveDelivery({ request, onClose, onDone }: DialogProps) {
  const [shopId, setShopId] = useState<string>("");
  const d = (request.data ?? {}) as RequestData;
  const [vehicle, setVehicle] = useState(d.vehicle_type ?? "");
  const [phone, setPhone] = useState(d.phone ?? "");

  const shops = useQuery({
    queryKey: ["admin-shops-all"],
    queryFn: async () => (await supabase.from("shops").select("id, name").order("name")).data ?? [],
  });

  const m = useMutation({
    mutationFn: async () => {
      if (!shopId) throw new Error("Pick a shop");
      const { error } = await supabase.rpc("admin_approve_delivery_request", {
        _request_id: request.id,
        _shop_id: shopId,
        _name: request.full_name,
        _phone: phone,
        _vehicle: vehicle,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Approved");
      onDone();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Approve delivery partner — {request.full_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Assign to shop *</Label>
            <Select value={shopId} onValueChange={setShopId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a shop…" />
              </SelectTrigger>
              <SelectContent>
                {(shops.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              The partner will deliver only this shop's orders.
            </p>
          </div>
          <Field id="v" label="Vehicle" value={vehicle} onChange={setVehicle} />
          <Field id="p" label="Phone" value={phone} onChange={setPhone} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => m.mutate()}
            disabled={m.isPending}
            className="bg-primary text-primary-foreground"
          >
            {m.isPending ? "Approving…" : "Approve"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RejectDialog({
  request,
  onClose,
  onDone,
}: Omit<DialogProps, "request"> & { request: RoleRequest | null }) {
  const [reason, setReason] = useState("");
  const m = useMutation({
    mutationFn: async () => {
      if (!request) return;
      const args: Fns["admin_reject_role_request"]["Args"] = { _request_id: request.id };
      if (reason) args._reason = reason;
      const { error } = await supabase.rpc("admin_reject_role_request", args);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rejected");
      onDone();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  if (!request) return null;
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reject request</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Reason (optional)</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Send a short reason to the user…"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => m.mutate()} disabled={m.isPending}>
            {m.isPending ? "Rejecting…" : "Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl"
      />
    </div>
  );
}
