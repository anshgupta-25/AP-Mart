import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { LogOut, Mail, Shield, User as UserIcon, Phone } from "lucide-react";
import { DeleteAccountSection } from "@/components/DeleteAccountSection";

export const Route = createFileRoute("/support/profile")({
  head: () => ({ meta: [{ title: "Support Profile — AP Mart" }] }),
  component: Page,
});

function Page() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!user) return;
    (supabase as any).from("support_agents").select("display_name, is_active").eq("user_id", user.id).maybeSingle()
      .then(({ data }: any) => {
        setName(data?.display_name ?? "");
        setActive(data?.is_active ?? true);
      });
    (supabase as any).from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle()
      .then(({ data }: any) => {
        setFullName(data?.full_name ?? "");
        setPhone(data?.phone ?? "");
      });
  }, [user]);

  const save = async () => {
    if (!user) return;
    setBusy(true);
    const [r1, r2] = await Promise.all([
      (supabase as any).from("support_agents").upsert({
        user_id: user.id, display_name: name, is_active: active,
      }),
      (supabase as any).from("profiles").upsert({
        id: user.id, full_name: fullName, phone,
      }),
    ]);
    setBusy(false);
    const err = r1.error || r2.error;
    if (err) toast.error(err.message);
    else toast.success("Profile saved");
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    toast.success("Signed out");
    navigate({ to: "/login" });
  };

  return (
    <div className="p-4 md:p-6 max-w-xl mx-auto space-y-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Your support agent details.</p>
      </div>

      {/* Identity card */}
      <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-4">
        <div className="h-14 w-14 rounded-full grid place-items-center bg-primary/15 text-primary font-bold text-xl">
          {(fullName || name || user?.email || "S").slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold truncate">{fullName || name || "Support Agent"}</div>
          <div className="text-xs text-muted-foreground flex items-center gap-1 truncate">
            <Mail className="h-3 w-3" /> {user?.email}
          </div>
          <div className="text-[10px] uppercase font-bold mt-1 inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary px-2 py-0.5">
            <Shield className="h-3 w-3" /> Support
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="text-xs font-bold text-muted-foreground uppercase">Details</div>

        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1"><UserIcon className="h-3 w-3" /> Full name</Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Display name (shown on tickets)</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Eshan T." />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1"><Phone className="h-3 w-3" /> Phone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91…" />
        </div>

        <label className="flex items-center gap-2 text-sm pt-1 select-none">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Available for new ticket assignments
        </label>

        <Button onClick={save} disabled={busy} className="gradient-primary text-primary-foreground w-full sm:w-auto">
          {busy ? "Saving…" : "Save changes"}
        </Button>
      </div>

      {/* Account actions */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="text-xs font-bold text-muted-foreground uppercase">Account</div>
        <Button
          variant="destructive"
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full"
        >
          <LogOut className="h-4 w-4 mr-2" />
          {signingOut ? "Signing out…" : "Log out"}
        </Button>
      </div>

      <DeleteAccountSection />
    </div>
  );
}
