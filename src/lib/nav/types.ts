import type { LucideIcon } from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Key into the `badges` prop of AppShell (e.g. "cart"). */
  badge?: string;
}
export interface NavGroup {
  label: string;
  items: NavItem[];
}
export interface PortalNav {
  /** Bottom tabs on mobile (max 4 when `more` is set, otherwise max 5). */
  tabs: NavItem[];
  /** Everything else, shown in the "More" sheet and the desktop sidebar. */
  more?: NavGroup[];
  /** Explicit desktop sidebar groups; defaults to tabs + more. */
  sidebar?: NavGroup[];
}

export function isNavActive(pathname: string, to: string) {
  const base = to.split("?")[0];
  return pathname === base || pathname.startsWith(base + "/");
}

export function allNavItems(nav: PortalNav): NavItem[] {
  const seen = new Set<string>();
  const out: NavItem[] = [];
  for (const i of [...nav.tabs, ...(nav.more ?? []).flatMap((g) => g.items)]) {
    if (seen.has(i.to)) continue;
    seen.add(i.to);
    out.push(i);
  }
  return out;
}

export function sidebarGroups(nav: PortalNav): NavGroup[] {
  if (nav.sidebar) return nav.sidebar;
  return [{ label: "", items: nav.tabs }, ...(nav.more ?? [])];
}

/** Best match for the current path (longest matching prefix). */
export function currentNavItem(nav: PortalNav, pathname: string): NavItem | undefined {
  return allNavItems(nav)
    .filter((i) => isNavActive(pathname, i.to))
    .sort((a, b) => b.to.length - a.to.length)[0];
}
