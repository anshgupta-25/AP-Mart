import { useState } from "react";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { isSamePasswordError } from "@/lib/authEmail";

/**
 * New password + confirm (min 8 chars). Calls onSaved after supabase.auth.updateUser succeeds.
 * `beforeSave` runs first (e.g. redeem a one-time email token); return an error message to stop.
 */
export function NewPasswordForm({
  submitLabel,
  onSaved,
  beforeSave,
}: {
  submitLabel: string;
  onSaved: () => void;
  beforeSave?: () => Promise<string | null>;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirm) return toast.error("Passwords do not match");
    setBusy(true);
    const blocked = beforeSave ? await beforeSave() : null;
    if (blocked) {
      setBusy(false);
      return toast.error(blocked);
    }
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    // Same as the current password is fine (e.g. re-confirming the one chosen at sign-up).
    if (error && !isSamePasswordError(error)) {
      console.error("[NewPassword] updateUser failed:", error.message);
      return toast.error(error.message || "Could not save your password");
    }
    onSaved();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="np-new" className="text-meta font-medium">
            New password
          </Label>
          <span className="text-small text-muted-foreground">at least 8 characters</span>
        </div>
        <div className="relative">
          <Input
            id="np-new"
            type={show ? "text" : "password"}
            required
            minLength={8}
            autoFocus
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 pr-11"
          />
          <button
            type="button"
            aria-label={show ? "Hide password" : "Show password"}
            onClick={() => setShow((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="np-confirm" className="text-meta font-medium">
          Confirm new password
        </Label>
        <Input
          id="np-confirm"
          type={show ? "text" : "password"}
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="h-11"
        />
      </div>
      <Button type="submit" disabled={busy} className="h-11 w-full gap-2 rounded-xl">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
        {submitLabel}
      </Button>
    </form>
  );
}
