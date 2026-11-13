import { createFileRoute } from "@tanstack/react-router";
import { ProfileScreen } from "@/components/customer/ProfileScreen";

export const Route = createFileRoute("/customer/profile")({
  head: () => ({ meta: [{ title: "Account — AP Mart" }] }),
  component: () => <ProfileScreen next="/customer/profile" />,
});
