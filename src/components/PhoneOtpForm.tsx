import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Phone, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  getIndianPhoneDiagnostic,
  getPhoneAuthError,
  normalizeIndianPhone,
  withRequestTimeout,
} from "@/lib/phone";

/** Normalises an Indian mobile number to E.164, which Supabase phone auth requires. */
export const toE164 = normalizeIndianPhone;

export function PhoneOtpForm({
  remember = true,
  onSuccess,
}: {
  remember?: boolean;
  onSuccess: () => void | Promise<void>;
}) {
  const { sendPhoneOtp, verifyPhoneOtp } = useAuth();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [requestedPhone, setRequestedPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const busyRef = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function send() {
    setErrorMessage("");
    const e164 = toE164(phone);
    if (!e164) {
      setErrorMessage("Enter a valid 10-digit Indian mobile number.");
      return toast.error("Enter a valid 10-digit Indian mobile number.");
    }
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setCode("");
    try {
      console.info("[Phone OTP] normalized send number", {
        ...getIndianPhoneDiagnostic(e164),
        valid: true,
      });
      const { error } = await withRequestTimeout(sendPhoneOtp(e164), "send the OTP");
      if (error) throw error;
      setRequestedPhone(e164);
      setSent(true);
      setCooldown(30);
      toast.success(
        "OTP request accepted. SMS delivery depends on Supabase provider configuration.",
      );
    } catch (error) {
      const message = getPhoneAuthError(error, "send the OTP");
      setErrorMessage(message);
      toast.error(message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function verify() {
    if (!requestedPhone) {
      setErrorMessage("Request a new OTP before verifying.");
      return toast.error("Request a new OTP before verifying.");
    }
    if (!/^\d{6}$/.test(code)) {
      setErrorMessage("Enter the six-digit code.");
      return toast.error("Enter the six-digit code.");
    }
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setErrorMessage("");
    try {
      console.info(
        "[Phone OTP] normalized verification number",
        getIndianPhoneDiagnostic(requestedPhone),
      );
      const { error } = await withRequestTimeout(
        verifyPhoneOtp(requestedPhone, code, remember),
        "verify the OTP",
      );
      if (error) throw error;
      toast.success("Signed in");
      await onSuccess();
    } catch (error) {
      const message = getPhoneAuthError(error, "verify the OTP");
      setErrorMessage(message);
      toast.error(message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="Mobile number"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            setRequestedPhone("");
            setCode("");
            setErrorMessage("");
          }}
          disabled={sent || busy}
          className="h-12 rounded-xl pl-10"
        />
      </div>

      {sent && (
        <div className="relative">
          <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="Enter 6-digit code"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
              setErrorMessage("");
            }}
            className="h-12 rounded-xl pl-10 tracking-[0.4em] font-semibold"
          />
        </div>
      )}

      {errorMessage && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}

      {!sent ? (
        <Button
          type="button"
          onClick={send}
          disabled={busy}
          className="w-full h-12 rounded-xl bg-[#16a34a] hover:bg-[#15803d] text-white font-bold text-base shadow-md"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…
            </>
          ) : (
            "Send code"
          )}
        </Button>
      ) : (
        <div className="space-y-2">
          <Button
            type="button"
            onClick={verify}
            disabled={busy}
            className="w-full h-12 rounded-xl bg-[#16a34a] hover:bg-[#15803d] text-white font-bold text-base shadow-md"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verifying…
              </>
            ) : (
              "Verify & continue"
            )}
          </Button>
          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                setSent(false);
                setRequestedPhone("");
                setCode("");
                setErrorMessage("");
                setCooldown(0);
              }}
              disabled={busy}
              className="text-muted-foreground hover:text-foreground"
            >
              Change number
            </button>
            <button
              type="button"
              onClick={send}
              disabled={cooldown > 0 || busy}
              className="font-bold text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
