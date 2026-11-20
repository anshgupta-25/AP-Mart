-- Phone OTP via APITXT (self-verify pattern).
-- APITXT only delivers a code we generate; verification happens here.
-- Only the server (service_role) can touch this table or call these functions.

CREATE TABLE IF NOT EXISTS public.phone_otp_codes (
  phone         text PRIMARY KEY,               -- E.164, e.g. +919876543210
  otp_hash      text NOT NULL,                  -- HMAC-SHA256 of phone:code, never the code itself
  expires_at    timestamptz NOT NULL,
  attempts      integer NOT NULL DEFAULT 0,
  last_sent_at  timestamptz NOT NULL DEFAULT now(),
  window_start  timestamptz NOT NULL DEFAULT now(),
  send_count    integer NOT NULL DEFAULT 1
);

ALTER TABLE public.phone_otp_codes ENABLE ROW LEVEL SECURITY;
-- No policies: anon/authenticated get nothing; service_role bypasses RLS.
REVOKE ALL ON public.phone_otp_codes FROM anon, authenticated;
GRANT ALL ON public.phone_otp_codes TO service_role;

-- Stores a new code for _phone, enforcing a resend cooldown and an hourly send cap.
-- Returns status: 'ok' | 'cooldown' | 'rate_limited', and retry_after seconds.
CREATE OR REPLACE FUNCTION public.issue_phone_otp(
  _phone text,
  _hash text,
  _ttl_seconds integer,
  _cooldown_seconds integer,
  _max_per_hour integer
)
RETURNS TABLE (status text, retry_after integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r public.phone_otp_codes%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.phone_otp_codes WHERE phone = _phone FOR UPDATE;

  IF NOT FOUND THEN
    BEGIN
      INSERT INTO public.phone_otp_codes (phone, otp_hash, expires_at)
      VALUES (_phone, _hash, now() + make_interval(secs => _ttl_seconds));
    EXCEPTION WHEN unique_violation THEN
      -- A concurrent request created the row first; treat as a resend inside the cooldown.
      RETURN QUERY SELECT 'cooldown'::text, _cooldown_seconds;
      RETURN;
    END;
    RETURN QUERY SELECT 'ok'::text, 0;
    RETURN;
  END IF;

  IF r.last_sent_at > now() - make_interval(secs => _cooldown_seconds) THEN
    RETURN QUERY SELECT 'cooldown'::text,
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM
        (r.last_sent_at + make_interval(secs => _cooldown_seconds) - now())))::integer);
    RETURN;
  END IF;

  IF r.window_start > now() - interval '1 hour' THEN
    IF r.send_count >= _max_per_hour THEN
      RETURN QUERY SELECT 'rate_limited'::text,
        GREATEST(1, CEIL(EXTRACT(EPOCH FROM (r.window_start + interval '1 hour' - now())))::integer);
      RETURN;
    END IF;
    UPDATE public.phone_otp_codes
       SET otp_hash = _hash,
           expires_at = now() + make_interval(secs => _ttl_seconds),
           attempts = 0,
           last_sent_at = now(),
           send_count = send_count + 1
     WHERE phone = _phone;
  ELSE
    UPDATE public.phone_otp_codes
       SET otp_hash = _hash,
           expires_at = now() + make_interval(secs => _ttl_seconds),
           attempts = 0,
           last_sent_at = now(),
           window_start = now(),
           send_count = 1
     WHERE phone = _phone;
  END IF;

  RETURN QUERY SELECT 'ok'::text, 0;
END;
$function$;

-- Checks a submitted code. Counts every wrong guess; a correct code is single-use.
-- Returns: 'ok' | 'invalid' | 'expired' | 'locked' | 'none'.
CREATE OR REPLACE FUNCTION public.verify_phone_otp(
  _phone text,
  _hash text,
  _max_attempts integer
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r public.phone_otp_codes%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.phone_otp_codes WHERE phone = _phone FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'none';
  END IF;

  IF r.expires_at < now() THEN
    -- Keep the row so the resend cooldown / hourly cap still apply; just void the code.
    UPDATE public.phone_otp_codes SET otp_hash = '', attempts = _max_attempts WHERE phone = _phone;
    RETURN 'expired';
  END IF;

  IF r.otp_hash = '' OR r.attempts >= _max_attempts THEN
    RETURN 'locked';
  END IF;

  IF r.otp_hash = _hash THEN
    UPDATE public.phone_otp_codes SET otp_hash = '', attempts = _max_attempts WHERE phone = _phone;
    RETURN 'ok';
  END IF;

  UPDATE public.phone_otp_codes SET attempts = attempts + 1 WHERE phone = _phone;
  IF r.attempts + 1 >= _max_attempts THEN
    RETURN 'locked';
  END IF;
  RETURN 'invalid';
END;
$function$;

REVOKE ALL ON FUNCTION public.issue_phone_otp(text, text, integer, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_phone_otp(text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_phone_otp(text, text, integer, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_phone_otp(text, text, integer) TO service_role;
