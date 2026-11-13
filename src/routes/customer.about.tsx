import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Info, Mail, Check, Cpu } from "lucide-react";
import { LogoMark } from "@/components/Logo";

export const Route = createFileRoute("/customer/about")({
  head: () => ({
    meta: [
      { title: "About AP Mart — Hyperlocal commerce platform" },
      {
        name: "description",
        content:
          "AP Mart is an agentic AI-powered hyperlocal commerce platform connecting customers, local shops and delivery partners.",
      },
      { property: "og:title", content: "About AP Mart" },
      {
        property: "og:description",
        content: "Your local shops, products and delivery — connected in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AboutPage,
});

const FEATURES = [
  "Hyperlocal product discovery",
  "Multiple local shops",
  "Product and inventory management",
  "Order management",
  "Delivery coordination",
  "Intelligent shop routing",
  "AI-powered customer assistance",
  "AI-powered business automation",
  "Real-time order updates",
  "Shopkeeper dashboard",
  "Delivery partner dashboard",
  "Admin management",
];

const TECH = [
  "React",
  "TypeScript",
  "Tailwind CSS",
  "Supabase",
  "PostgreSQL",
  "Supabase Authentication",
  "Supabase Storage",
];

function AboutPage() {
  const router = useRouter();

  return (
    <div className="space-y-4 px-4 pb-8 pt-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.history.back()}
          aria-label="Go back"
          className="press grid h-9 w-9 place-items-center rounded-full bg-secondary"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="large-title truncate">About</h1>
      </div>

      <div className="space-y-3 rounded-xl bg-tint-mint p-5 text-center">
        <LogoMark size="xs" className="mx-auto h-12 w-12 rounded-xl" />
        <div className="text-subtitle font-bold tracking-tight">
          AP <span className="text-primary">Mart</span>
        </div>
        <p className="text-meta text-foreground/70">
          “Your local shops, products and delivery — connected in one place.”
        </p>
      </div>

      <section className="rounded-xl border border-border/70 bg-card p-4">
        <h2 className="section-title mb-2 flex items-center gap-2">
          <Info className="h-4 w-4 text-primary" /> What is AP Mart
        </h2>
        <p className="text-meta leading-relaxed text-muted-foreground">
          AP Mart is an agentic AI-powered hyperlocal commerce platform connecting customers, local
          shops and delivery partners. It helps customers discover products from nearby shops, place
          orders and receive deliveries efficiently while providing local businesses with digital
          tools to manage products, inventory and orders.
        </p>
      </section>

      <section className="rounded-xl border border-border/70 bg-card p-4">
        <h2 className="section-title mb-3">Features</h2>
        <ul className="grid gap-2.5">
          {FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2 text-meta">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-ink">
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-border/70 bg-card p-4">
        <h2 className="section-title mb-3 flex items-center gap-2">
          <Cpu className="h-4 w-4 text-primary" /> Technology
        </h2>
        <div className="flex flex-wrap gap-2">
          {TECH.map((t) => (
            <span
              key={t}
              className="rounded-full bg-secondary px-2.5 py-1 text-caption font-medium"
            >
              {t}
            </span>
          ))}
        </div>
      </section>

      <section className="space-y-1 rounded-xl border border-border/70 bg-card p-4">
        <h2 className="section-title">Version</h2>
        <p className="text-meta font-semibold">AP Mart</p>
        <p className="text-meta text-muted-foreground">Version 1.0.0</p>
      </section>

      <section className="rounded-xl border border-border/70 bg-card p-4">
        <h2 className="section-title mb-2">Contact</h2>
        <a
          href="mailto:eshanthakur02@gmail.com"
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary-soft px-4 text-meta font-semibold text-primary-ink"
        >
          <Mail className="h-4 w-4" /> eshanthakur02@gmail.com
        </a>
      </section>

      <div className="text-center text-caption text-muted-foreground pt-2">
        © 2026 AP Mart. All rights reserved.
      </div>
    </div>
  );
}
