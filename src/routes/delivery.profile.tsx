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
import { DELIVERY_NAV } from "./delivery.dashboard";
import { Truck, User as UserIcon, LogOut, Star, CheckCircle2, Clock, Mail, Power, ShieldCheck, Bike, LifeBuoy, MessageCircle, ChevronRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { SupportTicketForm } from "@/components/SupportTicketForm";
import { DeleteAccountSection } from "@/components/DeleteAccountSection";

export const Route = createFileRoute("/delivery/profile")({ component: Page });

function Page() {
  const { user, signOut, roles } = useAuth() as any;
  const navigate = useNavigate();
  const [partner, setPartner] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPartner, setSavingPartner] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("delivery_partners").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => setPartner(data));
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) =>
      setProfile(data ?? { id: user.id, full_name: "", phone: "", avatar_url: "" }),
    );
  }, [user]);

  const stats = useQuery({
    queryKey: ["delivery-account-stats", partner?.id],
    queryFn: async () => {
      if (!partner) return null;
      const [{ count: delivered }, { count: active }, { data: hoursData }, { data: weekRows }] = await Promise.all([
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("partner_id", partner.id).eq("status", "delivered"),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("partner_id", partner.id).in("status", ["packed", "out_for_delivery"]),
        supabase.rpc("partner_today_hours", { _partner_id: partner.id }),
        supabase.from("partner_attendance")
          .select("check_in_at, check_out_at")
          .eq("partner_id", partner.id)
          .gte("check_in_at", new Date(Date.now() - 7 * 86400000).toISOString()),
      ]);
      const weekHours = (weekRows ?? []).reduce((sum: number, r: any) => {
        const out = r.check_out_at ? new Date(r.check_out_at) : new Date();
        return sum + (out.getTime() - new Date(r.check_in_at).getTime()) / 3.6e6;
      }, 0);
      return {
        delivered: delivered ?? 0,
        active: active ?? 0,
        todayHours: Number(hoursData ?? 0),
        weekHours,
      };
    },
    enabled: !!partner,
    refetchInterval: 60000,
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

  const savePartner = async () => {
    if (!partner) return;
    setSavingPartner(true);
    const { error } = await supabase
      .from("delivery_partners")
      .update({ name: partner.name, phone: partner.phone, vehicle: partner.vehicle })
      .eq("id", partner.id);
    setSavingPartner(false);
    if (error) toast.error(error.message); else toast.success("Partner info saved");
  };

  const toggleOnline = async (v: boolean) => {
    if (!partner) return;
    const { error } = await supabase.from("delivery_partners").update({ is_online: v }).eq("id", partner.id);
    if (error) toast.error(error.message); else setPartner({ ...partner, is_online: v });
  };

  const onSignOut = async () => {
    await signOut();
    navigate({ to: "/login", replace: true });
  };

  const initials = (profile?.full_name || partner?.name || user?.email || "D").trim().charAt(0).toUpperCase();

  return (
    <RoleShell role="delivery" nav={DELIVERY_NAV} requireRoles={["delivery", "admin"]}>
      <div className="p-4 md:p-6 max-w-3xl space-y-6">
        {/* Hero */}
        <div className="rounded-3xl gradient-hero border border-border p-5">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 ring-2 ring-primary/30">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="font-bold text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="font-display text-xl font-extrabold truncate">{profile?.full_name || partner?.name || "Delivery Partner"}</div>
              <div className="text-xs text-muted-foreground inline-flex items-center gap-1 truncate"><Mail className="h-3 w-3" />{user?.email}</div>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 inline-flex items-center gap-1 ${partner?.is_online ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>
                  <Power className="h-3 w-3" />{partner?.is_online ? "Online" : "Offline"}
                </span>
                {(roles ?? []).map((r: string) => (
                  <span key={r} className="text-[10px] font-bold uppercase rounded-full bg-secondary px-2 py-0.5 inline-flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" />{r}
                  </span>
                ))}
              </div>
            </div>
          </div>
          {partner && (
            <div className="mt-4 flex items-center justify-between rounded-2xl bg-card/60 backdrop-blur border border-border p-3">
              <div>
                <div className="text-sm font-bold">Availability</div>
                <div className="text-xs text-muted-foreground">Toggle to accept new orders.</div>
              </div>
              <Switch checked={partner.is_online ?? false} onCheckedChange={toggleOnline} />
            </div>
          )}
        </div>

        {/* Stats */}
        {partner && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={CheckCircle2} label="Delivered" value={String(stats.data?.delivered ?? "—")} />
            <StatCard icon={Truck} label="Active" value={String(stats.data?.active ?? "—")} />
            <StatCard icon={Clock} label="Today" value={stats.data ? `${stats.data.todayHours.toFixed(1)}h` : "—"} />
            <StatCard icon={Star} label="Rating" value={partner.rating ? Number(partner.rating).toFixed(1) : "—"} />
          </div>
        )}

        {/* Personal info */}
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

        {/* Partner info */}
        {partner && (
          <section className="rounded-3xl border border-border bg-card p-5 shadow-card">
            <h2 className="font-display text-lg font-bold flex items-center gap-2 mb-4"><Bike className="h-5 w-5 text-primary" /> Delivery details</h2>
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Display name">
                <Input value={partner.name ?? ""} onChange={(e) => setPartner({ ...partner, name: e.target.value })} />
              </Field>
              <Field label="Partner phone">
                <Input value={partner.phone ?? ""} onChange={(e) => setPartner({ ...partner, phone: e.target.value })} placeholder="Number customers see" />
              </Field>
              <Field label="Vehicle" className="md:col-span-2">
                <Input value={partner.vehicle ?? ""} onChange={(e) => setPartner({ ...partner, vehicle: e.target.value })} placeholder="e.g. Bike — MH12 AB 1234" />
              </Field>
            </div>
            <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
              <div className="text-xs text-muted-foreground">
                This week: <span className="font-bold text-foreground">{stats.data?.weekHours.toFixed(1) ?? "0.0"}h</span> worked
              </div>
              <Button onClick={savePartner} disabled={savingPartner} className="rounded-xl gradient-primary text-primary-foreground">Save details</Button>
            </div>
          </section>
        )}

        {/* Help & Support */}
        <section className="rounded-3xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-display text-lg font-bold flex items-center gap-2 mb-4"><LifeBuoy className="h-5 w-5 text-primary" /> Help & Support</h2>
          <div className="grid gap-2">
            <Link to="/support/my-tickets" className="flex items-center justify-between rounded-2xl border border-border bg-background hover:bg-secondary transition p-3">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary"><MessageCircle className="h-4 w-4" /></span>
                <div>
                  <div className="text-sm font-bold">My tickets</div>
                  <div className="text-xs text-muted-foreground">View your past support requests</div>
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
                  <div className="text-sm font-bold">Contact support</div>
                  <div className="text-xs text-muted-foreground">Raise a new ticket for any issue</div>
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

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold"><Icon className="h-4 w-4 text-primary" />{label}</div>
      <div className="mt-1 font-display text-xl font-extrabold truncate">{value}</div>
    </div>
  );
}
