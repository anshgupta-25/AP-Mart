import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { RoleShell } from "@/components/RoleShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { SHOPKEEPER_NAV } from "./shopkeeper.dashboard";
import { LocationPicker } from "@/components/maps/LocationPicker";
import { Store, User as UserIcon, LogOut, Package, ClipboardList, Clock, Wallet, ShieldCheck, Mail } from "lucide-react";
import { rupees } from "@/lib/format";
import { DeleteAccountSection } from "@/components/DeleteAccountSection";

export const Route = createFileRoute("/shopkeeper/settings")({ component: Page });

function Page() {
  const { user, signOut, roles } = useAuth() as any;
  const navigate = useNavigate();
  const [shop, setShop] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("shops").select("*").eq("owner_id", user.id).maybeSingle().then(({ data }) => setShop(data));
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) =>
      setProfile(data ?? { id: user.id, full_name: "", phone: "", avatar_url: "" }),
    );
  }, [user]);

  // Stats — only when shop loaded
  const stats = useQuery({
    queryKey: ["shopkeeper-account-stats", shop?.id],
    queryFn: async () => {
      if (!shop) return null;
      const [{ count: products }, { count: orders }, { data: rev }, { count: pending }] = await Promise.all([
        supabase.from("shop_products").select("id", { count: "exact", head: true }).eq("shop_id", shop.id),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("shop_id", shop.id),
        supabase.from("orders").select("total").eq("shop_id", shop.id).eq("status", "delivered"),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).in("status", ["placed", "accepted_by_shop", "packing", "packed"]),
      ]);
      const revenue = (rev ?? []).reduce((s: number, r: any) => s + Number(r.total || 0), 0);
      return { products: products ?? 0, orders: orders ?? 0, revenue, pending: pending ?? 0 };
    },
    enabled: !!shop,
  });

  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: user.id, full_name: profile.full_name ?? "", phone: profile.phone ?? "", avatar_url: profile.avatar_url ?? "" });
    setSavingProfile(false);
    if (error) toast.error(error.message); else toast.success("Profile updated");
  };

  const saveShop = async () => {
    const { error } = await supabase
      .from("shops")
      .update({
        name: shop.name, is_open: shop.is_open, phone: shop.phone, address: shop.address,
        city: shop.city, pincode: shop.pincode, latitude: shop.latitude, longitude: shop.longitude,
        service_radius_km: shop.service_radius_km,
      })
      .eq("id", shop.id);
    if (error) toast.error(error.message); else toast.success("Shop saved");
  };

  const onSignOut = async () => {
    await signOut();
    navigate({ to: "/login", replace: true });
  };

  const initials = (profile?.full_name || user?.email || "S").trim().charAt(0).toUpperCase();

  return (
    <RoleShell role="shopkeeper" nav={SHOPKEEPER_NAV} requireRoles={["shopkeeper", "admin"]}>
      <div className="p-4 md:p-6 max-w-3xl space-y-6">
        {/* Hero */}
        <div className="rounded-3xl gradient-hero border border-border p-5 flex items-center gap-4">
          <Avatar className="h-16 w-16 ring-2 ring-primary/30">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="font-bold text-lg">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="font-display text-xl font-extrabold truncate">{profile?.full_name || "Shopkeeper"}</div>
            <div className="text-xs text-muted-foreground inline-flex items-center gap-1 truncate"><Mail className="h-3 w-3" />{user?.email}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {(roles ?? []).map((r: string) => (
                <span key={r} className="text-[10px] font-bold uppercase rounded-full bg-primary/15 text-primary px-2 py-0.5 inline-flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" />{r}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Stats */}
        {shop && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={Package} label="Products" value={String(stats.data?.products ?? "—")} />
            <StatCard icon={ClipboardList} label="Orders" value={String(stats.data?.orders ?? "—")} />
            <StatCard icon={Wallet} label="Revenue" value={stats.data ? rupees(stats.data.revenue) : "—"} />
            <StatCard icon={Clock} label="In progress" value={String(stats.data?.pending ?? "—")} />
          </div>
        )}

        {/* Profile */}
        <section className="rounded-3xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-display text-lg font-bold flex items-center gap-2 mb-4"><UserIcon className="h-5 w-5 text-primary" /> Personal info</h2>
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Full name">
              <Input value={profile?.full_name ?? ""} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} placeholder="Your name" />
            </Field>
            <Field label="Phone">
              <Input value={profile?.phone ?? ""} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="+91…" />
            </Field>
            <Field label="Email"><Input value={user?.email ?? ""} disabled /></Field>
            <Field label="Avatar URL">
              <Input value={profile?.avatar_url ?? ""} onChange={(e) => setProfile({ ...profile, avatar_url: e.target.value })} placeholder="https://…" />
            </Field>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={saveProfile} disabled={savingProfile} className="rounded-xl gradient-primary text-primary-foreground">Save profile</Button>
          </div>
        </section>

        {/* Shop */}
        <section className="rounded-3xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-display text-lg font-bold flex items-center gap-2 mb-4"><Store className="h-5 w-5 text-primary" /> Shop settings</h2>
          {!shop ? <p className="text-muted-foreground">No shop assigned.</p> : (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-2xl border border-border bg-background p-3">
                <div>
                  <div className="text-sm font-bold">Shop open</div>
                  <div className="text-xs text-muted-foreground">Customers can place orders when on.</div>
                </div>
                <Switch checked={shop.is_open} onCheckedChange={(v) => setShop({ ...shop, is_open: v })} />
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <Field label="Name"><Input value={shop.name ?? ""} onChange={(e) => setShop({ ...shop, name: e.target.value })} /></Field>
                <Field label="Phone"><Input value={shop.phone ?? ""} onChange={(e) => setShop({ ...shop, phone: e.target.value })} /></Field>
                <Field label="Address" className="md:col-span-2"><Input value={shop.address ?? ""} onChange={(e) => setShop({ ...shop, address: e.target.value })} /></Field>
                <Field label="City"><Input value={shop.city ?? ""} onChange={(e) => setShop({ ...shop, city: e.target.value })} /></Field>
                <Field label="Pincode"><Input value={shop.pincode ?? ""} onChange={(e) => setShop({ ...shop, pincode: e.target.value })} /></Field>
                <Field label="Service radius (km)" className="md:col-span-2">
                  <Input type="number" step="0.5" min="0.5" max="50" value={shop.service_radius_km ?? 8}
                    onChange={(e) => setShop({ ...shop, service_radius_km: Number(e.target.value) })} />
                </Field>
              </div>
              <Field label="Shop location (pin on map)">
                <LocationPicker
                  value={shop.latitude != null && shop.longitude != null ? { lat: shop.latitude, lng: shop.longitude } : null}
                  onChange={(v) => setShop({ ...shop, latitude: v.lat, longitude: v.lng })}
                />
              </Field>
              <div className="flex justify-end">
                <Button onClick={saveShop} className="rounded-xl gradient-primary text-primary-foreground">Save shop</Button>
              </div>
            </div>
          )}
        </section>

        <Separator />

        <div className="flex justify-end">
          <Button onClick={onSignOut} variant="outline" className="rounded-xl text-destructive hover:bg-destructive/10">
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
        <DeleteAccountSection />
      </div>
    </RoleShell>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="text-xs font-bold text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold"><Icon className="h-4 w-4 text-primary" />{label}</div>
      <div className="mt-1 font-display text-xl font-extrabold truncate">{value}</div>
    </div>
  );
}
