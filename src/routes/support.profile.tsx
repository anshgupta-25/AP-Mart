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
    supabase
      .from("support_agents")
      .select("display_name, is_active")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }: any) => {
        setName(data?.display_name ?? "");
        setActive(data?.is_active ?? true);
      });
    supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }: any) => {
        setFullName(data?.full_name ?? "");
        setPhone(data?.phone ?? "");
      });
  }, [user]);

  const save = async () => {
    if (!user) return;
    setBusy(true);
    const [r1, r2] = await Promise.all([
      supabase.from("support_agents").upsert({
        user_id: user.id,
        display_name: name,
        is_active: active,
      }),
      supabase.from("profiles").upsert({
        id: user.id,
        full_name: fullName,
        phone,
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
    <div className="mx-auto max-w-xl space-y-5 px-4 pb-8 pt-4">
      <div>
        <h1 className="large-title">Profile</h1>
        <p className="mt-1 text-small text-muted-foreground">Your support agent details.</p>
      </div>

      <div className="flex items-center gap-3.5 rounded-xl border border-border/70 bg-card p-4">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-primary-soft text-subtitle font-semibold text-primary-ink">
          {(fullName || name || user?.email || "S").slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-subtitle font-semibold">
            {fullName || name || "Support Agent"}
          </div>
          <div className="flex items-center gap-1 truncate text-small text-muted-foreground">
            <Mail className="h-3.5 w-3.5" /> {user?.email}
          </div>
          <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-caption font-semibold capitalize text-primary-ink">
            <Shield className="h-3 w-3" /> Support
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="section-title">Details</h2>
        <div className="space-y-3.5 rounded-xl border border-border/70 bg-card p-4">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1 text-small font-medium text-muted-foreground">
              <UserIcon className="h-3.5 w-3.5" /> Full name
            </Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-small font-medium text-muted-foreground">
              Display name (shown on tickets)
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Eshan T."
            />
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1 text-small font-medium text-muted-foreground">
              <Phone className="h-3.5 w-3.5" /> Phone
            </Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91…" />
          </div>

          <label className="flex select-none items-center gap-2 pt-1 text-small">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Available for new ticket assignments
          </label>

          <Button onClick={save} disabled={busy} className="h-11 w-full rounded-xl">
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </section>

      <Button
        variant="secondary"
        onClick={handleSignOut}
        disabled={signingOut}
        className="h-11 w-full rounded-xl text-destructive"
      >
        <LogOut className="h-4 w-4" />
        {signingOut ? "Signing out…" : "Log out"}
      </Button>

      <DeleteAccountSection />
    </div>
  );
}
