import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { runOptimistic, patchObject, removeRow } from "@/lib/optimistic";

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MapPin, Trash2 } from "lucide-react";
import { AuthRequired } from "@/components/AuthRequired";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "My account — AP Mart" }] }),
  component: AccountPage,
});

function AccountPage() {
  const { user } = useAuth();
  const qc = useQueryClient();


  const profile = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () =>
      user ? (await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()).data : null,
    enabled: !!user,
  });

  const addresses = useQuery({
    queryKey: ["addresses", user?.id],
    queryFn: async () =>
      user ? (await supabase.from("addresses").select("*").eq("user_id", user.id)).data ?? [] : [],
    enabled: !!user,
  });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  if (!user) {
    return (
      <AuthRequired
        next="/account"
        title="Your Account"
        description="Sign in to manage your profile, saved addresses and preferences."
        icon={<MapPin className="h-12 w-12 text-primary" strokeWidth={1.75} />}
      />
    );
  }

  if (profile.data && !name) {
    setName(profile.data.full_name ?? "");
    setPhone(profile.data.phone ?? "");
  }

  const saveProfile = async () => {
    await runOptimistic({
      qc,
      keys: [["profile", user.id]],
      updater: patchObject({ full_name: name, phone }),
      request: () => supabase.from("profiles").update({ full_name: name, phone }).eq("id", user.id),
      success: "Profile updated",
    });
  };

  const deleteAddress = async (id: string) => {
    if (!confirm("Delete this address?")) return;
    await runOptimistic({
      qc,
      keys: [["addresses", user.id]],
      updater: removeRow(id),
      request: () => supabase.from("addresses").delete().eq("id", id),
      success: "Deleted",
    });
  };


  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
      <h1 className="font-display text-3xl font-extrabold">My account</h1>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-card">
        <h2 className="font-display text-xl font-bold mb-3">Profile</h2>
        <div className="space-y-3 max-w-md">
          <div>
            <Label>Email</Label>
            <Input value={user.email ?? ""} disabled className="rounded-xl mt-1" />
          </div>
          <div>
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl mt-1" />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded-xl mt-1" />
          </div>
          <Button onClick={saveProfile} className="rounded-xl gradient-primary text-primary-foreground">Save changes</Button>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-card">
        <h2 className="font-display text-xl font-bold mb-3 flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" /> Saved addresses</h2>
        {(addresses.data?.length ?? 0) === 0 ? (
          <div className="text-sm text-muted-foreground">No saved addresses. Add one during checkout.</div>
        ) : (
          <div className="space-y-2">
            {addresses.data?.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-3 rounded-2xl border border-border p-3">
                <div>
                  <div className="font-semibold">{a.name} <span className="ml-2 text-xs rounded-full bg-secondary px-2 py-0.5">{a.type}</span></div>
                  <div className="text-sm text-muted-foreground">
                    {a.line1}, {a.city}, {a.state} - {a.pincode}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => deleteAddress(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
