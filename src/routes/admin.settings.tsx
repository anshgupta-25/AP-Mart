import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
  User as UserIcon,
  Mail,
  ShieldCheck,
  LogOut,
  LifeBuoy,
  MessageCircle,
  ChevronRight,
  Bell,
  Store,
  Truck,
  Tag,
  Settings as SettingsIcon,
  ShoppingBag,
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
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) =>
        setProfile(data ?? { id: user.id, full_name: "", phone: "", avatar_url: "" }),
      );
    supabase
      .from("app_config")
      .select("value")
      .eq("key", "enable_customer_shop_selection")
      .maybeSingle()
      .then(({ data }) => {
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
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      full_name: profile.full_name ?? "",
      phone: profile.phone ?? "",
      avatar_url: profile.avatar_url ?? "",
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Profile updated");
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
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-4 md:px-6 md:py-6">
      {/* Hero */}
      <div className="rounded-xl bg-tint-mint p-5 md:p-6">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 ring-4 ring-card">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-card text-lg font-semibold">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-page font-semibold tracking-tight">
              {profile?.full_name || "Admin"}
            </div>
            <div className="inline-flex items-center gap-1 truncate text-meta text-foreground/60">
              <Mail className="h-3 w-3" />
              {user?.email}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {(roles ?? []).map((r: string) => (
                <span
                  key={r}
                  className="inline-flex items-center gap-1 rounded-full bg-card px-2.5 py-0.5 text-caption font-semibold capitalize"
                >
                  <ShieldCheck className="h-3 w-3" />
                  {r}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Personal info */}
      <section className="rounded-xl border border-border/70 bg-card p-4">
        <h2 className="section-title mb-4 flex items-center gap-2">
          <UserIcon className="h-5 w-5 text-primary" /> Personal info
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Full name">
            <Input
              value={profile?.full_name ?? ""}
              onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
              placeholder="Your name"
            />
          </Field>
          <Field label="Phone">
            <Input
              value={profile?.phone ?? ""}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              placeholder="+91…"
            />
          </Field>
          <Field label="Email">
            <Input value={user?.email ?? ""} disabled />
          </Field>
          <Field label="Avatar URL">
            <Input
              value={profile?.avatar_url ?? ""}
              onChange={(e) => setProfile({ ...profile, avatar_url: e.target.value })}
              placeholder="https://…"
            />
          </Field>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={saveProfile} disabled={saving}>
            Save profile
          </Button>
        </div>
      </section>

      {/* Quick settings */}
      <section className="rounded-xl border border-border/70 bg-card p-4">
        <h2 className="section-title mb-4 flex items-center gap-2">
          <SettingsIcon className="h-5 w-5 text-primary" /> Quick settings
        </h2>
        <div className="grid sm:grid-cols-2 gap-2">
          {quickLinks.map((l) => {
            const Icon = l.icon;
            return (
              <Link
                key={l.to}
                to={l.to}
                className="press flex items-center justify-between rounded-xl bg-secondary/70 p-3.5 transition hover:bg-secondary"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-tint-mint text-primary-ink">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="text-body font-semibold">{l.label}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            );
          })}
        </div>
      </section>

      {/* Storefront settings */}
      <section className="rounded-xl border border-border/70 bg-card p-4">
        <h2 className="section-title mb-4 flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-primary" /> Storefront
        </h2>
        <div className="flex items-start justify-between gap-4 rounded-xl bg-secondary/70 p-3.5">
          <div className="min-w-0">
            <div className="text-body font-semibold">Enable customer shop selection</div>
            <div className="mt-1 text-small text-muted-foreground">
              When on, customers can pick which nearby shop fulfils an item on the product page.
              When off, the system auto-assigns the best shop.
            </div>
          </div>
          <Switch
            checked={shopSelectionEnabled}
            disabled={savingShopSel}
            onCheckedChange={toggleShopSelection}
          />
        </div>
      </section>

      {/* Help & Support */}

      <section className="rounded-xl border border-border/70 bg-card p-4">
        <h2 className="section-title mb-4 flex items-center gap-2">
          <LifeBuoy className="h-5 w-5 text-primary" /> Help & Support
        </h2>
        <div className="grid gap-2">
          <Link
            to="/admin/support"
            className="press flex items-center justify-between rounded-xl bg-secondary/70 p-3.5 transition hover:bg-secondary"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-tint-mint text-primary-ink">
                <MessageCircle className="h-4 w-4" />
              </span>
              <div>
                <div className="text-body font-semibold">Support inbox</div>
                <div className="text-small text-muted-foreground">
                  Manage customer support tickets
                </div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
          <button
            type="button"
            onClick={() => setTicketOpen(true)}
            className="press flex w-full items-center justify-between rounded-xl bg-secondary/70 p-3.5 text-left transition hover:bg-secondary"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-tint-mint text-primary-ink">
                <LifeBuoy className="h-4 w-4" />
              </span>
              <div>
                <div className="text-body font-semibold">Raise internal ticket</div>
                <div className="text-small text-muted-foreground">
                  Report an issue or request help
                </div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </section>
      <SupportTicketForm open={ticketOpen} onOpenChange={setTicketOpen} />

      <Separator />

      <div className="flex justify-end">
        <Button
          onClick={onSignOut}
          variant="secondary"
          className="w-full text-destructive sm:w-auto"
        >
          <LogOut className="h-4 w-4 mr-2" /> Sign out
        </Button>
      </div>
      <DeleteAccountSection />
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-meta font-medium text-muted-foreground">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
