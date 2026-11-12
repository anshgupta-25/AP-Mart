export function normalizeIndianPhone(phone: string): string | null {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");
  const localNumber =
    trimmed.startsWith("+91") && digits.length === 12
      ? digits.slice(2)
      : digits.length === 12 && digits.startsWith("91")
        ? digits.slice(2)
        : digits;

  return /^[6-9]\d{9}$/.test(localNumber) ? `+91${localNumber}` : null;
}

export function getIndianPhoneDiagnostic(phone: string): {
  valid: boolean;
  countryCode: "+91" | null;
  subscriberDigits: number;
  maskedPhone: string | null;
} {
  const normalized = normalizeIndianPhone(phone);
  return {
    valid: normalized !== null,
    countryCode: normalized ? "+91" : null,
    subscriberDigits: normalized ? 10 : phone.replace(/\D/g, "").length,
    maskedPhone: normalized ? `${normalized.slice(0, 3)}******${normalized.slice(-2)}` : null,
  };
}

export function getPhoneAuthError(error: unknown, action: string): string {
  if (typeof error !== "object" || error === null) {
    return `Could not ${action}. Please try again.`;
  }

  const authError = error as {
    message?: unknown;
    code?: unknown;
    status?: unknown;
    error_code?: unknown;
    error_description?: unknown;
    details?: unknown;
    hint?: unknown;
  };
  const safeText = (value: unknown): string | null => {
    if (typeof value !== "string" || !value.trim()) return null;
    return value.trim().replace(/(\+?\d[\d\s().-]{8,}\d)/g, (phoneLike) => {
      const digits = phoneLike.replace(/\D/g, "");
      if (digits.length < 10 || digits.length > 15) return phoneLike;
      return `${phoneLike.startsWith("+") ? "+" : ""}${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
    });
  };

  const message = safeText(authError.message);
  const details = [
    safeText(authError.error_description),
    safeText(authError.details),
    safeText(authError.hint),
  ].filter(
    (detail, index, all): detail is string => Boolean(detail) && all.indexOf(detail) === index,
  );
  const summary = [message, ...details].filter((part): part is string => Boolean(part)).join(" — ");
  const code =
    typeof authError.error_code === "string"
      ? authError.error_code
      : typeof authError.code === "string"
        ? authError.code
        : null;
  const status = typeof authError.status === "number" ? authError.status : null;
  const metadata = [code ? `code: ${code}` : null, status ? `status: ${status}` : null].filter(
    (part): part is string => part !== null,
  );

  if (summary && metadata.length) return `${summary} (${metadata.join(", ")})`;
  return (
    summary || (metadata.length ? metadata.join(", ") : `Could not ${action}. Please try again.`)
  );
}

export function withRequestTimeout<T>(request: PromiseLike<T>, action: string): Promise<T> {
  let timeoutId = 0;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(
      () =>
        reject(
          new Error(
            `Request timed out while trying to ${action}. Check your connection; a delayed SMS may still arrive.`,
          ),
        ),
      20_000,
    );
  });

  return Promise.race([Promise.resolve(request), timeout]).finally(() =>
    window.clearTimeout(timeoutId),
  );
}
