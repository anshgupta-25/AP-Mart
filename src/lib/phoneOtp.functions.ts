import { createServerFn } from "@tanstack/react-start";
import type { RequestOtpResult, VerifyOtpResult } from "./phoneOtp.server";

// Public (unauthenticated) endpoints for phone OTP sign-in via APITXT.
// All provider credentials and OTP state stay in phoneOtp.server.ts.

const str = (value: unknown, max: number) =>
  typeof value === "string" && value.length <= max ? value : undefined;

export const requestPhoneOtp = createServerFn({ method: "POST" })
  .inputValidator((input: { phone: string }) => {
    const phone = str(input?.phone, 20);
    if (!phone) throw new Error("Invalid request");
    return { phone };
  })
  .handler(async ({ data }): Promise<RequestOtpResult> => {
    const { handleRequestOtp } = await import("./phoneOtp.server");
    return handleRequestOtp(data.phone);
  });

export const verifyPhoneOtpCode = createServerFn({ method: "POST" })
  .inputValidator((input: { phone: string; code: string; fullName?: string; email?: string }) => {
    const phone = str(input?.phone, 20);
    const code = str(input?.code, 10);
    if (!phone || !code) throw new Error("Invalid request");
    return {
      phone,
      code,
      fullName: str(input.fullName, 120),
      email: str(input.email, 255),
    };
  })
  .handler(async ({ data }): Promise<VerifyOtpResult> => {
    const { handleVerifyOtp } = await import("./phoneOtp.server");
    return handleVerifyOtp(data);
  });
