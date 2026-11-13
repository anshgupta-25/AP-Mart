import { createFileRoute } from "@tanstack/react-router";
import { Wallet } from "lucide-react";
import { PageHeader, Panel, EmptyState } from "@/components/data";

export const Route = createFileRoute("/delivery/earnings")({
  component: () => (
    <div className="space-y-5 px-4 py-4 md:px-6">
      <PageHeader title="Earnings" />
      <Panel>
        <EmptyState icon={<Wallet />} title="Coming soon" description="Your payouts and earnings will appear here." />
      </Panel>
    </div>
  ),
});
