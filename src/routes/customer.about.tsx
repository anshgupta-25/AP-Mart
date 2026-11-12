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
    <div className="px-4 py-4 space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.history.back()}
          aria-label="Go back"
          className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-card shadow-card"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-xl font-extrabold truncate">About AP Mart</h1>
      </div>

      <div className="rounded-3xl gradient-hero border border-border p-5 shadow-card text-center space-y-3">
        <LogoMark size="xs" className="mx-auto h-16 w-16 rounded-2xl" />
        <div className="font-display text-2xl font-extrabold">
          AP <span className="text-primary">Mart</span>
        </div>
        <p className="text-sm font-semibold text-muted-foreground">
          “Your local shops, products and delivery — connected in one place.”
        </p>
      </div>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-card">
        <h2 className="font-display text-base font-bold mb-2 flex items-center gap-2">
          <Info className="h-4 w-4 text-primary" /> What is AP Mart
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          AP Mart is an agentic AI-powered hyperlocal commerce platform connecting customers, local
          shops and delivery partners. It helps customers discover products from nearby shops, place
          orders and receive deliveries efficiently while providing local businesses with digital
          tools to manage products, inventory and orders.
        </p>
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-card">
        <h2 className="font-display text-base font-bold mb-3">Features</h2>
        <ul className="grid gap-2">
          {FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              <span className="font-medium">{f}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-card">
        <h2 className="font-display text-base font-bold mb-3 flex items-center gap-2">
          <Cpu className="h-4 w-4 text-primary" /> Technology
        </h2>
        <div className="flex flex-wrap gap-2">
          {TECH.map((t) => (
            <span
              key={t}
              className="rounded-full border border-border bg-secondary px-3 py-1 text-xs font-semibold"
            >
              {t}
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-card space-y-1">
        <h2 className="font-display text-base font-bold">Version</h2>
        <p className="text-sm font-semibold">AP Mart</p>
        <p className="text-sm text-muted-foreground">Version 1.0.0</p>
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-card">
        <h2 className="font-display text-base font-bold mb-2">Contact</h2>
        <a
          href="mailto:eshanthakur02@gmail.com"
          className="inline-flex items-center gap-2 rounded-xl bg-primary/10 px-3.5 py-2.5 font-bold text-sm text-primary"
        >
          <Mail className="h-4 w-4" /> eshanthakur02@gmail.com
        </a>
      </section>

      <div className="text-center text-[11px] text-muted-foreground pt-2">
        © 2026 AP Mart. All rights reserved.
      </div>
    </div>
  );
}
