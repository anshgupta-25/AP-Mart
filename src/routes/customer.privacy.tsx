import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck, Mail } from "lucide-react";

export const Route = createFileRoute("/customer/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — AP Mart" },
      {
        name: "description",
        content:
          "How AP Mart collects, uses, shares and protects your information across shopping, delivery and AI features.",
      },
      { property: "og:title", content: "Privacy Policy — AP Mart" },
      {
        property: "og:description",
        content: "How AP Mart collects, uses and protects your information.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "Information we collect",
    body: [
      "Account details you provide such as your name, email address, phone number, state, city and PIN code.",
      "Delivery addresses, order history, cart contents, wishlist items and support conversations.",
      "Device and usage information such as app version, approximate location and basic diagnostics needed to keep the service working.",
    ],
  },
  {
    title: "How we use information",
    body: [
      "To create and secure your account, show nearby shops and products, and process your orders.",
      "To route orders to the most suitable local shop and coordinate delivery partners.",
      "To send order updates, notifications and respond to your support requests.",
      "To detect fraud, prevent abuse and improve the reliability of the platform.",
    ],
  },
  {
    title: "AI features",
    body: [
      "AP Mart uses AI-assisted features for shopping assistance, product discovery and business automation.",
      "Only the information needed for the requested feature (for example your query or order context) is processed. AI features are not used to make decisions about you without a human-reviewable outcome, and your data is not sold to train third-party models.",
    ],
  },
  {
    title: "Location information",
    body: [
      "With your permission we use your device location or saved address to find shops that deliver to you, estimate delivery time and fees, and help delivery partners reach you.",
      "You can turn off device location at any time and continue using saved addresses instead.",
    ],
  },
  {
    title: "Payments",
    body: [
      "Payments are processed by our payment provider. AP Mart does not store your full card, UPI or bank credentials.",
      "We retain only payment status, reference identifiers and amounts required for order records, refunds and accounting.",
    ],
  },
  {
    title: "Information sharing",
    body: [
      "Shops receive the order details needed to prepare your order. Delivery partners receive your delivery address and contact details needed to complete delivery.",
      "Service providers (hosting, database, notifications, maps, payments, AI processing) handle data on our behalf under contract.",
      "We may disclose information where required by law or to protect the rights and safety of users.",
      "We do not sell your personal information.",
    ],
  },
  {
    title: "Data security",
    body: [
      "Data is stored on managed infrastructure with encryption in transit, authenticated access and row-level access rules so users can only reach their own records.",
      "No system is perfectly secure, so please use a strong password and keep your account credentials private.",
    ],
  },
  {
    title: "Data retention",
    body: [
      "Account and order records are kept while your account is active and afterwards only as long as needed for legal, tax and dispute-resolution purposes.",
      "Notifications and diagnostic logs are purged automatically after a short retention window.",
    ],
  },
  {
    title: "Account deletion",
    body: [
      "You can delete your account from Profile → Danger zone. Deletion is blocked while you have an active order in progress.",
      "On deletion, your personal profile data, addresses, cart and wishlist are removed, and historical order records are anonymised where they must be retained for accounting.",
    ],
  },
  {
    title: "User rights and choices",
    body: [
      "You can access and update your profile details, manage saved addresses, control notification permissions and request a copy or correction of your data.",
      "To exercise any of these rights, contact us using the email below.",
    ],
  },
  {
    title: "Children",
    body: [
      "AP Mart is not intended for children under 13 (or the minimum age required in your region). We do not knowingly collect data from children. If you believe a child has created an account, contact us and we will remove it.",
    ],
  },
  {
    title: "Changes to this policy",
    body: [
      "We may update this policy as the service evolves. Material changes will be highlighted in the app, and the 'Last updated' date above will always reflect the current version.",
    ],
  },
];

function PrivacyPage() {
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
        <div className="min-w-0">
          <h1 className="font-display text-xl font-extrabold truncate">Privacy Policy</h1>
          <p className="text-[11px] text-muted-foreground">Last updated: 24 August 2026</p>
        </div>
      </div>

      <div className="rounded-3xl gradient-hero border border-border p-5 shadow-card flex items-center gap-4">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-primary">
          <ShieldCheck className="h-6 w-6" />
        </span>
        <p className="text-sm text-muted-foreground">
          Your privacy matters. This page explains what AP Mart collects, why we need it, and the
          control you have over it.
        </p>
      </div>

      {SECTIONS.map((s) => (
        <section key={s.title} className="rounded-3xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-display text-base font-bold mb-2">{s.title}</h2>
          <div className="space-y-2">
            {s.body.map((p, i) => (
              <p key={i} className="text-sm leading-relaxed text-muted-foreground">
                {p}
              </p>
            ))}
          </div>
        </section>
      ))}

      <section className="rounded-3xl border border-border bg-card p-5 shadow-card">
        <h2 className="font-display text-base font-bold mb-2">Contact</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Questions about privacy or your data? Reach our team any time.
        </p>
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
