import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/SearchableSelect";
import { useAuth } from "@/hooks/useAuth";
import { useLocations, deriveLocationOptions } from "@/hooks/useLocations";
import { signInWithGoogle } from "@/lib/googleAuth";
import { toast } from "sonner";
import { describeAuthError } from "@/lib/authErrors";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export const Route = createFileRoute("/signup")({
  validateSearch: (search: Record<string, unknown>): { next?: string } =>
    typeof search.next === "string" && search.next.startsWith("/")
      ? { next: search.next }
      : {},

  head: () => ({ meta: [{ title: "Create account — AP Mart" }] }),
  component: SignupPage,
});

function SignupPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { next } = Route.useSearch();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [state, setState] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [pincode, setPincode] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const locationsQ = useLocations();
  const { states, citiesByState, pincodesByCity } = useMemo(
    () => deriveLocationOptions(locationsQ.data ?? []),
    [locationsQ.data],
  );
  const cityOptions = state ? citiesByState.get(state) ?? [] : [];
  const pincodeOptions = state && city ? pincodesByCity.get(`${state}|${city}`) ?? [] : [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      toast.error("Enter a valid phone number");
      return;
    }
    if (!state) return toast.error("Please select your state");
    if (!city) return toast.error("Please select your city");
    if (!pincode) return toast.error("Please select your PIN code");

    setSubmitting(true);
    const { error } = await signUp(email, password, fullName, `+${digits}`, {
      state,
      city,
      pincode,
    });
    setSubmitting(false);
    if (error) {
      toast.error(describeAuthError(error));
      return;
    }
    toast.success("Account created. Check your email to verify, then sign in.");
    navigate({ to: "/login", search: { next } as never });
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    try {
      if (next) {
        sessionStorage.setItem("flashbasket.auth.next", next);
      }
      const result = await signInWithGoogle("/auth/callback");
      if (result.error) {
        setGoogleLoading(false);
        toast.error(result.error.message || "Google sign-in failed");
        return;
      }
      // App: the sign-in browser has closed (deep link handles success).
      if (!result.redirected) setGoogleLoading(false);
    } catch (err: any) {
      setGoogleLoading(false);
      toast.error(err?.message || "Google sign-in failed");
    }
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-background px-4 pb-10 pt-safe md:items-center">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-4 mt-6 flex justify-center"><Logo size="md" /></Link>
        <div className="text-center">
          <h1 className="large-title">Create your account</h1>
          <p className="mt-1 text-meta text-muted-foreground">Order from local shops near you.</p>
        </div>

        <div className="mt-6 rounded-xl border border-border/70 bg-card p-4 md:p-6">
          <Button
            type="button"
            variant="secondary"
            onClick={handleGoogle}
            disabled={submitting || googleLoading}
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

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/70" /></div>
            <div className="relative flex justify-center"><span className="bg-card px-3 text-small text-muted-foreground">or</span></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-meta font-medium">Full name</Label>
              <Input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-meta font-medium">Email</Label>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-meta font-medium">Phone number</Label>
              <Input
                type="tel"
                required
                inputMode="tel"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-meta font-medium">State</Label>
              <SearchableSelect
                value={state}
                onChange={(v) => {
                  setState(v);
                  setCity(null);
                  setPincode(null);
                }}
                options={states}
                placeholder={locationsQ.isLoading ? "Loading..." : "Select State"}
                emptyText="No states found"
                disabled={locationsQ.isLoading}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-meta font-medium">City</Label>
              <SearchableSelect
                value={city}
                onChange={(v) => {
                  setCity(v);
                  setPincode(null);
                }}
                options={cityOptions}
                placeholder={state ? "Select City" : "Select State first"}
                emptyText="No cities found"
                disabled={!state}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-meta font-medium">PIN code</Label>
              <SearchableSelect
                value={pincode}
                onChange={setPincode}
                options={pincodeOptions}
                placeholder={city ? "Select PIN Code" : "Select City first"}
                emptyText="No PIN codes found"
                disabled={!city}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-meta font-medium">Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" disabled={submitting} className="mt-2 h-11 w-full rounded-xl">
              {submitting ? "Creating account…" : "Create account"}
            </Button>
          </form>
        </div>

        <p className="mt-5 text-center text-meta text-muted-foreground">
          Already have an account? <Link to="/login" className="font-semibold text-primary">Log in</Link>
        </p>
      </div>
    </div>
  );
}
