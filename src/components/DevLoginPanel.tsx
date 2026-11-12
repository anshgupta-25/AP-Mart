import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { describeAuthError } from "@/lib/authErrors";

// Development-only accounts created by scripts/seed-test-accounts.mjs.
const TEST_PASSWORD = "FlashTest@2026!";
const ACCOUNTS = [
  { label: "Customer", email: "customer.test@example.com" },
  { label: "Delivery Partner", email: "delivery.test@example.com" },
  { label: "Support", email: "support.test@example.com" },
  { label: "Shopkeeper", email: "shopkeeper.test@example.com" },
  { label: "Admin", email: "admin.test@example.com" },
  { label: "Super Admin", email: "superadmin.test@example.com" },
];

/** Rendered only when `import.meta.env.DEV` (see login.tsx); stripped from production builds. */
export function DevLoginPanel() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);

  async function login(email: string) {
    setBusy(email);
    const { error } = await signIn(email, TEST_PASSWORD, true);
    setBusy(null);
    if (error) return toast.error(describeAuthError(error as any));
    navigate({ to: "/dashboard", replace: true }); // /dashboard redirects by the account's role
  }

  return (
    <div className="mt-6 rounded-2xl border border-dashed border-amber-400 bg-amber-50 p-3">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-amber-700">Development only — test logins</p>
      <div className="grid grid-cols-2 gap-2">
        {ACCOUNTS.map((a) => (
          <Button key={a.email} type="button" variant="outline" size="sm" disabled={!!busy} onClick={() => login(a.email)}>
            {busy === a.email && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            Login as {a.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
