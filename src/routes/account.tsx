import { createFileRoute } from "@tanstack/react-router";
import { ProfileScreen } from "@/components/customer/ProfileScreen";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "My account — AP Mart" }] }),
  component: () => <ProfileScreen next="/account" />,
});
