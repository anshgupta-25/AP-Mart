import { Link } from "@tanstack/react-router";
import { ChevronRight, UserX } from "lucide-react";

/**
 * Quiet "Delete account" row for settings/profile pages (every role). It only opens the
 * dedicated /delete-account screen, which explains what is deleted and asks the user to
 * confirm with their password or an emailed code. Deliberately not red and not placed next to
 * "Sign out", so it can't be tapped by mistake.
 */
export function DeleteAccountSection({ className = "" }: { className?: string }) {
  return (
    <section className={`overflow-hidden rounded-xl border border-border/70 bg-card ${className}`}>
      <div className="px-4 pb-1 pt-3 text-caption font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Privacy &amp; account
      </div>
      <Link
        to="/delete-account"
        className="press flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-secondary/50"
      >
        <UserX className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1">
          <span className="block text-body font-medium">Delete account</span>
          <span className="block text-small text-muted-foreground">
            Permanently delete your account and personal data
          </span>
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </Link>
    </section>
  );
}
