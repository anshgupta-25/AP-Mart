import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { signInWithGoogleCredential } from "@/lib/googleSignIn.functions";
import { syncUserProfile } from "@/lib/googleAuth";
import { homeForRoles } from "@/hooks/useAuth";

// Google Identity Services (official library). The ID token it returns is
// verified on our server; the OAuth client secret is never used in the browser.
const GIS_SRC = "https://accounts.google.com/gsi/client";
const STAFF = ["super_admin", "admin", "shopkeeper", "delivery", "support"];

let gisPromise: Promise<void> | undefined;
function loadGis(): Promise<void> {
  if ((window as any).google?.accounts?.id) return Promise.resolve();
  gisPromise ??= new Promise<void>((resolve, reject) => {
    const el = document.createElement("script");
    el.src = GIS_SRC;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => {
      gisPromise = undefined;
      reject(new Error("Could not load Google sign-in."));
    };
    document.head.appendChild(el);
  });
  return gisPromise;
}

function randomNonce() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export function GoogleSignInButton({ next }: { next?: string }) {
  const navigate = useNavigate();
  const holder = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim();

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    const nonce = randomNonce();

    async function onCredential(resp: { credential?: string }) {
      if (!resp.credential) return toast.error("Google sign-in was cancelled.");
      setBusy(true);
      try {
        const tokens = await signInWithGoogleCredential({
          data: { credential: resp.credential, nonce },
        });
        const { data, error } = await supabase.auth.setSession(tokens);
        if (error || !data.user) throw error ?? new Error("Could not start your session.");
        await syncUserProfile(data.user);
        const { data: rows } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id);
        const roles = (rows ?? []).map((r: any) => r.role as string);
        const saved = next || sessionStorage.getItem("flashbasket.auth.next");
        sessionStorage.removeItem("flashbasket.auth.next");
        toast.success("Signed in with Google");
        const dest = roles.some((r) => STAFF.includes(r))
          ? homeForRoles(roles as any)
          : saved && saved.startsWith("/") && !saved.startsWith("//")
            ? saved
            : "/customer/dashboard";
        navigate({ to: dest as any, replace: true });
      } catch (err: any) {
        setBusy(false);
        toast.error(err?.message || "Google sign-in failed");
      }
    }

    loadGis()
      .then(() => {
        if (cancelled || !holder.current) return;
        const gid = (window as any).google.accounts.id;
        gid.initialize({
          client_id: clientId,
          callback: onCredential,
          nonce,
          use_fedcm_for_prompt: true,
        });
        gid.renderButton(holder.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "pill",
          width: Math.min(holder.current.clientWidth || 320, 400),
        });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [clientId, next, navigate]);

  if (!clientId)
    return <p className="text-xs text-destructive text-center">Google sign-in is not configured.</p>;
  if (failed)
    return (
      <p className="text-xs text-destructive text-center">
        Google sign-in is unavailable. Check your connection and reload.
      </p>
    );
  return (
    <div className="relative flex justify-center min-h-[44px]">
      <div ref={holder} className={busy ? "pointer-events-none opacity-40" : ""} />
      {busy && (
        <Loader2 className="absolute top-3 h-5 w-5 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}
