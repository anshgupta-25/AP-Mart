import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { signInWithGoogleCredential } from "@/lib/googleAuth";

type CredentialResponse = { credential?: string };
type GoogleId = {
  initialize: (cfg: {
    client_id: string;
    callback: (r: CredentialResponse) => void;
    ux_mode?: "popup";
  }) => void;
  renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
};
type GisWindow = Window & { google?: { accounts: { id: GoogleId } } };

const GIS_SRC = "https://accounts.google.com/gsi/client";
let gisPromise: Promise<void> | undefined;
function loadGis(): Promise<void> {
  gisPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = GIS_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      gisPromise = undefined;
      reject(new Error("Could not load Google sign-in"));
    };
    document.head.appendChild(s);
  });
  return gisPromise;
}

/** Google Identity Services button. On success the ID token goes to our server for verification. */
export function GoogleSignInButton({ next }: { next?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  useEffect(() => {
    if (!clientId) {
      setUnavailable(true);
      return;
    }
    let cancelled = false;
    loadGis()
      .then(() => {
        const gis = (window as unknown as GisWindow).google;
        if (cancelled || !ref.current || !gis) return;
        gis.accounts.id.initialize({
          client_id: clientId,
          ux_mode: "popup",
          callback: async ({ credential }) => {
            if (!credential) return toast.error("Google sign-in was cancelled.");
            setBusy(true);
            if (next) sessionStorage.setItem("flashbasket.auth.next", next);
            const { error } = await signInWithGoogleCredential(credential);
            if (error) {
              setBusy(false);
              return toast.error(error.message);
            }
            navigate({ to: "/auth/callback", replace: true });
          },
        });
        gis.accounts.id.renderButton(ref.current, {
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "pill",
          width: Math.min(ref.current.offsetWidth || 320, 400),
        });
      })
      .catch(() => !cancelled && setUnavailable(true));
    return () => {
      cancelled = true;
    };
  }, [clientId, next, navigate]);

  if (unavailable) {
    return (
      <p className="text-center text-meta text-muted-foreground">
        Google sign-in is currently unavailable.
      </p>
    );
  }
  return (
    <div className={busy ? "pointer-events-none opacity-60" : undefined}>
      <div ref={ref} className="flex min-h-11 w-full justify-center" />
    </div>
  );
}
