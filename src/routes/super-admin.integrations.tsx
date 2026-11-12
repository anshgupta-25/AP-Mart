import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, XCircle, Loader2, KeyRound, ShieldAlert } from "lucide-react";
import { getIntegrationStatus } from "@/lib/superadmin.functions";

export const Route = createFileRoute("/super-admin/integrations")({
  head: () => ({
    meta: [
      { title: "API Keys & Integrations — AP Mart" },
      { name: "description", content: "Configuration status for payments, maps, messaging and AI integrations." },
      { property: "og:title", content: "API Keys & Integrations — AP Mart" },
      { property: "og:description", content: "Integration credential status for AP Mart." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IntegrationsPage,
});

const SECTIONS: Array<{ key: string; title: string; note: string }> = [
  { key: "payments", title: "Payments — Razorpay", note: "Key ID, secret and webhook signing secret." },
  { key: "maps", title: "Google Maps Platform", note: "Server key for routing/ETA, browser key for maps." },
  { key: "messaging", title: "Notifications — Push, WhatsApp, SMS, Email", note: "Firebase Cloud Messaging, WhatsApp, SMS and email providers." },
  { key: "ai", title: "AI provider", note: "Powers AI search and support drafts." },
  { key: "bootstrap", title: "Super Admin provisioning", note: "Credentials used once to create the platform owner." },
];

function IntegrationsPage() {
  const fetchStatus = useServerFn(getIntegrationStatus);
  const { data, isLoading, error } = useQuery({
    queryKey: ["super-admin", "integration-status"],
    queryFn: () => fetchStatus({ data: undefined as any }),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold">API keys &amp; integrations</h1>
        <p className="text-sm text-muted-foreground">
          Live credential values are never readable from the app — only whether each one is configured.
        </p>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm">
          Could not load integration status.
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {SECTIONS.map((s) => {
            const items = ((data as any)?.[s.key] ?? []) as Array<{ name: string; configured: boolean }>;
            return (
              <section key={s.key} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <h2 className="flex items-center gap-2 font-display text-sm font-extrabold">
                  <KeyRound className="h-4 w-4 text-emerald-600" />
                  {s.title}
                </h2>
                <p className="mt-1 text-[11px] text-muted-foreground">{s.note}</p>
                <ul className="mt-3 space-y-2">
                  {items.map((i) => (
                    <li key={i.name} className="flex items-center justify-between gap-3 text-xs">
                      <code className="font-mono">{i.name}</code>
                      {i.configured ? (
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Configured
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-bold text-muted-foreground">
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

      <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-5">
        <div className="flex items-center gap-2 text-sm font-bold">
          <ShieldAlert className="h-4 w-4 text-muted-foreground" /> How to change a credential
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Keys are stored as encrypted backend secrets and injected into server code at request time. They are rotated from
          your project's secret settings — no screen in this app can display or export a live key.
        </p>
      </div>
    </div>
  );
}
