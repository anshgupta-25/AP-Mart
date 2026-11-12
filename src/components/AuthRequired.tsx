import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
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
  title = "Your Cart Awaits",
  description = "Sign in to view your cart, save your favourite products, and place orders.",
  icon,
}: Props) {
  return (
    <div className="min-h-[70vh] grid place-items-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="w-full max-w-sm text-center"
      >
        <div className="relative mx-auto h-28 w-28">
          <div className="absolute inset-0 rounded-[2rem] bg-primary/15 blur-xl" />
          <div className="relative h-28 w-28 grid place-items-center rounded-[2rem] border border-border bg-card shadow-card">
            {icon ?? <ShoppingCart className="h-12 w-12 text-primary" strokeWidth={1.75} />}
          </div>
        </div>

        <h1 className="font-display text-2xl font-extrabold mt-6">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>

        <div className="mt-7 space-y-3">
          <Link
            to="/login"
            search={{ next } as never}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl gradient-primary font-bold text-primary-foreground shadow-glow"
          >
            <LogIn className="h-4 w-4" /> Sign In
          </Link>
          <Link
            to="/signup"
            search={{ next } as never}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-card font-bold text-foreground"
          >
            <UserPlus className="h-4 w-4" /> Create Account
          </Link>
        </div>

        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground transition"
        >
          Continue browsing products <ArrowRight className="h-4 w-4" />
        </Link>
      </motion.div>
    </div>
  );
}
