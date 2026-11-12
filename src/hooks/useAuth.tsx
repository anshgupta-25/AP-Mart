import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { normalizeIndianPhone } from "@/lib/phone";
import { publicSiteOrigin } from "@/lib/api-base";
import { disablePush } from "@/integrations/firebase/messaging";

export type Role = "super_admin" | "admin" | "customer" | "shopkeeper" | "delivery" | "support";

const REMEMBER_KEY = "flashbasket.remember";
const SESSION_MARKER = "flashbasket.session-alive";

/** Remember Me: when disabled the session is dropped once the browser/app is fully restarted. */
export function setRememberMe(remember: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
    sessionStorage.setItem(SESSION_MARKER, "1");
  } catch {}
}

function shouldDropSessionOnRestart() {
  if (typeof window === "undefined") return false;
  try {
    const remember = localStorage.getItem(REMEMBER_KEY);
    if (remember !== "0") return false;
    // No marker => this is a brand-new browser session, so the old one must not persist.
    const alive = sessionStorage.getItem(SESSION_MARKER);
    if (!alive) return true;
    return false;
  } catch {
    return false;
  }
}

export type RoleHome =
  | "/super-admin/dashboard"
  | "/admin/dashboard"
  | "/support/dashboard"
  | "/shopkeeper/dashboard"
  | "/delivery/dashboard"
  | "/customer/dashboard";

export const ROLE_HOME: Record<Role, RoleHome> = {
  super_admin: "/super-admin/dashboard",
  admin: "/admin/dashboard",
  support: "/support/dashboard",
  shopkeeper: "/shopkeeper/dashboard",
  delivery: "/delivery/dashboard",
  customer: "/customer/dashboard",
};

/** Highest-privilege role first — drives role-based redirects. */
export const ROLE_PRIORITY: Role[] = ["super_admin", "admin", "support", "shopkeeper", "delivery", "customer"];

export function homeForRoles(roles: string[] | undefined | null): RoleHome {
  const found = ROLE_PRIORITY.find((r) => (roles ?? []).includes(r));
  return ROLE_HOME[found ?? "customer"];
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  rolesLoading: boolean;
  roles: Role[];
  isAdmin: boolean;
  isSuperAdmin: boolean;
  signIn: (email: string, password: string, remember?: boolean) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    phone?: string,
    extra?: { state?: string; city?: string; pincode?: string },
  ) => Promise<{ error: Error | null }>;
  sendPhoneOtp: (phone: string) => Promise<{ error: Error | null }>;
  verifyPhoneOtp: (phone: string, code: string, remember?: boolean) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      // Only react to identity transitions. TOKEN_REFRESHED (~hourly + on focus)
      // and INITIAL_SESSION (every mount) would otherwise thrash role reloads
      // and query caches.
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") {
        // Still update the session ref so useServerFn/attach reads the latest token.
        setSession(s);
        return;
      }
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        try { sessionStorage.setItem(SESSION_MARKER, "1"); } catch {}
        setRolesLoading(true);
        // Defer DB call so we don't block the auth callback.
        setTimeout(() => loadRoles(s.user.id), 0);
      } else {
        setRoles([]);
        setRolesLoading(false);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      // Remember Me disabled + fresh browser session => discard the persisted session.
      if (s && shouldDropSessionOnRestart()) {
        await supabase.auth.signOut();
        setRolesLoading(false);
        setLoading(false);
        return;
      }
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        try { sessionStorage.setItem(SESSION_MARKER, "1"); } catch {}
        setRolesLoading(true);
        loadRoles(s.user.id);
      } else {
        setRolesLoading(false);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadRoles(userId: string) {
    try {
      const [rolesRes, profileRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userId),
        supabase.from("profiles").select("status, is_active").eq("id", userId).maybeSingle(),
      ]);
      const p = profileRes.data as { status?: string | null; is_active?: boolean | null } | null;
      const blocked = p?.is_active === false || p?.status === "disabled" || p?.status === "suspended";
      if (blocked) {
        await supabase.auth.signOut();
        setRoles([]);
        if (typeof window !== "undefined") {
          const { toast } = await import("sonner");
          toast.error("Your account has been deactivated. Please contact support.");
        }
        return;
      }
      setRoles((rolesRes.data ?? []).map((r) => r.role as Role));
    } finally {
      setRolesLoading(false);
    }
  }

  const signIn = async (email: string, password: string, remember = true) => {
    setRememberMe(remember);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    phone?: string,
    extra?: { state?: string; city?: string; pincode?: string },
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${publicSiteOrigin()}/`,
        data: {
          full_name: fullName,
          phone: phone ?? null,
          state: extra?.state ?? null,
          city: extra?.city ?? null,
          pincode: extra?.pincode ?? null,
        },
      },
    });
    // With email confirmation on, Supabase hides duplicates by returning a user with no identities.
    if (!error && data?.user && (data.user.identities?.length ?? 1) === 0) {
      return { error: { message: "already registered", code: "user_already_exists" } as any };
    }
    return { error };
  };

  const sendPhoneOtp = async (phone: string) => {
    const normalizedPhone = normalizeIndianPhone(phone);
    if (!normalizedPhone) {
      return { error: new Error("Enter a valid 10-digit Indian mobile number") };
    }

    const { error } = await supabase.auth.signInWithOtp({
      phone: normalizedPhone,
      options: { shouldCreateUser: true },
    });
    return { error };
  };

  const verifyPhoneOtp = async (phone: string, code: string, remember = true) => {
    const normalizedPhone = normalizeIndianPhone(phone);
    if (!normalizedPhone) {
      return { error: new Error("Enter a valid 10-digit Indian mobile number") };
    }
    if (!/^\d{6}$/.test(code)) {
      return { error: new Error("Enter the six-digit OTP") };
    }

    setRememberMe(remember);
    const { error } = await supabase.auth.verifyOtp({
      phone: normalizedPhone,
      token: code,
      type: "sms",
    });
    return { error };
  };

  const signOut = async () => {
    try {
      sessionStorage.removeItem(SESSION_MARKER);
    } catch {}
    // Remove this device's push token while still signed in (RLS needs the session).
    try {
      await disablePush(user?.id);
    } catch {}
    await supabase.auth.signOut();
    setRoles([]);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        rolesLoading,
        roles,
        isAdmin: roles.includes("admin") || roles.includes("super_admin"),
        isSuperAdmin: roles.includes("super_admin"),
        signIn,
        signUp,
        sendPhoneOtp,
        verifyPhoneOtp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
