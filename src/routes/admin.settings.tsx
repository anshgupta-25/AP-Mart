import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RoleShell } from "@/components/RoleShell";
import { ADMIN_NAV } from "./admin.dashboard";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { SupportTicketForm } from "@/components/SupportTicketForm";
import { toast } from "sonner";
import {
  User as UserIcon, Mail, ShieldCheck, LogOut, LifeBuoy, MessageCircle, ChevronRight,
  Bell, Store, Truck, Tag, Settings as SettingsIcon, ShoppingBag,
} from "lucide-react";
import { DeleteAccountSection } from "@/components/DeleteAccountSection";


export const Route = createFileRoute("/admin/settings")({ component: Page });

function Page() {
  const { user, signOut, roles } = useAuth() as any;
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [shopSelectionEnabled, setShopSelectionEnabled] = useState<boolean>(true);
  const [savingShopSel, setSavingShopSel] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) =>
      setProfile(data ?? { id: user.id, full_name: "", phone: "", avatar_url: "" }),
    );
    supabase.from("app_config").select("value").eq("key", "enable_customer_shop_selection").maybeSingle().then(({ data }) => {
      const raw = (data as any)?.value;
      setShopSelectionEnabled(raw === false || raw === "false" ? false : true);
    });
  }, [user]);

  const toggleShopSelection = async (next: boolean) => {
    setSavingShopSel(true);
    setShopSelectionEnabled(next);
    const { error } = await (supabase as any)
      .from("app_config")
      .upsert({ key: "enable_customer_shop_selection", value: next }, { onConflict: "key" });
    setSavingShopSel(false);
    if (error) {
      setShopSelectionEnabled(!next);
      toast.error(error.message);
    } else {
      toast.success(`Customer shop selection ${next ? "enabled" : "disabled"}`);
    }
  };


  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: user.id, full_name: profile.full_name ?? "", phone: profile.phone ?? "", avatar_url: profile.avatar_url ?? "" });
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Profile updated");
  };

  const onSignOut = async () => {
    await signOut();
    navigate({ to: "/login", replace: true });
  };

  const initials = (profile?.full_name || user?.email || "A").trim().charAt(0).toUpperCase();

  const quickLinks = [
    { to: "/admin/notifications", label: "Notifications", icon: Bell },
    { to: "/admin/shops", label: "Shops", icon: Store },
    { to: "/admin/delivery-partners", label: "Delivery partners", icon: Truck },
    { to: "/admin/categories", label: "Categories", icon: Tag },
  ] as const;

  return (
    <RoleShell role="admin" nav={ADMIN_NAV} requireRoles={["admin"]}>
      <div className="p-4 md:p-6 max-w-3xl space-y-6">
        {/* Hero */}
        <div className="rounded-3xl gradient-hero border border-border p-5">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 ring-2 ring-primary/30">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="font-bold text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="font-display text-xl font-extrabold truncate">
                {profile?.full_name || "Admin"}
              </div>
              <div className="text-xs text-muted-foreground inline-flex items-center gap-1 truncate">
                <Mail className="h-3 w-3" />
                {user?.email}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {(roles ?? []).map((r: string) => (
                  <span key={r} className="text-[10px] font-bold uppercase rounded-full bg-secondary px-2 py-0.5 inline-flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" />{r}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Personal info */}
        <section className="rounded-3xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-display text-lg font-bold flex items-center gap-2 mb-4">
            <UserIcon className="h-5 w-5 text-primary" /> Personal info
          </h2>
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
            <Button onClick={saveProfile} disabled={saving} className="rounded-xl gradient-primary text-primary-foreground">Save profile</Button>
          </div>
        </section>

        {/* Quick settings */}
        <section className="rounded-3xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-display text-lg font-bold flex items-center gap-2 mb-4">
            <SettingsIcon className="h-5 w-5 text-primary" /> Quick settings
          </h2>
          <div className="grid sm:grid-cols-2 gap-2">
            {quickLinks.map((l) => {
              const Icon = l.icon;
              return (
                <Link key={l.to} to={l.to} className="flex items-center justify-between rounded-2xl border border-border bg-background hover:bg-secondary transition p-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary"><Icon className="h-4 w-4" /></span>
                    <div className="text-sm font-bold">{l.label}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        </section>

        {/* Storefront settings */}
        <section className="rounded-3xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-display text-lg font-bold flex items-center gap-2 mb-4">
            <ShoppingBag className="h-5 w-5 text-primary" /> Storefront
          </h2>
          <div className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-background p-3">
            <div className="min-w-0">
              <div className="text-sm font-bold">Enable customer shop selection</div>
              <div className="text-xs text-muted-foreground mt-1">
                When on, customers can pick which nearby shop fulfils an item on the product page.
                When off, the system auto-assigns the best shop.
              </div>
            </div>
            <Switch checked={shopSelectionEnabled} disabled={savingShopSel} onCheckedChange={toggleShopSelection} />
          </div>
        </section>

        {/* Help & Support */}

        <section className="rounded-3xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-display text-lg font-bold flex items-center gap-2 mb-4">
            <LifeBuoy className="h-5 w-5 text-primary" /> Help & Support
          </h2>
          <div className="grid gap-2">
            <Link to="/admin/support" className="flex items-center justify-between rounded-2xl border border-border bg-background hover:bg-secondary transition p-3">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary"><MessageCircle className="h-4 w-4" /></span>
                <div>
                  <div className="text-sm font-bold">Support inbox</div>
                  <div className="text-xs text-muted-foreground">Manage customer support tickets</div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <button
              type="button"
              onClick={() => setTicketOpen(true)}
              className="flex w-full items-center justify-between rounded-2xl border border-border bg-background hover:bg-secondary transition p-3 text-left"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary"><LifeBuoy className="h-4 w-4" /></span>
                <div>
                  <div className="text-sm font-bold">Raise internal ticket</div>
                  <div className="text-xs text-muted-foreground">Report an issue or request help</div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </section>
        <SupportTicketForm open={ticketOpen} onOpenChange={setTicketOpen} />

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
