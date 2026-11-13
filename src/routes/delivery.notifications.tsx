import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { PageHeader, Panel, EmptyState } from "@/components/data";

export const Route = createFileRoute("/delivery/notifications")({
  component: () => (
    <div className="space-y-5 px-4 py-4 md:px-6">
      <PageHeader title="Notifications" />
      <Panel>
        <EmptyState icon={<Bell />} title="You're all caught up" description="No new alerts right now." />
      </Panel>
    </div>
  ),
});
