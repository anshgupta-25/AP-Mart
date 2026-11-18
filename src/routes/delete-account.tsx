import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  Headphones,
  Info,
  Loader2,
  LogOut,
  Mail,
  ShieldAlert,
  UserX,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { SupportTicketForm } from "@/components/SupportTicketForm";
import { useAuth } from "@/hooks/useAuth";
import {
  checkAccountDeletion,
  deleteMyAccount,
  sendAccountDeletionCode,
  type DeletionBlocker,
} from "@/lib/account.functions";
import { errorMessage } from "@/lib/utils";

export const Route = createFileRoute("/delete-account")({
  head: () => ({
    meta: [
      { title: "Delete your account — AP Mart" },
      {
        name: "description",
        content:
          "How to delete your AP Mart account, what is deleted and what is kept as anonymised records.",
      },
    ],
  }),
  component: DeleteAccountPage,
});

const CODE_LENGTH = 8;
const RESEND_SECONDS = 45;
// Same contact as the privacy policy page.
const SUPPORT_EMAIL = "eshanthakur02@gmail.com";

/** Where to fix each blocker. */
const BLOCKER_LINK: Partial<Record<DeletionBlocker, { to: string; label: string }>> = {
  orders: { to: "/customer/orders", label: "View my orders" },
  shop_orders: { to: "/shopkeeper/orders", label: "View shop orders" },
  deliveries: { to: "/delivery/dashboard", label: "View my deliveries" },
};

/**
 * Account deletion. Signed in: what is deleted vs kept, blockers, and a confirmation that needs
 * a checkbox plus the password (or an emailed code for Google sign-ins). Signed out: the same
 * information plus how to delete, which is the public page the Play Store asks for.
 */
function DeleteAccountPage() {
  const { user, loading, roles } = useAuth();
  const [deletedEmail, setDeletedEmail] = useState<string | null>(null);

  if (deletedEmail !== null) return <DeletedScreen email={deletedEmail} />;
  return (
    <Page>
      {loading ? (
        <div className="grid place-items-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : user ? (
        <SignedInFlow
          email={user.email ?? ""}
          roles={roles}
          onDeleted={() => setDeletedEmail(user.email ?? "")}
        />
      ) : (
        <SignedOutInfo />
      )}
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-background pb-12 pt-safe">
      <div className="mx-auto w-full max-w-lg px-4">
        <div className="flex items-center justify-between py-4">
          <button
            type="button"
            onClick={() => router.history.back()}
            aria-label="Go back"
            className="press grid h-9 w-9 place-items-center rounded-full bg-card"
          >
            <ArrowLeft className="h-[18px] w-[18px]" />
          </button>
          <Link to="/">
            <Logo size="sm" />
          </Link>
          <span className="h-9 w-9" />
        </div>
        {children}
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
        <UserX className="h-6 w-6" strokeWidth={1.8} />
      </div>
      <h1 className="large-title mt-4">Delete your AP Mart account</h1>
      <p className="mx-auto mt-1 max-w-sm text-meta text-muted-foreground">
        This is permanent. Once deleted, your account and personal data can't be recovered.
      </p>
    </div>
  );
}

/** What is deleted and what is kept, tailored to the user's roles when known. */
function DataLists({ roles = [] }: { roles?: string[] }) {
  const deleted = [
    "Your profile: name, email, phone number and photo",
    "Saved addresses, cart and favourites",
    "Reviews you've written",
    "Notifications, notification settings and push devices",
    "Your support tickets and their attachments",
    "Partner applications you've sent",
    ...(roles.includes("shopkeeper")
      ? ["Your shop's products, prices, offers, categories and collections (the shop is closed)"]
      : []),
    ...(roles.includes("delivery") ? ["Your delivery partner details: name, phone, vehicle"] : []),
  ];
  const kept = [
    'Past orders and invoices, shown as "Deleted user" with only the city, state and PIN code. Tax and accounting rules require them.',
    "Payment records (amount, status and reference number), needed for refunds and accounting.",
    ...(roles.includes("shopkeeper") || roles.includes("delivery")
      ? ["Orders your shop handled or deliveries you made, without your name or phone number."]
      : []),
  ];
  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-border/70 bg-card p-4">
        <h2 className="section-title">What will be deleted</h2>
        <ul className="mt-3 space-y-2.5">
          {deleted.map((t) => (
            <li key={t} className="flex gap-2.5 text-meta">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive">
                <X className="h-3 w-3" strokeWidth={2.5} />
              </span>
              {t}
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-xl border border-border/70 bg-card p-4">
        <h2 className="section-title">What we keep, and why</h2>
        <ul className="mt-3 space-y-2.5">
          {kept.map((t) => (
            <li key={t} className="flex gap-2.5 text-meta">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
                <Info className="h-3 w-3" strokeWidth={2.5} />
              </span>
              {t}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-small text-muted-foreground">
          These records can't be linked back to you once your account is deleted.
        </p>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ signed out (public page) */

function SignedOutInfo() {
  return (
    <div className="space-y-4">
      <Header />
      <section className="rounded-xl border border-border/70 bg-card p-4">
        <h2 className="section-title">How to delete your account</h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-meta">
          <li>Log in to the AP Mart app or website.</li>
          <li>
            Open <b>Profile</b> (or <b>Settings</b>) and tap <b>Delete account</b>.
          </li>
          <li>Confirm with your password, or with a code we email you.</li>
        </ol>
        <Button asChild className="mt-4 h-11 w-full rounded-xl">
          <Link to="/login" search={{ next: "/delete-account" }}>
            Log in to continue
          </Link>
        </Button>
        <p className="mt-3 text-small text-muted-foreground">
          Can't log in? Email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-foreground underline">
            {SUPPORT_EMAIL}
          </a>{" "}
          from the address on your account and we'll delete it for you.
        </p>
      </section>
      <DataLists />
    </div>
  );
}

/* ------------------------------------------------------------------ signed in */

function SignedInFlow({
  email,
  roles,
  onDeleted,
}: {
  email: string;
  roles: string[];
  onDeleted: () => void;
}) {
  const qc = useQueryClient();
  const { signOut } = useAuth();
  const router = useRouter();
  const check = useServerFn(checkAccountDeletion);
  const sendCode = useServerFn(sendAccountDeletionCode);
  const remove = useServerFn(deleteMyAccount);

  const verdict = useQuery({
    queryKey: ["account-deletion-check", email],
    queryFn: () => check({ data: undefined as never }),
  });
  const blocked = verdict.data && !verdict.data.allowed ? verdict.data : null;
  const hasPassword = verdict.data?.has_password !== false;

  const [method, setMethod] = useState<"password" | "code" | null>(null);
  const activeMethod = method ?? (hasPassword ? "password" : "code");
  const [understood, setUnderstood] = useState(false);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supportOpen, setSupportOpen] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const requestCode = async () => {
    setSending(true);
    setError(null);
    try {
      const { sentTo } = await sendCode({ data: undefined as never });
      setCodeSentTo(sentTo);
      setCode("");
      setCooldown(RESEND_SECONDS);
      toast.success("Code sent. Check your email.");
    } catch (e) {
      setError(errorMessage(e, "Couldn't send the code. Please try again."));
    } finally {
      setSending(false);
    }
  };

  const credentialReady =
    activeMethod === "password" ? password.length > 0 : code.length === CODE_LENGTH;
  const canDelete = !!verdict.data?.allowed && understood && credentialReady && !busy;

  const onDelete = async () => {
    if (!canDelete) return;
    setBusy(true);
    setError(null);
    try {
      await remove({ data: activeMethod === "password" ? { password } : { code } });
    } catch (e) {
      setError(errorMessage(e, "Couldn't delete your account. Please try again."));
      setBusy(false);
      void verdict.refetch();
      return;
    }
    // Deleted: show the confirmation, then drop everything stored on this device.
    onDeleted();
    qc.clear();
    try {
      await signOut();
    } catch {
      // The login no longer exists; the local session is cleared either way.
    }
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // Storage may be unavailable (private mode).
    }
  };

  return (
    <div className="space-y-4">
      <Header />

      {verdict.isLoading ? (
        <div className="grid place-items-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : verdict.isError ? (
        <div className="rounded-xl border border-border/70 bg-card p-4 text-center text-meta">
          Couldn't check your account.{" "}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => verdict.refetch()}
          >
            Try again
          </button>
        </div>
      ) : blocked ? (
        <div className="rounded-xl border border-warning/40 bg-tint-sun p-4">
          <div className="flex gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" />
            <div className="min-w-0">
              <div className="text-body font-semibold">You can't delete your account yet</div>
              <p className="mt-0.5 text-meta text-muted-foreground">{blocked.reason}</p>
              {blocked.blocker && BLOCKER_LINK[blocked.blocker] && (
                <Link
                  to={BLOCKER_LINK[blocked.blocker]!.to}
                  className="mt-2 inline-flex items-center gap-1 text-meta font-semibold text-primary"
                >
                  {BLOCKER_LINK[blocked.blocker]!.label} <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <DataLists roles={roles} />

      <section className="overflow-hidden rounded-xl border border-border/70 bg-card">
        <h2 className="section-title px-4 pb-1 pt-4">Before you go</h2>
        <button
          type="button"
          onClick={() => setSupportOpen(true)}
          className="press flex min-h-12 w-full items-center gap-3 border-b border-border/60 px-4 py-2.5 text-left"
        >
          <Headphones className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 text-body font-medium">Having a problem? Contact support</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
        <button
          type="button"
          onClick={async () => {
            await signOut();
            router.navigate({ to: "/login", replace: true });
          }}
          className="press flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left"
        >
          <LogOut className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 text-body font-medium">Just sign out instead</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </section>
      <SupportTicketForm open={supportOpen} onOpenChange={setSupportOpen} />

      <section className="space-y-4 rounded-xl border border-destructive/30 bg-card p-4">
        <h2 className="section-title flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-destructive" /> Confirm deletion
        </h2>

        {activeMethod === "password" ? (
          <div className="space-y-1.5">
            <Label htmlFor="del-password" className="text-meta font-medium">
              Enter your password
            </Label>
            <Input
              id="del-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
            <button
              type="button"
              onClick={() => {
                setMethod("code");
                setError(null);
              }}
              className="text-small font-medium text-muted-foreground underline-offset-2 hover:underline"
            >
              Signed in with Google or forgot your password? Email me a code instead
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {codeSentTo ? (
              <>
                <p className="text-meta text-muted-foreground">
                  Enter the {CODE_LENGTH}-digit code we sent to{" "}
                  <span className="font-semibold text-foreground">{codeSentTo}</span>.
                </p>
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={CODE_LENGTH}
                    value={code}
                    onChange={(v) => setCode(v.replace(/\D/g, ""))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    disabled={busy}
                  >
                    <InputOTPGroup>
                      {Array.from({ length: CODE_LENGTH }).map((_, i) => (
                        <InputOTPSlot key={i} index={i} className="h-11 w-9 text-base sm:w-10" />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <button
                  type="button"
                  onClick={requestCode}
                  disabled={sending || cooldown > 0}
                  className="text-small font-medium text-muted-foreground underline-offset-2 hover:underline disabled:no-underline disabled:opacity-60"
                >
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
                </button>
              </>
            ) : (
              <>
                <p className="text-meta text-muted-foreground">
                  We'll email a {CODE_LENGTH}-digit code to{" "}
                  <span className="font-semibold text-foreground">{email}</span> to confirm it's
                  you.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={requestCode}
                  disabled={sending}
                  className="h-11 w-full rounded-xl"
                >
                  {sending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="mr-2 h-4 w-4" />
                  )}
                  Email me a code
                </Button>
              </>
            )}
            {hasPassword && (
              <button
                type="button"
                onClick={() => {
                  setMethod("password");
                  setError(null);
                }}
                className="block text-small font-medium text-muted-foreground underline-offset-2 hover:underline"
              >
                Use my password instead
              </button>
            )}
          </div>
        )}

        <label className="flex items-start gap-2.5 text-meta">
          <Checkbox
            checked={understood}
            onCheckedChange={(v) => setUnderstood(v === true)}
            disabled={busy}
            className="mt-0.5"
          />
          <span>I understand that deleting my account is permanent and can't be undone.</span>
        </label>

        {error && (
          <div
            role="alert"
            className="rounded-lg bg-destructive/10 p-3 text-meta font-medium text-destructive"
          >
            {error}
          </div>
        )}

        <Button
          variant="destructive"
          disabled={!canDelete}
          onClick={onDelete}
          className="h-11 w-full rounded-xl"
        >
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {busy ? "Deleting your account…" : "Delete my account"}
        </Button>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ done */

function DeletedScreen({ email }: { email: string }) {
  return (
    <Page>
      <div className="pt-6 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary-soft text-primary-ink">
          <UserX className="h-6 w-6" strokeWidth={1.8} />
        </div>
        <h1 className="large-title mt-4">Your account has been deleted</h1>
        <p className="mx-auto mt-1 max-w-sm text-meta text-muted-foreground">
          Your AP Mart account and personal data are gone.
          {email && (
            <>
              {" "}
              We've sent a confirmation to <span className="font-semibold">{email}</span>.
            </>
          )}
        </p>
        <div className="mt-6 space-y-2">
          <Button asChild className="h-11 w-full rounded-xl">
            <Link to="/signup">Create a new account</Link>
          </Button>
          <Button asChild variant="secondary" className="h-11 w-full rounded-xl">
            <Link to="/">Go to the home page</Link>
          </Button>
        </div>
      </div>
    </Page>
  );
}
