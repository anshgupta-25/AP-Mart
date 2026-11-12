-- 1) New role tier
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';

-- 2) Profile columns required by the auth spec (roles intentionally NOT stored here)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS shop_id uuid REFERENCES public.shops(id) ON DELETE SET NULL;

-- Keep is_active in sync with the legacy status text column
UPDATE public.profiles SET is_active = (coalesce(status, 'active') <> 'suspended');

-- 3) has_role: super_admin inherits every admin privilege platform-wide.
--    Uses ::text comparison so the newly added enum label is safe inside this transaction.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND (
        ur.role = _role
        OR (_role::text = 'admin' AND ur.role::text = 'super_admin')
      )
  )
$$;

-- 4) Explicit super admin check
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.role::text = 'super_admin'
  )
$$;

REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;

-- 5) Security audit log (role changes, activation, impersonation)
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_role text,
  target_user_id uuid,
  event_type text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.security_audit_log TO authenticated;
GRANT ALL ON public.security_audit_log TO service_role;
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sal_super_admin_read ON public.security_audit_log;
CREATE POLICY sal_super_admin_read ON public.security_audit_log
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_security_audit_log_created ON public.security_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_target ON public.security_audit_log (target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role ON public.user_roles (user_id, role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles (is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_shop_id ON public.profiles (shop_id) WHERE shop_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.log_security_event(
  _event_type text,
  _target_user_id uuid,
  _detail jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.security_audit_log (actor_id, actor_role, target_user_id, event_type, detail)
  VALUES (
    auth.uid(),
    CASE WHEN public.is_super_admin(auth.uid()) THEN 'super_admin'
         WHEN public.has_role(auth.uid(), 'admin') THEN 'admin'
         ELSE 'user' END,
    _target_user_id,
    _event_type,
    coalesce(_detail, '{}'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_security_event(text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_security_event(text, uuid, jsonb) TO authenticated;

-- 6) Role assignment: privileged tiers are Super Admin only
CREATE OR REPLACE FUNCTION public.admin_assign_role(_user_id uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_privileged boolean := _role::text IN ('admin', 'super_admin');
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can assign roles';
  END IF;

  IF v_privileged AND NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Super Admin only: assigning the % role requires Super Admin access', _role;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;

  PERFORM public.log_security_event('role_assigned', _user_id, jsonb_build_object('role', _role::text));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_remove_role(_user_id uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_privileged boolean := _role::text IN ('admin', 'super_admin');
  v_remaining int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can remove roles';
  END IF;

  IF v_privileged AND NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Super Admin only: removing the % role requires Super Admin access', _role;
  END IF;

  -- Never allow the platform to be left without a Super Admin
  IF _role::text = 'super_admin' THEN
    SELECT count(*) INTO v_remaining
    FROM public.user_roles
    WHERE role::text = 'super_admin' AND user_id <> _user_id;

    IF v_remaining = 0 THEN
      RAISE EXCEPTION 'Cannot remove the last Super Admin account';
    END IF;
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _user_id AND role = _role;

  PERFORM public.log_security_event('role_removed', _user_id, jsonb_build_object('role', _role::text));
END;
$$;

-- 7) Activation/suspension: touching an Admin or Super Admin requires Super Admin
CREATE OR REPLACE FUNCTION public.admin_set_user_status(_user_id uuid, _status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_privileged boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can change account status';
  END IF;

  IF _status NOT IN ('active', 'suspended') THEN
    RAISE EXCEPTION 'Invalid status: %', _status;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text IN ('admin', 'super_admin')
  ) INTO v_target_privileged;

  IF v_target_privileged AND NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Super Admin only: this account is privileged';
  END IF;

  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot change your own account status';
  END IF;

  UPDATE public.profiles
  SET status = _status,
      is_active = (_status = 'active'),
      updated_at = now()
  WHERE id = _user_id;

  PERFORM public.log_security_event(
    CASE WHEN _status = 'active' THEN 'account_activated' ELSE 'account_suspended' END,
    _user_id,
    jsonb_build_object('status', _status)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_assign_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_remove_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_user_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_assign_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_remove_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_status(uuid, text) TO authenticated;