import { Link } from "@tanstack/react-router";
import { ShoppingCart, ArrowRight, LogIn, UserPlus } from "lucide-react";

interface Props {
  /** Path to return to after a successful sign-in. */
  next: string;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
}

export function AuthRequired({
  next,
  title = "Your cart awaits",
  description = "Sign in to view your cart, save your favourite products, and place orders.",
  icon,
}: Props) {
  return (
    <div className="grid min-h-[70vh] place-items-center px-4 py-12">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-tint-mint text-primary-ink">
          {icon ?? <ShoppingCart className="h-6 w-6" strokeWidth={1.8} />}
        </div>

        <h1 className="mt-4 text-subtitle font-semibold">{title}</h1>
        <p className="mt-1.5 text-meta text-muted-foreground">{description}</p>

        <div className="mt-6 space-y-2.5">
          <Link
            to="/login"
            search={{ next } as never}
            className="press flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-body font-semibold text-primary-foreground"
          >
            <LogIn className="h-4 w-4" /> Sign in
          </Link>
          <Link
            to="/signup"
            search={{ next } as never}
            className="press flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card text-body font-semibold text-foreground"
          >
            <UserPlus className="h-4 w-4" /> Create account
          </Link>
        </div>

        <Link
          to="/"
          className="mt-5 inline-flex items-center gap-1 text-meta font-medium text-muted-foreground transition hover:text-foreground"
        >
          Continue browsing <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
