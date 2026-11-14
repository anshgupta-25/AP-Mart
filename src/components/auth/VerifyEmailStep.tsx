import { useEffect, useState } from "react";
import { MailCheck, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { requestSignupCode, verifySignupCode, type SignupDetails } from "@/lib/authEmail";

const CODE_LENGTH = 8; // matches the project's email OTP length
const RESEND_SECONDS = 45;

/**
 * "Check your email" step: enter the 8-digit code (or tap "Confirm my email" in the email).
 * `details` are kept in memory only, to resend the code and to set the chosen password.
 */
export function VerifyEmailStep({
  details,
  onVerified,
  onBack,
}: {
  details: SignupDetails;
  onVerified: () => void;
  onBack: () => void;
}) {
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const verify = async (value = code) => {
    if (value.length !== CODE_LENGTH || verifying) return;
    setVerifying(true);
    const { error } = await verifySignupCode(details.email, value, details.password);
    setVerifying(false);
    if (error) {
      toast.error(error);
      setCode("");
      return;
    }
    toast.success("Email verified. Welcome to AP Mart!");
    onVerified();
  };

  const resend = async () => {
    setResending(true);
    const { error } = await requestSignupCode(details);
    setResending(false);
    if (error) return toast.error(error);
    setCode("");
    setResendIn(RESEND_SECONDS);
    toast.success("A new code is on its way.");
  };

  return (
    <div className="text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary-soft text-primary-ink">
        <MailCheck className="h-6 w-6" strokeWidth={1.8} />
      </div>
      <h1 className="large-title mt-4">Check your email</h1>
      <p className="mx-auto mt-1 max-w-xs text-meta text-muted-foreground">
        We sent an {CODE_LENGTH}-digit code to{" "}
        <span className="font-semibold text-foreground">{details.email}</span>. Enter it below, or
        tap <span className="font-medium text-foreground">Confirm my email</span> in that email.
      </p>

      <div className="mt-6 flex justify-center">
        <InputOTP
          maxLength={CODE_LENGTH}
          value={code}
          onChange={(v) => {
            const digits = v.replace(/\D/g, "");
            setCode(digits);
            if (digits.length === CODE_LENGTH) void verify(digits);
          }}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
        >
          <InputOTPGroup>
            {Array.from({ length: CODE_LENGTH }).map((_, i) => (
              <InputOTPSlot key={i} index={i} className="h-11 w-9 text-base sm:w-10" />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>

      <Button
        className="mt-5 h-11 w-full rounded-xl"
        disabled={code.length !== CODE_LENGTH || verifying}
        onClick={() => void verify()}
      >
        {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify email"}
      </Button>

      <div className="mt-4 text-meta text-muted-foreground">
        Didn't get it? Check spam, or{" "}
        {resendIn > 0 ? (
          <span>resend in {resendIn}s</span>
        ) : (
          <button
            type="button"
            onClick={resend}
            disabled={resending}
            className="font-medium text-primary"
          >
            {resending ? "sending…" : "send a new code"}
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onBack}
        className="press mx-auto mt-5 flex items-center gap-1.5 text-meta font-medium text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Use a different email
      </button>
    </div>
  );
}
