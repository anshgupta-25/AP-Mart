import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  User as UserIcon, MapPin, Package, Heart, Bell, Headphones, LogOut, ChevronRight, Shield, Briefcase,
  ShieldCheck, Info,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { SupportTicketForm } from "@/components/SupportTicketForm";
import { DeleteAccountSection } from "@/components/DeleteAccountSection";

export const Route = createFileRoute("/customer/profile")({
  head: () => ({ meta: [{ title: "Account — AP Mart" }] }),
  component: AppProfile,
});

function AppProfile() {
  const { user, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

  const profile = useQuery({
    queryKey: ["app-profile", user?.id],
    queryFn: async () =>
      user ? (await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()).data : null,
    enabled: !!user,
  });

  const addresses = useQuery({
    queryKey: ["app-addresses", user?.id],
    queryFn: async () =>
      user ? (await supabase.from("addresses").select("*").eq("user_id", user.id)).data ?? [] : [],
    enabled: !!user,
  });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (profile.data) {
      setName(profile.data.full_name ?? "");
      setPhone(profile.data.phone ?? "");
    }
  }, [profile.data]);

  const save = async () => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ full_name: name, phone }).eq("id", user.id);
    if (error) toast.error(error.message);
    else { toast.success("Profile updated"); setEditing(false); profile.refetch(); }
  };

  const initials = (profile.data?.full_name ?? user?.email ?? "U").slice(0, 2).toUpperCase();

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Profile card */}
      <div className="rounded-3xl gradient-hero border border-border p-5 shadow-card flex items-center gap-4">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-foreground text-background font-bold text-lg">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display text-lg font-extrabold truncate">{profile.data?.full_name ?? "Welcome"}</div>
          <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
        </div>
        <Button size="sm" variant="outline" className="rounded-full" onClick={() => setEditing((v) => !v)}>
          {editing ? "Close" : "Edit"}
        </Button>
      </div>

      {editing && (
        <div className="rounded-3xl border border-border bg-card p-4 shadow-card space-y-3">
          <div>
            <Label htmlFor="n">Full name</Label>
            <Input id="n" value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl mt-1" />
          </div>
          <div>
            <Label htmlFor="p">Phone</Label>
            <Input id="p" value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded-xl mt-1" />
          </div>
          <Button onClick={save} className="w-full rounded-xl gradient-primary text-primary-foreground">Save</Button>
        </div>
      )}

      {/* Menu */}
      <div className="rounded-3xl border border-border bg-card shadow-card overflow-hidden">
        <Row to="/customer/orders" icon={<Package className="h-5 w-5" />} label="My orders" />
        <Row to="/customer/wishlist" icon={<Heart className="h-5 w-5" />} label="Wishlist" />
        <Row to="/customer/address-setup" icon={<MapPin className="h-5 w-5" />} label={`Delivery address (${addresses.data?.length ?? 0})`} />
        <Row to="/customer/notifications" icon={<Bell className="h-5 w-5" />} label="Notifications" />
        <Row to="/customer/apply" icon={<Briefcase className="h-5 w-5" />} label="Become a partner" />
        {isAdmin && <Row to="/admin/dashboard" icon={<Shield className="h-5 w-5" />} label="Admin panel" />}
        <RowButton onClick={() => setSupportOpen(true)} icon={<Headphones className="h-5 w-5" />} label="Help & support" />
        <Row to="/customer/privacy" icon={<ShieldCheck className="h-5 w-5" />} label="Privacy Policy" />
        <Row to="/customer/about" icon={<Info className="h-5 w-5" />} label="About AP Mart" />
      </div>


      <SupportTicketForm open={supportOpen} onOpenChange={setSupportOpen} />

      <button
        onClick={async () => { await signOut(); navigate({ to: "/login" }); }}
        className="w-full rounded-2xl border border-destructive/30 bg-destructive/10 text-destructive font-bold py-3 inline-flex items-center justify-center gap-2"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>

      <DeleteAccountSection />

      <div className="text-center text-[11px] text-muted-foreground pt-2">AP Mart • v1.0</div>
    </div>
  );
}

function Row({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link to={to as any} className="flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0 hover:bg-secondary/40 transition">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">{icon}</span>
      <span className="flex-1 font-semibold text-sm">{label}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

function RowButton({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className="w-full text-left flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0 hover:bg-secondary/40 transition">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">{icon}</span>
      <span className="flex-1 font-semibold text-sm">{label}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}
