import { createFileRoute, useNavigate, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { homeForRoles, useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { describeAuthError } from "@/lib/authErrors";
import { Phone as PhoneIcon, ArrowLeft, Loader2 } from "lucide-react";
import { z } from "zod";
import { signInWithGoogle } from "@/lib/googleAuth";
import {
  getIndianPhoneDiagnostic,
  getPhoneAuthError,
  normalizeIndianPhone,
  withRequestTimeout,
} from "@/lib/phone";

async function redirectByRole(navigate: ReturnType<typeof useNavigate>, userId: string) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) {
    toast.error(`Could not load your account role: ${error.message}`);
    return;
  }
  const roles = (data ?? []).map((r) => r.role as string);
  await navigate({ to: homeForRoles(roles), replace: true });
}

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — AP Mart" }, { name: "description", content: "Sign in or create your AP Mart account with mobile OTP." }] }),
  component: AuthShell,
});

function AuthShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/auth" && pathname !== "/auth/") {
    return <Outlet />;
  }
  return <AuthPage />;
}

function AuthPage() {
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [li, setLi] = useState({ email: "", password: "" });
  const [su, setSu] = useState({ name: "", email: "", password: "" });
  const phoneFlowRef = useRef(false);

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      const result = await signInWithGoogle("/auth/callback");
      if (result.error) {
        setGoogleLoading(false);
        toast.error(result.error.message || "Google sign-in failed");
      } else if (!result.redirected) {
        // App: the sign-in browser has closed (deep link handles success).
        setGoogleLoading(false);
      }
    } catch (err: any) {
      setGoogleLoading(false);
      toast.error(err?.message || "Google sign-in failed");
    }
  };

  useEffect(() => {
    if (user && !phoneFlowRef.current) void redirectByRole(navigate, user.id);
  }, [user, navigate]);

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(li.email, li.password);
    setLoading(false);
    if (error) toast.error(describeAuthError(error));
    else {
      toast.success("Welcome back!");
      const { data } = await supabase.auth.getUser();
      if (data.user) await redirectByRole(navigate, data.user.id);
    }
  };

  const onSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signUp(su.email, su.password, su.name);
    setLoading(false);
    if (error) toast.error(describeAuthError(error));
    else toast.success("Account created! Check your email to confirm.");
  };

  return (
    <div className="grid min-h-[80vh] lg:grid-cols-2">
      <div className="relative hidden items-center justify-center bg-tint-mint p-12 lg:flex">
        <div className="relative z-10 max-w-md">
          <Logo size="lg" />
          <h1 className="mt-6 text-page font-bold leading-tight tracking-tight">
            Groceries from the shops in your neighbourhood.
          </h1>
          <p className="mt-3 text-body text-foreground/65">
            Join AP Mart to order from trusted local stores and get it delivered home.
          </p>
        </div>
      </div>

      <div className="flex items-start justify-center px-4 pb-10 pt-8 md:items-center md:p-12">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-4 flex justify-center lg:hidden"><Logo size="md" /></Link>
          <div className="text-center">
            <h2 className="large-title">Welcome to AP Mart</h2>
            <p className="mt-1 text-meta text-muted-foreground">Sign in or create an account</p>
          </div>
          <div className="mt-6 rounded-xl border border-border/70 bg-card p-4 md:p-6">
            <Tabs defaultValue="phone">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="phone">Phone OTP</TabsTrigger>
                <TabsTrigger value="login">Email</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>

              <TabsContent value="phone" className="mt-4">
                <PhoneOtpForm
                  onOtpSent={() => {
                    phoneFlowRef.current = true;
                  }}
                  onAuthed={(uid) => {
                    phoneFlowRef.current = false;
                    void redirectByRole(navigate, uid);
                  }}
                />
              </TabsContent>

              <TabsContent value="login" className="mt-4">
                <form onSubmit={onLogin} className="space-y-4">
                  <Field id="li-email" label="Email" type="email" value={li.email} onChange={(v) => setLi({ ...li, email: v })} />
                  <Field id="li-password" label="Password" type="password" value={li.password} onChange={(v) => setLi({ ...li, password: v })} />
                  <Button type="submit" disabled={loading} className="h-11 w-full rounded-xl">
                    {loading ? "Signing in…" : "Sign in"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-4">
                <form onSubmit={onSignup} className="space-y-4">
                  <Field id="su-name" label="Full name" value={su.name} onChange={(v) => setSu({ ...su, name: v })} />
                  <Field id="su-email" label="Email" type="email" value={su.email} onChange={(v) => setSu({ ...su, email: v })} />
                  <Field id="su-password" label="Password (min 6)" type="password" value={su.password} onChange={(v) => setSu({ ...su, password: v })} />
                  <Button type="submit" disabled={loading} className="h-11 w-full rounded-xl">
                    {loading ? "Creating…" : "Create account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/70" /></div>
              <div className="relative flex justify-center"><span className="bg-card px-3 text-small text-muted-foreground">or</span></div>
            </div>

            <Button
              type="button"
              variant="secondary"
              onClick={handleGoogle}
              disabled={loading || googleLoading}
              className="h-11 w-full gap-2 rounded-xl"
            >
              {googleLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  Connecting to Google…
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
                    <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.4 14.6 2.4 12 2.4 6.7 2.4 2.5 6.6 2.5 12s4.2 9.6 9.5 9.6c5.5 0 9.1-3.8 9.1-9.3 0-.6-.1-1.1-.2-1.6H12z" />
                  </svg>
                  Continue with Google
                </>
              )}
            </Button>
          </div>
          <p className="mt-5 text-center text-small text-muted-foreground">
            By continuing you agree to AP Mart's terms of service.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ id, label, type = "text", value, onChange, required = true }: { id: string; label: string; type?: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} required={required} value={value} onChange={(e) => onChange(e.target.value)} className="h-11 rounded-xl" />
    </div>
  );
}

// ----- Phone OTP -----

const requestSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(80),
  countryCode: z.string().regex(/^\+91$/, "Use the Indian country code +91"),
  phone: z
    .string()
    .refine(
      (phone) => normalizeIndianPhone(phone) !== null,
      "Enter a valid 10-digit Indian mobile number",
    ),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
});

type Step = "request" | "verify" | "complete";

function PhoneOtpForm({
  onOtpSent,
  onAuthed,
}: {
  onOtpSent: () => void;
  onAuthed: (userId: string) => void;
}) {
  const [step, setStep] = useState<Step>("request");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [form, setForm] = useState({ fullName: "", countryCode: "+91", phone: "", email: "" });
  const [otp, setOtp] = useState("");
  const [requestedPhone, setRequestedPhone] = useState("");
  const [profile, setProfile] = useState({ fullName: "", email: "", address: "" });
  const timerRef = useRef<number | null>(null);
  const busyRef = useRef(false);

  const beginRequest = () => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setErrorMessage("");
    return true;
  };

  const finishRequest = () => {
    busyRef.current = false;
    setBusy(false);
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    toast.error(message);
  };

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    timerRef.current = t;
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [resendIn]);

  const sendOtp = async (resend = false) => {
    setErrorMessage("");
    const parsed = requestSchema.safeParse(form);
    if (!parsed.success) {
      showError(parsed.error.issues[0].message);
      return;
    }
    if (!beginRequest()) return;
    const normalizedPhone = normalizeIndianPhone(`${form.countryCode}${form.phone}`);
    if (!normalizedPhone) {
      showError("Enter a valid 10-digit Indian mobile number");
      finishRequest();
      return;
    }
    console.info("[Phone OTP] normalized send number", getIndianPhoneDiagnostic(normalizedPhone));
    setOtp("");
    try {
      const { error } = await withRequestTimeout(
        supabase.auth.signInWithOtp({
          phone: normalizedPhone,
          options: {
            shouldCreateUser: true,
            data: {
              full_name: form.fullName.trim(),
              phone: normalizedPhone,
              ...(form.email ? { email: form.email.trim() } : {}),
            },
          },
        }),
        "send the OTP",
      );
      if (error) {
        showError(getPhoneAuthError(error, "send the OTP"));
        return;
      }
      onOtpSent();
      setRequestedPhone(normalizedPhone);
      toast.success(resend ? "New OTP request accepted" : "OTP request accepted");
      setStep("verify");
      setResendIn(30);
    } catch (error) {
      showError(getPhoneAuthError(error, "send the OTP"));
    } finally {
      finishRequest();
    }
  };

  const verify = async () => {
    if (!/^\d{6}$/.test(otp)) {
      showError("Enter the six-digit OTP");
      return;
    }
    if (!requestedPhone) {
      showError("Request a new OTP before verifying.");
      return;
    }
    if (!beginRequest()) return;
    let verified = false;
    try {
      console.info(
        "[Phone OTP] normalized verification number",
        getIndianPhoneDiagnostic(requestedPhone),
      );
      const { data, error } = await withRequestTimeout(
        supabase.auth.verifyOtp({ phone: requestedPhone, token: otp, type: "sms" }),
        "verify the OTP",
      );
      if (error || !data.user) {
        showError(
          error
            ? getPhoneAuthError(error, "verify the OTP")
            : "The OTP could not be verified. Request a new code and try again.",
        );
        return;
      }

      verified = true;
      setStep("complete");
      const updates: Database["public"]["Tables"]["profiles"]["Update"] = {};
      if (form.fullName) updates.full_name = form.fullName.trim();
      if (form.email) updates.email = form.email.trim();
      if (Object.keys(updates).length) {
        const { error: updateError } = await withRequestTimeout(
          supabase.from("profiles").update(updates).eq("id", data.user.id),
          "save your profile",
        );
        if (updateError) throw updateError;
      }

      const { data: prof, error: profileError } = await withRequestTimeout(
        supabase
          .from("profiles")
          .select("full_name, email, address")
          .eq("id", data.user.id)
          .maybeSingle(),
        "load your profile",
      );
      if (profileError) throw profileError;
      if (!prof?.full_name) {
        setProfile({
          fullName: prof?.full_name ?? form.fullName,
          email: prof?.email ?? form.email,
          address: prof?.address ?? "",
        });
        return;
      }
      toast.success("Signed in");
      onAuthed(data.user.id);
    } catch (error) {
      showError(getPhoneAuthError(error, "verify the OTP"));
      if (verified) {
        setProfile((current) => ({
          fullName: current.fullName || form.fullName,
          email: current.email || form.email,
          address: current.address,
        }));
      }
    } finally {
      finishRequest();
    }
  };

  const completeProfile = async () => {
    const name = profile.fullName.trim();
    if (name.length < 2) {
      showError("Enter your full name");
      return;
    }
    if (!beginRequest()) return;
    try {
      const { data: u, error: userError } = await withRequestTimeout(
        supabase.auth.getUser(),
        "load your signed-in account",
      );
      if (userError) throw userError;
      if (!u.user) throw new Error("Your session expired. Sign in again to continue.");
      const updates: Database["public"]["Tables"]["profiles"]["Update"] = {
        full_name: name,
        email: profile.email.trim() || null,
        address: profile.address.trim() || null,
      };
      const { error } = await withRequestTimeout(
        supabase.from("profiles").update(updates).eq("id", u.user.id),
        "save your profile",
      );
      if (error) throw error;
      toast.success("Profile saved");
      onAuthed(u.user.id);
    } catch (error) {
      showError(getPhoneAuthError(error, "save your profile"));
    } finally {
      finishRequest();
    }
  };

  const errorNotice = errorMessage ? (
    <p role="alert" className="text-sm text-destructive">
      {errorMessage}
    </p>
  ) : null;

  if (step === "verify") {
    return (
      <div className="space-y-4">
        <button
          type="button"
          className="text-xs text-muted-foreground inline-flex items-center gap-1"
          onClick={() => {
            setErrorMessage("");
            setOtp("");
            setRequestedPhone("");
            setStep("request");
          }}
        >
          <ArrowLeft className="h-3 w-3" /> Change number
        </button>
        <div className="text-sm">
          We requested a code for <span className="font-bold">{requestedPhone}</span>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="otp">OTP code</Label>
          <Input
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={otp}
            onChange={(e) => {
              setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
              setErrorMessage("");
            }}
            className="h-11 rounded-xl text-center text-lg font-semibold tracking-[0.5em]"
            placeholder="••••••"
          />
          <p className="text-caption text-muted-foreground">Code expires in 5 minutes.</p>
        </div>
        {errorNotice}
        <Button
          onClick={verify}
          disabled={busy}
          className="w-full rounded-xl bg-primary text-primary-foreground font-bold h-11"
        >
          {busy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying…
            </>
          ) : (
            "Verify OTP"
          )}
        </Button>
        <Button
          variant="ghost"
          disabled={busy || resendIn > 0}
          onClick={() => sendOtp(true)}
          className="w-full h-9 text-sm"
        >
          {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
        </Button>
      </div>
    );
  }

  if (step === "complete") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Complete your profile to continue.</p>
        {errorNotice}
        <Field
          id="cp-name"
          label="Full name"
          value={profile.fullName}
          onChange={(v) => setProfile({ ...profile, fullName: v })}
        />
        <Field
          id="cp-email"
          label="Email (optional)"
          type="email"
          required={false}
          value={profile.email}
          onChange={(v) => setProfile({ ...profile, email: v })}
        />
        <Field
          id="cp-addr"
          label="Address (optional)"
          required={false}
          value={profile.address}
          onChange={(v) => setProfile({ ...profile, address: v })}
        />
        <Button
          onClick={completeProfile}
          disabled={busy}
          className="w-full rounded-xl bg-primary text-primary-foreground font-bold h-11"
        >
          {busy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save & continue"
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Field
        id="po-name"
        label="Full name"
        value={form.fullName}
        onChange={(v) => setForm({ ...form, fullName: v })}
      />
      <div className="space-y-1.5">
        <Label htmlFor="po-phone">Mobile number</Label>
        <div className="flex gap-2">
          <Input
            id="po-cc"
            value={form.countryCode}
            disabled={busy}
            onChange={(e) => {
              setForm({ ...form, countryCode: e.target.value });
              setOtp("");
              setRequestedPhone("");
              setErrorMessage("");
            }}
            className="h-11 rounded-xl w-20"
            placeholder="+91"
            aria-label="Country code"
          />
          <Input
            id="po-phone"
            inputMode="tel"
            required
            value={form.phone}
            onChange={(e) => {
              setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) });
              setOtp("");
              setRequestedPhone("");
              setErrorMessage("");
            }}
            disabled={busy}
            className="h-11 rounded-xl flex-1"
            placeholder="9876543210"
          />
        </div>
      </div>
      <Field
        id="po-email"
        label="Email (optional)"
        type="email"
        required={false}
        value={form.email}
        onChange={(v) => setForm({ ...form, email: v })}
      />
      {errorNotice}
      <Button
        onClick={() => sendOtp(false)}
        disabled={busy}
        className="w-full rounded-xl bg-primary text-primary-foreground font-bold h-11"
      >
        {busy ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending…
          </>
        ) : (
          <>
            <PhoneIcon className="h-4 w-4 mr-2" />
            Send OTP
          </>
        )}
      </Button>
      <p className="text-caption text-muted-foreground">
        New users are created as customers. Only an admin can grant other roles.
      </p>
    </div>
  );
}
