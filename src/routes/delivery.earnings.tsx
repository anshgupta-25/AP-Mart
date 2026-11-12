import { createFileRoute } from "@tanstack/react-router";
import { RoleShell } from "@/components/RoleShell";
import { DELIVERY_NAV } from "./delivery.dashboard";
export const Route = createFileRoute("/delivery/earnings")({ component: () => <RoleShell role="delivery" nav={DELIVERY_NAV} requireRoles={["delivery", "admin"]}><div className="p-6"><h1 className="font-display text-2xl font-bold">Earnings</h1><p className="text-muted-foreground mt-2">Coming soon.</p></div></RoleShell> });
