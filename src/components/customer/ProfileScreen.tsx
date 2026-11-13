import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Bell,
  Briefcase,
  ChevronRight,
  Headphones,
  Heart,
  Info,
  LogOut,
  MapPin,
  Package,
  Plus,
  Shield,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDeliveryContext } from "@/hooks/useDeliveryContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthRequired } from "@/components/AuthRequired";
import { SupportTicketForm } from "@/components/SupportTicketForm";
import { DeleteAccountSection } from "@/components/DeleteAccountSection";
import { patchObject, removeRow, runOptimistic } from "@/lib/optimistic";

const rowCls =
  "press flex min-h-12 w-full items-center gap-3 border-b border-border/60 px-3.5 py-2.5 text-left last:border-b-0 hover:bg-secondary/50";

function IconTile({ tint, children }: { tint: string; children: React.ReactNode }) {
  return (
    <span
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-foreground/75 ${tint}`}
    >
      {children}
    </span>
  );
}
function Row({
  to,
  icon,
  label,
  tint,
  hint,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  tint: string;
  hint?: string;
}) {
  return (
    <Link to={to} className={rowCls}>
      <IconTile tint={tint}>{icon}</IconTile>
      <span className="flex-1 text-body font-medium">{label}</span>
      {hint && <span className="text-meta text-muted-foreground">{hint}</span>}
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
function RowButton({
  onClick,
  icon,
  label,
  tint,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  tint: string;
}) {
  return (
    <button onClick={onClick} className={rowCls}>
      <IconTile tint={tint}>{icon}</IconTile>
      <span className="flex-1 text-body font-medium">{label}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

/**
 * One profile screen for /account and /customer/profile: guest gate, profile form (optimistic save),
 * saved addresses with delete, shortcuts, partner application, admin row, support, sign out, delete account.
 */
export function ProfileScreen({ next }: { next: string }) {
  const { user, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { refresh: refreshDelivery } = useDeliveryContext();
  const [editing, setEditing] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const profile = useQuery({
    queryKey: ["app-profile", user?.id],
    queryFn: async () =>
      user
        ? (await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()).data
        : null,
    enabled: !!user,
  });
  const addresses = useQuery({
    queryKey: ["app-addresses", user?.id],
    queryFn: async () =>
      user
        ? ((await supabase.from("addresses").select("*").eq("user_id", user.id)).data ?? [])
        : [],
    enabled: !!user,
  });

  useEffect(() => {
    if (profile.data) {
      setName(profile.data.full_name ?? "");
      setPhone(profile.data.phone ?? "");
    }
  }, [profile.data]);

  if (!user) {
    return (
      <AuthRequired
        next={next}
        title="Your Account"
        description="Sign in to manage your profile, saved addresses and preferences."
        icon={<MapPin className="h-6 w-6 text-primary" strokeWidth={1.8} />}
      />
    );
  }

  const save = async () => {
    await runOptimistic({
      qc,
      keys: [["app-profile", user.id]],
      updater: patchObject({ full_name: name, phone }),
      request: () => supabase.from("profiles").update({ full_name: name, phone }).eq("id", user.id),
      success: "Profile updated",
    });
    setEditing(false);
  };

  const deleteAddress = async (id: string) => {
    if (!confirm("Delete this address?")) return;
    await runOptimistic({
      qc,
      keys: [["app-addresses", user.id]],
      updater: removeRow(id),
      request: () => supabase.from("addresses").delete().eq("id", id),
      success: "Deleted",
      // The deleted address may have been the delivery address: refresh the header,
      // PIN-code-based catalog, eligible shops and checkout's address list.
      onSuccess: refreshDelivery,
    });
  };

  const initials = (profile.data?.full_name ?? user.email ?? "U").slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 pb-6 pt-4 md:px-6">
      <h1 className="large-title">Profile</h1>

      <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card p-3.5">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary-soft text-body font-semibold text-primary-ink">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-subtitle font-semibold">
            {profile.data?.full_name ?? "Welcome"}
          </div>
          <div className="mt-0.5 truncate text-small text-muted-foreground">{user.email}</div>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="rounded-full px-4"
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? "Close" : "Edit"}
        </Button>
      </div>

      {editing && (
        <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
          <div className="space-y-1.5">
            <Label className="text-meta font-medium">Email</Label>
            <Input value={user.email ?? ""} disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pn" className="text-meta font-medium">
              Full name
            </Label>
            <Input id="pn" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pp" className="text-meta font-medium">
              Phone
            </Label>
            <Input id="pp" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <Button onClick={save} className="h-11 w-full rounded-xl">
            Save changes
          </Button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
        <Row
          to="/customer/orders"
          tint="bg-tint-mint"
          icon={<Package className="h-4 w-4" />}
          label="My orders"
        />
        <Row
          to="/customer/wishlist"
          tint="bg-tint-rose"
          icon={<Heart className="h-4 w-4" />}
          label="Favourites"
        />
        <Row
          to="/customer/notifications"
          tint="bg-tint-sun"
          icon={<Bell className="h-4 w-4" />}
          label="Notifications"
        />
      </div>

      <section className="rounded-xl border border-border/70 bg-card">
        <div className="flex items-center justify-between px-3.5 pb-1 pt-3">
          <h2 className="section-title">Delivery addresses</h2>
          <Link
            to="/customer/address-setup"
            className="press inline-flex items-center gap-1 text-meta font-semibold text-primary"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </Link>
        </div>
        {(addresses.data?.length ?? 0) === 0 ? (
          <div className="px-3.5 pb-3.5 text-meta text-muted-foreground">
            No saved addresses yet.
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {addresses.data?.map((a) => (
              <div
                key={a.id}
                className="flex min-h-12 items-start justify-between gap-3 px-3.5 py-3"
              >
                <div className="min-w-0">
                  <div className="text-body font-semibold">
                    {a.name}{" "}
                    <span className="ml-1.5 rounded-full bg-primary-soft px-2 py-0.5 text-micro font-medium capitalize text-primary-ink">
                      {a.type}
                    </span>
                  </div>
                  <div className="mt-0.5 text-small text-muted-foreground">
                    {a.line1}, {a.city}, {a.state} - {a.pincode}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  aria-label="Delete address"
                  onClick={() => deleteAddress(a.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
        <Row
          to="/customer/apply"
          tint="bg-tint-violet"
          icon={<Briefcase className="h-4 w-4" />}
          label="Become a partner"
        />
        {isAdmin && (
          <Row
            to="/admin/dashboard"
            tint="bg-tint-peach"
            icon={<Shield className="h-4 w-4" />}
            label="Admin panel"
          />
        )}
        <RowButton
          onClick={() => setSupportOpen(true)}
          tint="bg-tint-sky"
          icon={<Headphones className="h-4 w-4" />}
          label="Help & support"
        />
        <Row
          to="/customer/privacy"
          tint="bg-tint-mint"
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Privacy policy"
        />
        <Row
          to="/customer/about"
          tint="bg-tint-peach"
          icon={<Info className="h-4 w-4" />}
          label="About AP Mart"
        />
      </div>

      <SupportTicketForm open={supportOpen} onOpenChange={setSupportOpen} />

      <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
        <button
          onClick={async () => {
            await signOut();
            navigate({ to: "/login" });
          }}
          className="press flex min-h-12 w-full items-center justify-center gap-2 text-body font-semibold text-destructive"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>

      <DeleteAccountSection />

      <div className="pt-1 text-center text-caption text-muted-foreground">AP Mart · v1.0</div>
    </div>
  );
}
