import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Search, Shield, User } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "./ui/button";
import { LogoMark } from "@/components/Logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

type Props = {
  homeTo: string;
  accountTo: string;
  searchTo?: string;
  showSearch?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
};

export function RoleHeader({
  homeTo,
  accountTo,
  searchTo = "/products",
  showSearch = true,
  leading,
  trailing,
}: Props) {
  const [q, setQ] = useState("");
  const nav = useNavigate();
  const { user, signOut, isAdmin } = useAuth();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = q.trim();
    if (query) nav({ to: searchTo, search: { q: query } });
  };

  return (
    <header className="bg-tint-mint hairline-b sticky top-0 z-40 pt-safe">
      <div className="flex items-center gap-3 px-4 py-3">
        {leading}
        <Link to={homeTo} className="flex items-center gap-2 font-display font-bold text-subtitle">
          <LogoMark size="sm" className="h-8 w-8 rounded-full" />
          <span>
            AP <span className="text-primary">Mart</span>
          </span>
        </Link>
        <div className="flex-1" />
        {trailing}
        <Link
          to={accountTo}
          aria-label="Account"
          className="press grid h-9 w-9 place-items-center rounded-full bg-secondary"
        >
          <User className="h-5 w-5" />
        </Link>
      </div>

      {showSearch && (
        <form onSubmit={onSubmit} className="px-3 pb-3">
          <div className="flex items-center gap-2 rounded-xl bg-card px-3.5 py-2.5 shadow-soft">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search for products..."
              className="bg-transparent text-sm outline-none placeholder:text-muted-foreground w-full"
            />
          </div>
        </form>
      )}
    </header>
  );
}
