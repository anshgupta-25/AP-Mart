import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { signInWithGoogleCredential, signInWithGoogleNative } from "@/lib/googleAuth";

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

/**
 * "Continue with Google". Website: Google Identity Services button (ID token verified by
 * our server). Android app: native flow in the system browser (see signInWithGoogleNative).
 */
export function GoogleSignInButton({ next }: { next?: string }) {
  if (Capacitor.isNativePlatform()) return <NativeGoogleButton next={next} />;
  return <WebGoogleButton next={next} />;
}

function NativeGoogleButton({ next }: { next?: string }) {
  const [busy, setBusy] = useState(false);
  const start = async () => {
    setBusy(true);
    if (next) sessionStorage.setItem("flashbasket.auth.next", next);
    const { error } = await signInWithGoogleNative();
    setBusy(false);
    if (error) toast.error(error.message);
  };
  return (
    <button
      type="button"
      onClick={start}
      disabled={busy}
      className="press flex h-11 w-full items-center justify-center gap-2.5 rounded-full border border-border bg-card text-body font-medium disabled:opacity-60"
    >
      <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
        <path
          fill="#FFC107"
          d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
        />
        <path
          fill="#FF3D00"
          d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
        />
        <path
          fill="#4CAF50"
          d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
        />
        <path
          fill="#1976D2"
          d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
        />
      </svg>
      {busy ? "Opening Google…" : "Continue with Google"}
    </button>
  );
}

function WebGoogleButton({ next }: { next?: string }) {
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
