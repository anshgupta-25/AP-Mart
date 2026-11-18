create table if not exists public.phone_otps (
  phone        text primary key,
  otp_hash     text        not null,
  expires_at   timestamptz not null,
  attempts     integer     not null default 0,
  last_sent_at timestamptz not null default now(),
  consumed     boolean     not null default false,
  created_at   timestamptz not null default now()
);

alter table public.phone_otps enable row level security;
revoke all on public.phone_otps from anon, authenticated;

create or replace function public.phone_otp_issue(
  p_phone text, p_hash text, p_ttl_seconds integer, p_cooldown_seconds integer
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_rows integer;
  v_last timestamptz;
begin
  insert into public.phone_otps as o (phone, otp_hash, expires_at, attempts, last_sent_at, consumed)
  values (p_phone, p_hash, now() + make_interval(secs => p_ttl_seconds), 0, now(), false)
  on conflict (phone) do update
    set otp_hash = excluded.otp_hash,
        expires_at = excluded.expires_at,
        attempts = 0,
        consumed = false,
        last_sent_at = now()
    where o.last_sent_at <= now() - make_interval(secs => p_cooldown_seconds);
  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    return 0;
  end if;
  select last_sent_at into v_last from public.phone_otps where phone = p_phone;
  return greatest(1, ceil(extract(epoch from (v_last + make_interval(secs => p_cooldown_seconds) - now())))::integer);
end $$;

create or replace function public.phone_otp_release(p_phone text, p_hash text)
returns void language sql security definer set search_path = public as $$
  delete from public.phone_otps where phone = p_phone and otp_hash = p_hash;
$$;

create or replace function public.phone_otp_attempt(p_phone text, p_max integer)
returns table (otp_hash text, attempts integer)
language sql security definer set search_path = public as $$
  update public.phone_otps o
     set attempts = o.attempts + 1
   where o.phone = p_phone and not o.consumed and o.expires_at > now() and o.attempts < p_max
  returning o.otp_hash, o.attempts;
$$;

create or replace function public.phone_otp_consume(p_phone text, p_hash text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_rows integer;
begin
  update public.phone_otps set consumed = true
   where phone = p_phone and otp_hash = p_hash and not consumed and expires_at > now();
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end $$;

revoke all on function public.phone_otp_issue(text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.phone_otp_release(text, text) from public, anon, authenticated;
revoke all on function public.phone_otp_attempt(text, integer) from public, anon, authenticated;
revoke all on function public.phone_otp_consume(text, text) from public, anon, authenticated;
grant execute on function public.phone_otp_issue(text, text, integer, integer) to service_role;
grant execute on function public.phone_otp_release(text, text) to service_role;
grant execute on function public.phone_otp_attempt(text, integer) to service_role;
grant execute on function public.phone_otp_consume(text, text) to service_role;;
