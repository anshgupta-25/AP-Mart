import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { PageHeader } from "@/components/data";
import {
  Truck,
  User as UserIcon,
  LogOut,
  Star,
  CheckCircle2,
  Clock,
  Mail,
  Power,
  ShieldCheck,
  Bike,
  LifeBuoy,
  MessageCircle,
  ChevronRight,
} from "lucide-react";
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
    supabase
      .from("delivery_partners")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setPartner(data));
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) =>
        setProfile(data ?? { id: user.id, full_name: "", phone: "", avatar_url: "" }),
      );
  }, [user]);

  const stats = useQuery({
    queryKey: ["delivery-account-stats", partner?.id],
    queryFn: async () => {
      if (!partner) return null;
      const [{ count: delivered }, { count: active }, { data: hoursData }, { data: weekRows }] =
        await Promise.all([
          supabase
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("partner_id", partner.id)
            .eq("status", "delivered"),
          supabase
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("partner_id", partner.id)
            .in("status", ["packed", "out_for_delivery"]),
          supabase.rpc("partner_today_hours", { _partner_id: partner.id }),
          supabase
            .from("partner_attendance")
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
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      full_name: profile.full_name ?? "",
      phone: profile.phone ?? "",
      avatar_url: profile.avatar_url ?? "",
    });
    setSavingProfile(false);
    if (error) toast.error(error.message);
    else toast.success("Profile updated");
  };

  const savePartner = async () => {
    if (!partner) return;
    setSavingPartner(true);
    const { error } = await supabase
      .from("delivery_partners")
      .update({ name: partner.name, phone: partner.phone, vehicle: partner.vehicle })
      .eq("id", partner.id);
    setSavingPartner(false);
    if (error) toast.error(error.message);
    else toast.success("Partner info saved");
  };

  const toggleOnline = async (v: boolean) => {
    if (!partner) return;
    const { error } = await supabase
      .from("delivery_partners")
      .update({ is_online: v })
      .eq("id", partner.id);
    if (error) toast.error(error.message);
    else setPartner({ ...partner, is_online: v });
  };

  const onSignOut = async () => {
    await signOut();
    navigate({ to: "/login", replace: true });
  };

  const initials = (profile?.full_name || partner?.name || user?.email || "D")
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <>
      <div className="space-y-5 px-4 py-4 md:px-6">
        <PageHeader title="Account" />

        <div className="rounded-xl border border-border/70 bg-card p-4">
          <div className="flex items-center gap-3.5">
            <Avatar className="h-14 w-14">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary-soft text-base font-semibold text-primary-ink">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate text-subtitle font-semibold">
                {profile?.full_name || partner?.name || "Delivery Partner"}
              </div>
              <div className="mt-0.5 flex items-center gap-1 truncate text-small text-muted-foreground">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                {user?.email}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-caption font-semibold ${partner?.is_online ? "bg-primary-soft text-primary-ink" : "bg-secondary text-muted-foreground"}`}
                >
                  <Power className="h-3 w-3" />
                  {partner?.is_online ? "Online" : "Offline"}
                </span>
                {(roles ?? []).map((r: string) => (
                  <span
                    key={r}
                    className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-caption font-semibold capitalize"
                  >
                    <ShieldCheck className="h-3 w-3" />
                    {r}
                  </span>
                ))}
              </div>
            </div>
          </div>
          {partner && (
            <div className="mt-3.5 flex items-center justify-between rounded-lg bg-secondary px-3.5 py-2.5">
              <div>
                <div className="text-body font-semibold">Availability</div>
                <div className="text-small text-muted-foreground">
                  Turn on to accept new orders.
                </div>
              </div>
              <Switch checked={partner.is_online ?? false} onCheckedChange={toggleOnline} />
            </div>
          )}
        </div>

        {partner && (
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={CheckCircle2}
              label="Delivered"
              value={String(stats.data?.delivered ?? "—")}
              tint="bg-tint-mint"
            />
            <StatCard
              icon={Truck}
              label="Active"
              value={String(stats.data?.active ?? "—")}
              tint="bg-tint-sky"
            />
            <StatCard
              icon={Clock}
              label="Today"
              value={stats.data ? `${stats.data.todayHours.toFixed(1)}h` : "—"}
              tint="bg-tint-peach"
            />
            <StatCard
              icon={Star}
              label="Rating"
              value={partner.rating ? Number(partner.rating).toFixed(1) : "—"}
              tint="bg-tint-sun"
            />
          </div>
        )}

        <section className="space-y-3">
          <h2 className="section-title">Personal info</h2>
          <div className="space-y-3.5 rounded-xl border border-border/70 bg-card p-4">
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
            <Button
              onClick={saveProfile}
              disabled={savingProfile}
              className="h-11 w-full rounded-xl"
            >
              Save profile
            </Button>
          </div>
        </section>

        {partner && (
          <section className="space-y-3">
            <h2 className="section-title">Delivery details</h2>
            <div className="space-y-3.5 rounded-xl border border-border/70 bg-card p-4">
              <Field label="Display name">
                <Input
                  value={partner.name ?? ""}
                  onChange={(e) => setPartner({ ...partner, name: e.target.value })}
                />
              </Field>
              <Field label="Partner phone">
                <Input
                  value={partner.phone ?? ""}
                  onChange={(e) => setPartner({ ...partner, phone: e.target.value })}
                  placeholder="Number customers see"
                />
              </Field>
              <Field label="Vehicle">
                <Input
                  value={partner.vehicle ?? ""}
                  onChange={(e) => setPartner({ ...partner, vehicle: e.target.value })}
                  placeholder="e.g. Bike — MH12 AB 1234"
                />
              </Field>
              <div className="text-small text-muted-foreground">
                This week:{" "}
                <span className="font-semibold text-foreground">
                  {stats.data?.weekHours.toFixed(1) ?? "0.0"}h
                </span>{" "}
                worked
              </div>
              <Button
                onClick={savePartner}
                disabled={savingPartner}
                className="h-11 w-full rounded-xl"
              >
                Save details
              </Button>
            </div>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="section-title">Help & support</h2>
          <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70 bg-card">
            <Link
              to="/support/my-tickets"
              className="press flex min-h-12 items-center justify-between gap-3 px-4 py-2.5"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-tint-mint text-primary-ink">
                  <MessageCircle className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-body font-medium">My tickets</div>
                  <div className="text-small text-muted-foreground">View past support requests</div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <button
              type="button"
              onClick={() => setTicketOpen(true)}
              className="press flex min-h-12 w-full items-center justify-between gap-3 px-4 py-2.5 text-left"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-tint-sky text-foreground/70">
                  <LifeBuoy className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-body font-medium">Contact support</div>
                  <div className="text-small text-muted-foreground">Raise a new ticket</div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </section>
        <SupportTicketForm open={ticketOpen} onOpenChange={setTicketOpen} />

        <Button
          onClick={onSignOut}
          variant="secondary"
          className="h-11 w-full rounded-xl text-destructive"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
        <DeleteAccountSection />
      </div>
    </>
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
      <label className="text-small font-medium text-muted-foreground">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: any;
  label: string;
  value: string;
  tint: string;
}) {
  return (
    <div className={`rounded-xl p-3.5 ${tint}`}>
      <Icon className="h-[18px] w-[18px] text-foreground/60" />
      <div className="mt-2.5 text-page font-bold leading-none tracking-tight">{value}</div>
      <div className="mt-1 text-small text-foreground/60">{label}</div>
    </div>
  );
}
