import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { User, LogOut, Shield, Search } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "./Logo";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export function Header() {
  const { user, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [query, setQuery] = useState("");

  const hideSearch = pathname.startsWith("/orders") || pathname.startsWith("/account");

  return (
    <>
      <header className="glass border-b border-border">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 md:gap-6">
          <Link to="/" className="shrink-0 flex items-center" aria-label="AP Mart Home">
            <Logo />
          </Link>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-xl">
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate({ to: "/orders" })}>
                    My Orders
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate({ to: "/account" })}>
                    Account & Addresses
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem onClick={() => navigate({ to: "/admin" })}>
                      <Shield className="h-4 w-4 mr-2" /> Admin Dashboard
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut()}>
                    <LogOut className="h-4 w-4 mr-2" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link to="/login">
                <Button className="rounded-xl bg-foreground text-background hover:bg-foreground/90 font-bold shadow-card">
                  <User className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">Login</span>
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {!hideSearch && (
        <div className="md:hidden sticky top-0 z-40 px-4 py-2 bg-background/95 backdrop-blur border-b border-border">
          <div className="flex items-center gap-2 rounded-xl bg-card border border-border px-3 py-2.5">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Search for products..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && query.trim()) {
                  navigate({ to: "/products", search: { q: query.trim() } });
                }
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
