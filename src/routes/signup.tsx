import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/SearchableSelect";
import { useAuth } from "@/hooks/useAuth";
import { useLocations, deriveLocationOptions } from "@/hooks/useLocations";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
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


  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md">
        <Link to="/" className="flex justify-center mb-6"><Logo /></Link>
        <div className="rounded-3xl border border-border bg-card p-6 md:p-8 shadow-card">
          <h1 className="font-display text-3xl font-extrabold">Join AP Mart</h1>
          <p className="text-sm text-muted-foreground mt-1">Create your account to start ordering.</p>

          <div className="mt-5">
            <GoogleSignInButton next={next} />
          </div>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-wider"><span className="bg-card px-2 text-muted-foreground">or</span></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label>Full name</Label>
              <Input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-11 rounded-xl mt-1" />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-xl mt-1" />
            </div>
            <div>
              <Label>Phone number</Label>
              <Input
                type="tel"
                required
                inputMode="tel"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-11 rounded-xl mt-1"
              />
            </div>
            <div>
              <Label>State</Label>
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
            <div>
              <Label>City</Label>
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
            <div>
              <Label>PIN Code</Label>
              <SearchableSelect
                value={pincode}
                onChange={setPincode}
                options={pincodeOptions}
                placeholder={city ? "Select PIN Code" : "Select City first"}
                emptyText="No PIN codes found"
                disabled={!city}
              />
            </div>
            <div>
              <Label>Password</Label>
              <div className="relative mt-1">
                <Input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 rounded-xl pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" disabled={submitting} className="w-full h-11 rounded-xl gradient-primary text-primary-foreground font-bold">
              {submitting ? "Creating account…" : "Create account"}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground mt-5 text-center">
            Already have an account? <Link to="/login" className="text-primary font-semibold">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
