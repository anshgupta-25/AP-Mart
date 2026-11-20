import process from "node:process";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeIndianPhone } from "@/lib/phone";

// Server-only phone OTP flow.
//
// APITXT contract (https://apitxt.com/otp-sms-api-php): we generate the code,
// POST it to {APITXT_BASE_URL}/sendOTP (form-encoded: authkey, mobile, otp) and
// APITXT delivers it. APITXT has no verify endpoint, so the code is verified
// here against an HMAC stored in public.phone_otp_codes. Supabase phone auth is not
// used at all. After a correct code we sign the user in through Supabase Auth
// with a server-generated one-time magic-link token for that phone's account.
//
// Env is read inside functions (request time), never at module scope.

export type PhoneOtpErrorCode =
  | "invalid_phone"
  | "cooldown"
  | "rate_limited"
  | "sms_failed"
  | "sms_unavailable"
  | "invalid_otp"
  | "expired_otp"
  | "too_many_attempts"
  | "no_otp"
  | "server_error";

export type PhoneOtpFailure = {
  ok: false;
  code: PhoneOtpErrorCode;
  message: string;
  retryAfter?: number;
};

export type RequestOtpResult =
  | {
      ok: true;
      otpLength: number;
      expiresIn: number;
      resendIn: number;
      maskedPhone: string;
      channel: string;
    }
  | PhoneOtpFailure;

export type VerifyOtpResult =
  | { ok: true; accessToken: string; refreshToken: string; userId: string; isNewUser: boolean }
  | PhoneOtpFailure;

class PhoneOtpError extends Error {
  constructor(
    public code: PhoneOtpErrorCode,
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
  }
}

const fail = (code: PhoneOtpErrorCode, message: string, retryAfter?: number): PhoneOtpFailure =>
  retryAfter ? { ok: false, code, message, retryAfter } : { ok: false, code, message };

function intEnv(name: string, fallback: number, min: number, max: number) {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}

function otpSettings() {
  return {
    length: intEnv("OTP_LENGTH", 6, 4, 8),
    ttl: intEnv("OTP_EXPIRY_SECONDS", 300, 60, 1800),
    maxAttempts: intEnv("OTP_MAX_ATTEMPTS", 5, 1, 10),
    cooldown: intEnv("OTP_RESEND_COOLDOWN", 30, 10, 600),
    maxPerHour: intEnv("OTP_MAX_SENDS_PER_HOUR", 5, 1, 20),
  };
}

const maskPhone = (phone: string) => `${phone.slice(0, 3)}******${phone.slice(-2)}`;

/** Masks any phone-like digit runs so logs never contain full numbers. */
const scrub = (text: string) =>
  text.replace(/\d{6,}/g, (d) => `${"*".repeat(d.length - 2)}${d.slice(-2)}`).slice(0, 300);

function generateOtp(length: number) {
  return randomInt(0, 10 ** length)
    .toString()
    .padStart(length, "0");
}

function hashOtp(phone: string, otp: string) {
  const pepper = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!pepper) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to hash OTPs");
  return createHmac("sha256", pepper).update(`${phone}:${otp}`).digest("hex");
}

// The phone_otp_codes table and its functions are not in the generated Database types.
const db = () => supabaseAdmin as unknown as SupabaseClient;

type Settings = ReturnType<typeof otpSettings>;
type IssueStatus = { status: "ok" | "cooldown" | "rate_limited"; retryAfter: number };
type VerifyStatus = "ok" | "invalid" | "expired" | "locked" | "none";

/**
 * Where pending codes live. Prefers the phone_otp_codes table (migration
 * 20261118090000_phone_otp_apitxt.sql). If that migration has not been applied
 * the same rules run in server memory, so OTP still works on a single server
 * process; codes are then lost on restart (the user just requests a new one).
 */
interface OtpStore {
  issue(phone: string, hash: string, s: Settings): Promise<IssueStatus>;
  verify(phone: string, hash: string, maxAttempts: number): Promise<VerifyStatus>;
  voidCode(phone: string, hash: string): Promise<void>;
}

const isMissingDbObject = (e: { code?: string; message?: string }) =>
  e.code === "PGRST202" ||
  e.code === "PGRST205" ||
  e.code === "42P01" ||
  e.code === "42883" ||
  /could not find the (function|table)|does not exist/i.test(e.message ?? "");

class MissingDbObject extends Error {}

const dbStore: OtpStore = {
  async issue(phone, hash, s) {
    const { data, error } = await db().rpc("issue_phone_otp", {
      _phone: phone,
      _hash: hash,
      _ttl_seconds: s.ttl,
      _cooldown_seconds: s.cooldown,
      _max_per_hour: s.maxPerHour,
    });
    if (error) {
      if (isMissingDbObject(error)) throw new MissingDbObject(error.message);
      throw new Error(`issue_phone_otp: ${error.message}`);
    }
    const row = (Array.isArray(data) ? data[0] : data) as
      | { status: IssueStatus["status"]; retry_after: number }
      | undefined;
    if (!row) throw new Error("issue_phone_otp returned no row");
    return { status: row.status, retryAfter: row.retry_after };
  },
  async verify(phone, hash, maxAttempts) {
    const { data, error } = await db().rpc("verify_phone_otp", {
      _phone: phone,
      _hash: hash,
      _max_attempts: maxAttempts,
    });
    if (error) {
      if (isMissingDbObject(error)) throw new MissingDbObject(error.message);
      throw new Error(`verify_phone_otp: ${error.message}`);
    }
    return data as VerifyStatus;
  },
  async voidCode(phone, hash) {
    await db()
      .from("phone_otp_codes")
      .update({ otp_hash: "", last_sent_at: new Date(0).toISOString() })
      .eq("phone", phone)
      .eq("otp_hash", hash);
  },
};

type MemRow = {
  hash: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
  windowStart: number;
  sendCount: number;
};
const memRows = new Map<string, MemRow>();

const memoryStore: OtpStore = {
  async issue(phone, hash, s) {
    const now = Date.now();
    // Drop rows idle for over an hour so the map cannot grow without bound.
    for (const [k, r] of memRows) if (now - r.lastSentAt > 3_600_000) memRows.delete(k);
    const r = memRows.get(phone);
    if (r && now - r.lastSentAt < s.cooldown * 1000) {
      return {
        status: "cooldown",
        retryAfter: Math.max(1, Math.ceil((r.lastSentAt + s.cooldown * 1000 - now) / 1000)),
      };
    }
    const inWindow = r && now - r.windowStart < 3_600_000;
    if (r && inWindow && r.sendCount >= s.maxPerHour) {
      return {
        status: "rate_limited",
        retryAfter: Math.max(1, Math.ceil((r.windowStart + 3_600_000 - now) / 1000)),
      };
    }
    memRows.set(phone, {
      hash,
      expiresAt: now + s.ttl * 1000,
      attempts: 0,
      lastSentAt: now,
      windowStart: inWindow ? r.windowStart : now,
      sendCount: inWindow ? r.sendCount + 1 : 1,
    });
    return { status: "ok", retryAfter: 0 };
  },
  async verify(phone, hash, maxAttempts) {
    const r = memRows.get(phone);
    if (!r) return "none";
    if (r.expiresAt < Date.now()) {
      r.hash = "";
      r.attempts = maxAttempts;
      return "expired";
    }
    if (!r.hash || r.attempts >= maxAttempts) return "locked";
    const a = Buffer.from(r.hash, "hex");
    const b = Buffer.from(hash, "hex");
    if (a.length === b.length && timingSafeEqual(a, b)) {
      r.hash = ""; // single use
      r.attempts = maxAttempts;
      return "ok";
    }
    r.attempts += 1;
    return r.attempts >= maxAttempts ? "locked" : "invalid";
  },
  async voidCode(phone, hash) {
    const r = memRows.get(phone);
    if (r && r.hash === hash) {
      r.hash = "";
      r.lastSentAt = 0;
    }
  },
};

let activeStore: OtpStore | null = null;

/** Runs `fn` on the DB store, switching to memory for good if the migration is missing. */
async function withStore<T>(fn: (store: OtpStore) => Promise<T>): Promise<T> {
  if (activeStore) return fn(activeStore);
  try {
    const result = await fn(dbStore);
    activeStore = dbStore;
    return result;
  } catch (error) {
    if (!(error instanceof MissingDbObject)) throw error;
    console.warn(
      "[PhoneOTP] phone_otp_codes migration not applied; keeping OTP codes in server memory.",
      "Run supabase/migrations/20261118090000_phone_otp_apitxt.sql for multi-instance/restart-safe storage.",
    );
    activeStore = memoryStore;
    return fn(memoryStore);
  }
}

const CHANNELS = ["sms", "whatsapp", "voice"] as const;
type Channel = (typeof CHANNELS)[number];

/**
 * Sends the code through APITXT and returns the channel that delivered it.
 * APITXT_CHANNEL (optional) picks sms | whatsapp | voice. When unset we try SMS
 * and fall back to WhatsApp if SMS is refused (e.g. DLT template not approved).
 */
async function sendViaApitxt(phone: string, otp: string): Promise<Channel> {
  const configured = process.env.APITXT_CHANNEL?.trim().toLowerCase() as Channel | undefined;
  const order: Channel[] =
    configured && CHANNELS.includes(configured) ? [configured] : ["sms", "whatsapp"];
  let lastError: unknown;
  for (const channel of order) {
    try {
      await sendViaApitxtChannel(phone, otp, channel);
      return channel;
    } catch (error) {
      lastError = error;
      // Only fall back when the channel itself was refused; stop on auth/number/rate errors.
      const fallbackable =
        error instanceof PhoneOtpError && error.code === "sms_failed" && channel !== order.at(-1);
      if (!fallbackable) throw error;
      console.warn(
        `[PhoneOTP] ${channel} send failed for ${maskPhone(phone)}; trying next channel`,
      );
    }
  }
  throw lastError;
}

async function sendViaApitxtChannel(phone: string, otp: string, channel: Channel) {
  const provider = (process.env.OTP_PROVIDER || "apitxt").trim().toLowerCase();
  const authKey = process.env.APITXT_AUTH_KEY?.trim();
  const baseUrl = process.env.APITXT_BASE_URL?.trim();
  if (provider !== "apitxt" || !authKey || !baseUrl) {
    console.error(
      "[PhoneOTP] SMS gateway not configured:",
      provider !== "apitxt" ? `OTP_PROVIDER=${provider} (expected apitxt)` : "",
      !authKey ? "APITXT_AUTH_KEY missing" : "",
      !baseUrl ? "APITXT_BASE_URL missing" : "",
    );
    throw new PhoneOtpError(
      "sms_unavailable",
      "SMS sign-in is not available right now. Please use email or Google sign-in.",
    );
  }

  const body = new URLSearchParams({
    authkey: authKey,
    mobile: phone.replace(/^\+/, ""), // APITXT expects 91XXXXXXXXXX
    otp,
    channel,
  });
  const templateId = process.env.APITXT_TEMPLATE_ID?.trim();
  if (templateId && channel === "sms") body.set("template_id", templateId);

  let res: Response;
  try {
    res = await fetch(`${baseUrl.replace(/\/+$/, "")}/sendOTP`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    console.error(
      `[PhoneOTP] APITXT ${channel} request failed:`,
      error instanceof Error ? error.message : error,
    );
    throw new PhoneOtpError(
      "sms_failed",
      "Could not reach the SMS service. Please try again in a moment.",
    );
  }

  const text = await res.text().catch(() => "");
  let json: { status?: unknown; message?: unknown } | null = null;
  try {
    json = JSON.parse(text) as { status?: unknown; message?: unknown };
  } catch {
    json = null;
  }
  if (res.ok && String(json?.status ?? "").toLowerCase() === "success") return;

  const vendorMessage = typeof json?.message === "string" ? json.message : text;
  console.error(
    `[PhoneOTP] APITXT ${channel} send failed for ${maskPhone(phone)}: HTTP ${res.status} ${scrub(vendorMessage)}`,
  );

  switch (res.status) {
    case 401:
      throw new PhoneOtpError(
        "sms_unavailable",
        "SMS sign-in is not available right now. Please use email or Google sign-in.",
      );
    case 403:
      throw new PhoneOtpError(
        "sms_failed",
        "The SMS could not be sent because the OTP message template is not approved yet. Please use email or Google sign-in for now.",
      );
    case 422:
      throw new PhoneOtpError(
        "invalid_phone",
        "The SMS service rejected this mobile number. Check the number and try again.",
      );
    case 429:
      throw new PhoneOtpError(
        "rate_limited",
        "Too many OTP requests right now. Please wait a minute and try again.",
        60,
      );
    default:
      throw new PhoneOtpError(
        "sms_failed",
        res.status >= 500
          ? "The SMS service is temporarily unavailable. Please try again shortly."
          : "The OTP SMS could not be sent. Please try again.",
      );
  }
}

export async function handleRequestOtp(rawPhone: string): Promise<RequestOtpResult> {
  const phone = normalizeIndianPhone(rawPhone);
  if (!phone) return fail("invalid_phone", "Enter a valid 10-digit Indian mobile number.");

  try {
    const s = otpSettings();
    const otp = generateOtp(s.length);
    const hash = hashOtp(phone, otp);

    let issued: IssueStatus;
    try {
      issued = await withStore((store) => store.issue(phone, hash, s));
    } catch (error) {
      console.error(
        "[PhoneOTP] could not store OTP:",
        error instanceof Error ? error.message : error,
      );
      return fail("server_error", "Could not start phone sign-in. Please try again.");
    }
    if (issued.status === "cooldown") {
      return fail(
        "cooldown",
        `Please wait ${issued.retryAfter}s before requesting a new code.`,
        issued.retryAfter,
      );
    }
    if (issued.status === "rate_limited") {
      return fail(
        "rate_limited",
        `Too many codes requested for this number. Try again in ${Math.ceil(issued.retryAfter / 60)} min.`,
        issued.retryAfter,
      );
    }

    let channel: string;
    try {
      channel = await sendViaApitxt(phone, otp);
    } catch (error) {
      // Void the undelivered code and lift the cooldown so the user can retry right away.
      await withStore((store) => store.voidCode(phone, hash)).catch(() => undefined);
      throw error;
    }

    return {
      ok: true,
      otpLength: s.length,
      expiresIn: s.ttl,
      resendIn: s.cooldown,
      maskedPhone: maskPhone(phone),
      channel,
    };
  } catch (error) {
    if (error instanceof PhoneOtpError) return fail(error.code, error.message, error.retryAfter);
    console.error("[PhoneOTP] request failed:", error instanceof Error ? error.message : error);
    return fail("server_error", "Could not send the OTP. Please try again.");
  }
}

/** Internal login identity for a phone account. `.invalid` (RFC 2606) can never receive mail. */
function phoneAuthEmail(phone: string) {
  const domain = process.env.PHONE_AUTH_EMAIL_DOMAIN?.trim() || "phone.apmart.invalid";
  return `${phone.replace(/\D/g, "")}@${domain}`;
}

async function createPhoneSession(
  phone: string,
  profile: { fullName?: string; email?: string },
): Promise<{ accessToken: string; refreshToken: string; userId: string; isNewUser: boolean }> {
  const email = phoneAuthEmail(phone);
  const fullName = profile.fullName?.trim() ?? "";

  // app_metadata can only be set with the service role, so it proves the account
  // was created by this flow and not pre-registered by someone else.
  const created = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone },
    app_metadata: { phone_otp: true, phone },
  });
  let isNewUser = false;
  if (created.error) {
    const exists =
      created.error.code === "email_exists" ||
      /already (been )?registered|already exists/i.test(created.error.message);
    if (!exists) throw created.error;
  } else {
    isNewUser = true;
    // The new-user trigger copies the internal login email into the profile; replace it.
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ email: profile.email?.trim() || null, phone })
      .eq("id", created.data.user.id);
    if (error) console.warn("[PhoneOTP] profile email cleanup failed:", error.message);
  }

  const link = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error) throw link.error;
  const meta = link.data.user.app_metadata as { phone_otp?: unknown; phone?: unknown };
  if (meta?.phone_otp !== true || meta?.phone !== phone) {
    throw new Error("Refusing to sign in: account was not created by phone OTP");
  }

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anonKey) throw new Error("SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY missing");
  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await anon.auth.verifyOtp({
    token_hash: link.data.properties.hashed_token,
    type: "magiclink",
  });
  if (error || !data.session) throw error ?? new Error("Supabase returned no session");

  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    userId: data.session.user.id,
    isNewUser,
  };
}

export async function handleVerifyOtp(input: {
  phone: string;
  code: string;
  fullName?: string;
  email?: string;
}): Promise<VerifyOtpResult> {
  const phone = normalizeIndianPhone(input.phone);
  if (!phone) return fail("invalid_phone", "Enter a valid 10-digit Indian mobile number.");
  const s = otpSettings();
  const code = input.code.trim();
  if (!new RegExp(`^\\d{${s.length}}$`).test(code)) {
    return fail("invalid_otp", `Enter the ${s.length}-digit code sent to your phone.`);
  }

  try {
    const hash = hashOtp(phone, code);
    const checked = await withStore((store) => store.verify(phone, hash, s.maxAttempts));
    switch (checked) {
      case "ok":
        break;
      case "invalid":
        return fail("invalid_otp", "Incorrect code. Please check the message and try again.");
      case "expired":
        return fail("expired_otp", "This code has expired. Request a new one.");
      case "locked":
        return fail("too_many_attempts", "Too many incorrect attempts. Request a new code.");
      default:
        return fail("no_otp", "No active code for this number. Request a new one.");
    }
  } catch (error) {
    console.error("[PhoneOTP] verify failed:", error instanceof Error ? error.message : error);
    return fail("server_error", "Could not verify the code. Please try again.");
  }

  try {
    const session = await createPhoneSession(phone, input);
    return { ok: true, ...session };
  } catch (error) {
    console.error(
      `[PhoneOTP] session creation failed for ${maskPhone(phone)}:`,
      error instanceof Error ? error.message : error,
    );
    return fail(
      "server_error",
      "Your number was verified but sign-in could not be completed. Request a new code and try again.",
    );
  }
}
