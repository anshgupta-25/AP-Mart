import { createFileRoute } from "@tanstack/react-router";
import { FcmDiagnostics } from "@/components/FcmDiagnostics";

export const Route = createFileRoute("/admin/notifications")({
  component: () => (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-4 md:px-6 md:py-6">
      <div>
        <h1 className="large-title">Notifications</h1>
        <p className="mt-0.5 text-meta text-muted-foreground">Verify push delivery and inspect Firebase Cloud Messaging state.</p>
      </div>
      <FcmDiagnostics />
    </div>
  ),
});
