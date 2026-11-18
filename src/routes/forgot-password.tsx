import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { KeyRound, Loader2, Mail, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/lib/authEmail";

export const Route = createFileRoute("/forgot-password")({
  validateSearch: z.object({ email: z.string().optional(), staff: z.coerce.boolean().optional() }),
  head: () => ({ meta: [{ title: "Forgot password — AP Mart" }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { email: initialEmail, staff } = Route.useSearch();
  const [email, setEmail] = useState(initialEmail ?? "");
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const loginTo = staff ? "/staff-login" : "/login";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    const { error } = await requestPasswordReset(email);
    setSending(false);
    if (error) return toast.error(error);
    setSentTo(email.trim());
  };

  return (
    <div className="flex min-h-screen items-start justify-center bg-background px-4 pb-10 pt-safe md:items-center">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 mt-6 flex justify-center">
          <Logo size="md" />
        </Link>

        {sentTo ? (
          <>
            <h1 className="large-title text-center">Check your inbox</h1>
            <p className="mt-1 text-center text-meta text-muted-foreground">
              If an account exists for{" "}
              <span className="font-semibold text-foreground">{sentTo}</span>, a reset link is on
              its way.
            </p>
            <div className="mt-6 rounded-xl border border-border/70 bg-card p-5">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
                <MailCheck className="h-5 w-5" />
              </div>
              <p className="mt-4 text-meta text-muted-foreground">
                Open the link in that email and you'll land straight on a page where you can set a
                new password. The link is valid for one hour. Nothing arrived? Check spam, or{" "}
                <button
                  type="button"
                  onClick={() => setSentTo(null)}
                  className="font-semibold text-foreground underline-offset-2 hover:underline"
                >
                  try another address
                </button>
                .
              </p>
            </div>
          </>
        ) : (
          <>
            <h1 className="large-title text-center">Forgot your password?</h1>
            <p className="mt-1 text-center text-meta text-muted-foreground">
              Enter the email you signed up with and we'll send a link to set a new one.
            </p>
            <form
              onSubmit={submit}
              className="mt-6 space-y-4 rounded-xl border border-border/70 bg-card p-5"
            >
              <div className="space-y-1.5">
                <Label htmlFor="fp-email" className="text-meta font-medium">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="fp-email"
                    type="email"
                    required
                    autoFocus
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 pl-9"
                  />
                </div>
              </div>
              <Button type="submit" disabled={sending} className="h-11 w-full gap-2 rounded-xl">
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="h-4 w-4" />
                )}
                Send reset link
              </Button>
            </form>
          </>
        )}

        <p className="mt-6 text-center text-meta text-muted-foreground">
          Remembered it?{" "}
          <Link to={loginTo} className="font-semibold text-foreground">
            Back to log in
          </Link>
        </p>
      </div>
    </div>
  );
}
