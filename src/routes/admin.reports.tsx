import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { EmptyState, PageContainer, PageHeader, Panel } from "@/components/admin/ui";

export const Route = createFileRoute("/admin/reports")({
  component: () => (
    <PageContainer>
      <PageHeader title="Reports" subtitle="Sales and operations reports" />
      <Panel>
        <EmptyState icon={<BarChart3 />} title="Coming soon" description="Detailed reports are on the way." />
      </Panel>
    </PageContainer>
  ),
});
