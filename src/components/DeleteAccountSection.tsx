import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { checkAccountDeletion, deleteMyAccount } from "@/lib/account.functions";
import { errorMessage } from "@/lib/utils";

/**
 * Self-service account deletion — available to every role.
 * The backend re-verifies identity, role and active orders/deliveries;
 * this UI only collects the double confirmation.
 */
export function DeleteAccountSection({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);

  const navigate = useNavigate();
  const qc = useQueryClient();
  const { signOut } = useAuth();
  const check = useServerFn(checkAccountDeletion);
  const remove = useServerFn(deleteMyAccount);

  const openDialog = async () => {
    setConfirm("");
    setBlocked(null);
    setOpen(true);
    try {
      const verdict = await check({ data: undefined as never });
      if (!verdict.allowed)
        setBlocked(verdict.reason ?? "Your account cannot be deleted right now.");
    } catch {
      // Non-fatal: the delete attempt itself re-validates server-side.
    }
  };

  const onDelete = async () => {
    setBusy(true);
    try {
      await remove({ data: undefined as never });
      qc.clear();
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        // Best effort: storage may be unavailable or the step is optional.
      }
      await signOut();
      toast.success("Your account has been permanently deleted.");
      navigate({ to: "/login", replace: true });
    } catch (e) {
      setBlocked(errorMessage(e, "Could not delete your account. Please try again."));
      toast.error(errorMessage(e, "Could not delete your account."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`rounded-xl border border-border/70 bg-card p-4 ${className}`}>
      <h2 className="section-title flex items-center gap-2 text-destructive">
        <AlertTriangle className="h-4 w-4" /> Danger zone
      </h2>
      <p className="mt-1 text-small text-muted-foreground">
        Permanently delete your AP Mart account and personal data. This cannot be undone.
      </p>
      <Button
        variant="secondary"
        className="mt-3 h-10 w-full rounded-xl text-destructive"
        onClick={openDialog}
      >
        <Trash2 className="h-4 w-4 mr-2" /> Delete account
      </Button>

      <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This action is permanent. Your account and associated personal data will be deleted
              and cannot be recovered.
            </DialogDescription>
          </DialogHeader>

          {blocked ? (
            <div className="rounded-lg bg-destructive/10 p-3 text-meta font-medium text-destructive">
              {blocked}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="confirm-delete" className="text-xs">
                Type <span className="font-bold">DELETE</span> to confirm
              </Label>
              <Input
                id="confirm-delete"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="DELETE"
                autoComplete="off"
              />
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy || !!blocked || confirm.trim() !== "DELETE"}
              onClick={onDelete}
            >
              {busy ? "Deleting…" : "Delete Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
