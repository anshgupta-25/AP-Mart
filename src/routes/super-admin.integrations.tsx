import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, XCircle, Loader2, KeyRound, ShieldAlert } from "lucide-react";
import { getIntegrationStatus } from "@/lib/superadmin.functions";

export const Route = createFileRoute("/super-admin/integrations")({
  head: () => ({
    meta: [
      { title: "API Keys & Integrations — AP Mart" },
      {
        name: "description",
        content: "Configuration status for payments, maps, messaging and AI integrations.",
      },
      { property: "og:title", content: "API Keys & Integrations — AP Mart" },
      { property: "og:description", content: "Integration credential status for AP Mart." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IntegrationsPage,
});

const SECTIONS: Array<{ key: string; title: string; note: string }> = [
  {
    key: "payments",
    title: "Payments — Razorpay",
    note: "Key ID, secret and webhook signing secret.",
  },
  {
    key: "maps",
    title: "Google Maps Platform",
    note: "Server key for routing/ETA, browser key for maps.",
  },
  {
    key: "messaging",
    title: "Notifications — Push, WhatsApp, SMS, Email",
    note: "Firebase Cloud Messaging, WhatsApp, SMS and email providers.",
  },
  {
    key: "bootstrap",
    title: "Super Admin provisioning",
    note: "Credentials used once to create the platform owner.",
  },
];

function IntegrationsPage() {
  const fetchStatus = useServerFn(getIntegrationStatus);
  const { data, isLoading, error } = useQuery({
    queryKey: ["super-admin", "integration-status"],
    queryFn: () => fetchStatus({ data: undefined }),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="large-title">API keys &amp; integrations</h1>
        <p className="mt-0.5 text-small text-muted-foreground">
          Live credential values are never readable from the app — only whether each one is
          configured.
        </p>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-small">
          Could not load integration status.
        </div>
      ) : (
        <div className="grid gap-2.5 md:gap-4 lg:grid-cols-2">
          {SECTIONS.map((s) => {
            const items = ((data as any)?.[s.key] ?? []) as Array<{
              name: string;
              configured: boolean;
            }>;
            return (
              <section key={s.key} className="rounded-xl border border-border/70 bg-card p-4">
                <h2 className="flex items-center gap-2.5 text-body font-semibold">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-tint-mint text-primary-ink">
                    <KeyRound className="h-4 w-4" />
                  </span>
                  {s.title}
                </h2>
                <p className="mt-1.5 text-small text-muted-foreground">{s.note}</p>
                <ul className="mt-3 divide-y divide-border/60">
                  {items.map((i) => (
                    <li
                      key={i.name}
                      className="flex items-center justify-between gap-3 py-2.5 text-small"
                    >
                      <code className="min-w-0 truncate font-mono">{i.name}</code>
                      {i.configured ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-caption font-semibold text-primary-ink">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Configured
                        </span>
                      ) : (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-caption font-semibold text-muted-foreground">
                          <XCircle className="h-3.5 w-3.5" /> Not set
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <div className="rounded-xl border border-dashed border-border bg-secondary/50 p-4">
        <div className="flex items-center gap-2 text-body font-semibold">
          <ShieldAlert className="h-4 w-4 text-muted-foreground" /> How to change a credential
        </div>
        <p className="mt-1 text-small leading-relaxed text-muted-foreground">
          Keys are stored as encrypted backend secrets and injected into server code at request
          time. They are rotated from your project's secret settings — no screen in this app can
          display or export a live key.
        </p>
      </div>
    </div>
  );
}
