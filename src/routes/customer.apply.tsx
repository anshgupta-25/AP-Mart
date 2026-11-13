import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Store, Truck, ArrowLeft, Clock, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/customer/apply")({
  head: () => ({ meta: [{ title: "Become a partner — AP Mart" }] }),
  component: ApplyPage,
});

function ApplyPage() {
  const { user, roles, loading } = useAuth() as any;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"shopkeeper" | "delivery">("shopkeeper");

  const requests = useQuery({
    queryKey: ["my-role-requests", user?.id],
    queryFn: async () =>
      (await supabase.from("role_requests").select("*").eq("user_id", user.id).order("submitted_at", { ascending: false })).data ?? [],
    enabled: !!user,
  });

  // shopkeeper form
  const [sk, setSk] = useState({ shop_name: "", shop_address: "", shop_phone: "", shop_description: "" });
  // delivery form
  const [dp, setDp] = useState({ vehicle_type: "", vehicle_number: "", phone: "", license: "" });

  const submit = useMutation({
    mutationFn: async () => {
      const role = tab;
      const data = role === "shopkeeper" ? sk : dp;
      const { error } = await supabase.rpc("submit_role_request", { _role: role, _data: data });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Application submitted. We'll notify you once an admin reviews it.");
      qc.invalidateQueries({ queryKey: ["my-role-requests"] });
      setSk({ shop_name: "", shop_address: "", shop_phone: "", shop_description: "" });
      setDp({ vehicle_type: "", vehicle_number: "", phone: "", license: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (loading) return null;
  if (!user) { navigate({ to: "/login" }); return null; }

  const r: string[] = roles ?? [];
  const isShop = r.includes("shopkeeper");
  const isDelivery = r.includes("delivery");

  return (
    <div className="space-y-4 px-4 pb-8 pt-4">
      <Link to="/customer/profile" className="press inline-flex items-center gap-1 text-meta font-medium text-primary"><ArrowLeft className="h-4 w-4"/> Back</Link>
      <div>
        <h1 className="large-title">Become a partner</h1>
        <p className="mt-1 text-meta text-muted-foreground">Apply to operate a shop or deliver orders on AP Mart. An admin will review your request.</p>
      </div>

      {/* Status of existing requests */}
      {(requests.data ?? []).length > 0 && (
        <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
          <div className="eyebrow">Your requests</div>
          {(requests.data ?? []).map((r: any) => (
            <div key={r.id} className="flex items-center justify-between text-meta">
              <div className="capitalize font-semibold">{r.requested_role}</div>
              <StatusPill status={r.status} reason={r.rejection_reason} />
            </div>
          ))}
        </div>
      )}

      {/* Role tabs */}
      <div className="grid grid-cols-2 gap-3">
        <Tab active={tab === "shopkeeper"} onClick={() => setTab("shopkeeper")} icon={<Store className="h-4 w-4"/>} label="Shopkeeper" disabled={isShop} />
        <Tab active={tab === "delivery"} onClick={() => setTab("delivery")} icon={<Truck className="h-4 w-4"/>} label="Delivery partner" disabled={isDelivery} />
      </div>

      {tab === "shopkeeper" ? (
        isShop ? <Already label="You are already a shopkeeper."/> : (
          <form onSubmit={(e) => { e.preventDefault(); submit.mutate(); }} className="space-y-4 rounded-xl border border-border/70 bg-card p-4">
            <FieldText id="sn" label="Shop name *" value={sk.shop_name} onChange={(v) => setSk({ ...sk, shop_name: v })} required />
            <FieldText id="sa" label="Shop address *" value={sk.shop_address} onChange={(v) => setSk({ ...sk, shop_address: v })} required />
            <FieldText id="sp" label="Shop phone *" value={sk.shop_phone} onChange={(v) => setSk({ ...sk, shop_phone: v })} required />
            <div className="space-y-1.5">
              <Label htmlFor="sd">Shop description</Label>
              <Textarea id="sd" value={sk.shop_description} onChange={(e) => setSk({ ...sk, shop_description: e.target.value })} rows={3} />
            </div>
            <Button type="submit" disabled={submit.isPending} className="h-11 w-full rounded-xl">
              {submit.isPending ? "Submitting…" : "Submit application"}
            </Button>
          </form>
        )
      ) : (
        isDelivery ? <Already label="You are already a delivery partner."/> : (
          <form onSubmit={(e) => { e.preventDefault(); submit.mutate(); }} className="space-y-4 rounded-xl border border-border/70 bg-card p-4">
            <FieldText id="vt" label="Vehicle type *" value={dp.vehicle_type} onChange={(v) => setDp({ ...dp, vehicle_type: v })} required placeholder="e.g. Bike, Scooter"/>
            <FieldText id="vn" label="Vehicle number *" value={dp.vehicle_number} onChange={(v) => setDp({ ...dp, vehicle_number: v })} required />
            <FieldText id="dpp" label="Phone *" value={dp.phone} onChange={(v) => setDp({ ...dp, phone: v })} required />
            <FieldText id="dl" label="Driving license (optional)" value={dp.license} onChange={(v) => setDp({ ...dp, license: v })} />
            <Button type="submit" disabled={submit.isPending} className="h-11 w-full rounded-xl">
              {submit.isPending ? "Submitting…" : "Submit application"}
            </Button>
          </form>
        )
      )}
    </div>
  );
}

function Tab({ active, onClick, icon, label, disabled }: any) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className={`press flex h-10 items-center justify-center gap-2 rounded-xl text-meta font-semibold transition-colors ${
        disabled ? "cursor-not-allowed bg-muted opacity-50" :
        active ? "bg-foreground text-background" : "bg-card text-foreground shadow-soft"
      }`}>
      {icon}{label}
    </button>
  );
}

function FieldText({ id, label, value, onChange, required, placeholder }: { id: string; label: string; value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-small text-muted-foreground">{label}</Label>
      <Input id={id} value={value} required={required} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Already({ label }: { label: string }) {
  return <div className="rounded-xl bg-primary-soft p-4 text-meta font-medium text-primary-ink">{label}</div>;
}

function StatusPill({ status, reason }: { status: string; reason?: string | null }) {
  const map: Record<string, { c: string; Icon: any; label: string }> = {
    pending: { c: "bg-tint-sun text-warning-foreground", Icon: Clock, label: "Pending" },
    approved: { c: "bg-primary-soft text-primary-ink", Icon: Check, label: "Approved" },
    rejected: { c: "bg-destructive/10 text-destructive", Icon: X, label: "Rejected" },
  };
  const m = map[status] ?? map.pending;
  return (
    <div className="flex flex-col items-end">
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-semibold ${m.c}`}>
        <m.Icon className="h-3 w-3"/>{m.label}
      </span>
      {reason && status === "rejected" && <span className="text-caption text-muted-foreground mt-1">{reason}</span>}
    </div>
  );
}
