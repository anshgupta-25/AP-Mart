import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Ellipsis } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/Logo";
import { allNavItems, currentNavItem, sidebarGroups, type NavItem, type PortalNav } from "@/lib/nav/types";
import { MoreSheet } from "./MoreSheet";

function NavLink({ item, className, children }: { item: NavItem; className: string; children: ReactNode }) {
  const [path, qs] = item.to.split("?");
  const search = qs ? Object.fromEntries(new URLSearchParams(qs)) : undefined;
  return (
    <Link to={path as any} search={search as any} className={className}>
      {children}
    </Link>
  );
}

/**
 * One shell for every staff portal: compact top bar, bottom tabs (+ "More" sheet) on phones,
 * sidebar from md. Role gating stays in each portal's route file.
 */
export function AppShell({
  nav,
  trailing,
  title,
  badges,
  maxWidth = "max-w-7xl",
  children,
}: {
  nav: PortalNav;
  trailing?: ReactNode;
  /** Overrides the title derived from the current route. */
  title?: string;
  badges?: Record<string, number>;
  maxWidth?: string;
  children?: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const [moreOpen, setMoreOpen] = useState(false);
  // Highlight exactly one item: the best match for the current path + query.
  const current = currentNavItem(nav, pathname, searchStr);
  const hasMore = !!nav.more?.length;
  const moreActive = hasMore && !!current && !nav.tabs.some((t) => t.to === current.to);
  const groups = sidebarGroups(nav);

  return (
    <div className="min-h-screen bg-background">
      <header className="hairline-b sticky top-0 z-40 bg-tint-mint pt-safe">
        <div className="mx-auto flex h-14 w-full items-center gap-3 px-4 md:px-6">
          <LogoMark size="xs" className="h-8 w-8 rounded-full" />
          <div className="min-w-0 flex-1 truncate text-subtitle font-semibold tracking-tight">{title ?? current?.label ?? "AP Mart"}</div>
          {trailing}
        </div>
      </header>

      <div className="flex">
        <aside className="hidden w-60 shrink-0 border-r border-border bg-card md:block">
          <nav className="sticky top-14 max-h-[calc(100dvh-3.5rem)] space-y-4 overflow-y-auto p-3">
            {groups.map((g) => (
              <div key={g.label || "main"}>
                {g.label && <div className="eyebrow px-3 pb-1">{g.label}</div>}
                <div className="space-y-0.5">
                  {g.items.map((i) => {
                    const Icon = i.icon;
                    const active = current?.to === i.to;
                    return (
                      <NavLink
                        key={i.to}
                        item={i}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2 text-body font-medium transition-colors",
                          active ? "bg-primary-soft font-semibold text-primary-ink" : "text-foreground/75 hover:bg-secondary",
                        )}
                      >
                        <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                        {i.label}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <main className={cn("mx-auto w-full min-w-0 flex-1 pb-24 md:pb-10", maxWidth)}>{children ?? <Outlet />}</main>
      </div>

      <nav className="bar-blur hairline-t fixed inset-x-0 bottom-0 z-30 pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="mx-auto flex max-w-2xl">
          {nav.tabs.map((t) => {
            const Icon = t.icon;
            const active = current?.to === t.to;
            const count = t.badge ? badges?.[t.badge] ?? 0 : 0;
            return (
              <NavLink
                key={t.to}
                item={t}
                className={cn(
                  "press relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 pb-1.5 pt-2 text-micro font-semibold transition-colors",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {active && <span className="absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-primary" />}
                <span className="relative">
                  <Icon className={cn("h-[22px] w-[22px]", active ? "text-primary" : "")} strokeWidth={active ? 2.2 : 1.7} />
                  {count > 0 && (
                    <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-micro font-bold text-primary-foreground">
                      {count}
                    </span>
                  )}
                </span>
                <span className="max-w-full truncate px-1">{t.label}</span>
              </NavLink>
            );
          })}
          {hasMore && (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className={cn(
                "press relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 pb-1.5 pt-2 text-micro font-semibold",
                moreActive ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {moreActive && <span className="absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-primary" />}
              <Ellipsis className={cn("h-[22px] w-[22px]", moreActive && "text-primary")} strokeWidth={moreActive ? 2.2 : 1.7} />
              <span>More</span>
            </button>
          )}
        </div>
      </nav>

      {hasMore && <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} groups={nav.more!} activeTo={current?.to} />}
    </div>
  );
}

export { allNavItems };
