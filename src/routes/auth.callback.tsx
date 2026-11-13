import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { syncUserProfile } from "@/lib/googleAuth";
import { homeForRoles } from "@/hooks/useAuth";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { errorMessage } from "@/lib/utils";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({ meta: [{ title: "Authenticating — AP Mart" }] }),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Completing Google sign in…");
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    let isMounted = true;

    async function handleOAuthCallback() {
      try {
        // 1. Inspect search params and hash fragment for error returns
        const searchParams = new URLSearchParams(window.location.search);
        const rawHash = window.location.hash.startsWith("#")
          ? window.location.hash.slice(1)
          : window.location.hash;
        const hashParams = new URLSearchParams(rawHash);

        const error = searchParams.get("error") || hashParams.get("error");
        const errorDescription =
          searchParams.get("error_description") || hashParams.get("error_description");
        const errorCode = searchParams.get("error_code") || hashParams.get("error_code");

        if (error || errorDescription) {
          const isCancelled =
            error === "access_denied" ||
            errorCode === "403" ||
            (errorDescription && /denied|cancelled|cancel/i.test(errorDescription));

          const userFriendlyError = isCancelled
            ? "Google sign-in was cancelled."
            : errorDescription || error || "Google authentication failed.";

          if (isMounted) {
            setStatus("error");
            setMessage(userFriendlyError);
          }
          toast.error(userFriendlyError);

          setTimeout(() => {
            if (isMounted) navigate({ to: "/login", replace: true });
          }, 2500);
          return;
        }

        // 2. Exchange authorization code for PKCE flow if present
        const code = searchParams.get("code");
        if (code) {
          setMessage("Exchanging authorization code…");
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.error("[OAuth Callback] exchangeCodeForSession failed:", exchangeError);
            if (isMounted) {
              setStatus("error");
              setMessage(exchangeError.message || "Failed to exchange authorization token.");
            }
            toast.error(exchangeError.message || "Authentication failed");
            setTimeout(() => {
              if (isMounted) navigate({ to: "/login", replace: true });
            }, 3000);
            return;
          }
        }

        // 3. Retrieve and verify the active session
        setMessage("Verifying user session…");
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        let session = sessionData.session;

        if (sessionError || !session?.user) {
          // If session is still propagating from hash or storage, wait briefly for auth event
          session = await new Promise((resolve) => {
            const timer = setTimeout(() => resolve(null), 3000);
            const {
              data: { subscription },
            } = supabase.auth.onAuthStateChange((event, s) => {
              if (s?.user) {
                clearTimeout(timer);
                subscription.unsubscribe();
                resolve(s);
              }
            });
          });
        }

        if (!session?.user) {
          if (isMounted) {
            setStatus("error");
            setMessage("Unable to establish authenticated session. Please try again.");
          }
          toast.error("Sign-in session not found");
          setTimeout(() => {
            if (isMounted) navigate({ to: "/login", replace: true });
          }, 2500);
          return;
        }

        const user = session.user;

        // 4. Verify account active status (Requirement 8 - blocked accounts)
        const { data: profileCheck } = await supabase
          .from("profiles")
          .select("status, is_active")
          .eq("id", user.id)
          .maybeSingle();

        if (
          profileCheck?.is_active === false ||
          profileCheck?.status === "disabled" ||
          profileCheck?.status === "suspended"
        ) {
          await supabase.auth.signOut();
          if (isMounted) {
            setStatus("error");
            setMessage("Your account has been deactivated. Please contact support.");
          }
          toast.error("Your account has been deactivated. Please contact support.");
          setTimeout(() => {
            if (isMounted) navigate({ to: "/login", replace: true });
          }, 3000);
          return;
        }

        // 5. Synchronize user profile row idempotently (Requirement 7)
        setMessage("Synchronizing profile…");
        await syncUserProfile(user);

        // 6. Inspect roles and determine navigation target
        const { data: rolesData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        const roles = (rolesData ?? []).map((r) => r.role as string);

        // Check if there was a saved return route
        const savedNext =
          sessionStorage.getItem("flashbasket.auth.next") || searchParams.get("next") || null;
        sessionStorage.removeItem("flashbasket.auth.next");

        if (isMounted) {
          setStatus("success");
          setMessage("Welcome! Redirecting…");
        }
        toast.success("Signed in with Google successfully!");

        const STAFF = ["super_admin", "admin", "shopkeeper", "delivery", "support"];
        const isStaff = roles.some((r) => STAFF.includes(r));

        setTimeout(() => {
          if (!isMounted) return;
          if (isStaff) {
            const destination = homeForRoles(roles);
            navigate({ to: destination, replace: true });
          } else {
            const destination =
              savedNext && savedNext.startsWith("/") ? savedNext : "/customer/dashboard";
            navigate({ to: destination, replace: true });
          }
        }, 600);
      } catch (err) {
        console.error("[OAuth Callback] Unexpected error:", err);
        if (isMounted) {
          setStatus("error");
          setMessage(errorMessage(err, "An unexpected error occurred during Google sign-in."));
        }
        toast.error("Google sign-in error");
        setTimeout(() => {
          if (isMounted) navigate({ to: "/login", replace: true });
        }, 3000);
      }
    }

    handleOAuthCallback();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-card rounded-xl border border-border/70 p-6 text-center space-y-4">
        <div className="flex justify-center">
          <LogoMark size="lg" className="h-12 w-12 rounded-xl" />
        </div>

        {status === "loading" && (
          <div className="space-y-3">
            <h1 className="text-subtitle font-semibold text-foreground">Signing you in…</h1>
            <p className="text-meta text-muted-foreground">{message}</p>
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-3">
            <div className="flex justify-center text-primary">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h1 className="text-subtitle font-semibold text-foreground">Welcome back!</h1>
            <p className="text-meta text-muted-foreground">{message}</p>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <div className="flex justify-center text-destructive">
              <AlertCircle className="h-8 w-8" />
            </div>
            <h1 className="text-subtitle font-semibold text-foreground">Sign-in error</h1>
            <p className="text-meta text-muted-foreground">{message}</p>
            <Button
              type="button"
              onClick={() => navigate({ to: "/login", replace: true })}
              className="h-11 w-full rounded-xl"
            >
              Back to Sign In
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
