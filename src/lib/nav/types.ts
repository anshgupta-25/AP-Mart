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

/**
 * Does `to` match the current location? Items with a query string
 * (e.g. "/admin/products?filter=low-stock") also need those params in `search`.
 */
export function isNavActive(pathname: string, to: string, search = "") {
  const [base, qs] = to.split("?");
  if (!(pathname === base || pathname.startsWith(base + "/"))) return false;
  if (!qs) return true;
  const current = new URLSearchParams(search);
  return [...new URLSearchParams(qs)].every(([k, v]) => current.get(k) === v);
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

const queryParamCount = (to: string) => [...new URLSearchParams(to.split("?")[1] ?? "")].length;

/** The single best match: longest matching path, then most matching query params. */
export function currentNavItem(nav: PortalNav, pathname: string, search = ""): NavItem | undefined {
  return allNavItems(nav)
    .filter((i) => isNavActive(pathname, i.to, search))
    .sort(
      (a, b) =>
        b.to.split("?")[0].length - a.to.split("?")[0].length ||
        queryParamCount(b.to) - queryParamCount(a.to),
    )[0];
}
