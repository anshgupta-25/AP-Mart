import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/**
 * Razorpay webhook — server-to-server payment truth.
 *
 * Why this exists: the browser-side verify call can be lost (tab closed, network
 * drop, app crash) after the customer has actually paid. Razorpay retries this
 * endpoint, so the order is reconciled regardless of what the browser did.
 *
 * Security: every request must carry a valid X-Razorpay-Signature, which is an
 * HMAC-SHA256 of the RAW request body using RAZORPAY_WEBHOOK_SECRET. Nothing is
 * written to the database before that check passes.
 */

const eventSchema = z.object({
  event: z.string().min(1),
  payload: z
    .object({
      payment: z
        .object({
          entity: z
            .object({
              id: z.string().optional(),
              order_id: z.string().optional(),
              method: z.string().nullish(),
              amount: z.number().optional(),
              error_code: z.string().nullish(),
              error_description: z.string().nullish(),
              notes: z.record(z.string(), z.any()).optional(),
            })
            .partial(),
        })
        .optional(),
      refund: z
        .object({
          entity: z
            .object({
              id: z.string().optional(),
              payment_id: z.string().optional(),
              amount: z.number().optional(),
            })
            .partial(),
        })
        .optional(),
    })
    .default({}),
});

function verifySignature(rawBody: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(request: Request): Promise<Response> {
  const secret = process.env["RAZORPAY_WEBHOOK_SECRET"];
  if (!secret) {
    console.error("[razorpay-webhook] RAZORPAY_WEBHOOK_SECRET is not configured");
    return new Response("Not configured", { status: 503 });
  }

  const rawBody = await request.text();
  if (!verifySignature(rawBody, request.headers.get("x-razorpay-signature"), secret)) {
    console.warn("[razorpay-webhook] rejected request with invalid signature");
    return new Response("Invalid signature", { status: 401 });
  }

  let parsed: z.infer<typeof eventSchema>;
  try {
    parsed = eventSchema.parse(JSON.parse(rawBody));
  } catch (e) {
    console.error("[razorpay-webhook] unparseable payload", e);
    return new Response("Bad payload", { status: 400 });
  }

  // Verified caller only past this point.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { event, payload } = parsed;
  const payment = payload.payment?.entity;
  const refund = payload.refund?.entity;

  console.log(`[razorpay-webhook] ${event}`, {
    razorpay_order_id: payment?.order_id,
    razorpay_payment_id: payment?.id ?? refund?.payment_id,
  });

  try {
    if (event === "payment.captured" || event === "order.paid") {
      const providerOrderId = payment?.order_id;
      if (!providerOrderId) return new Response("ok");

      const { data: row } = await supabaseAdmin
        .from("payments")
        .select("id, order_id, user_id, status")
        .eq("provider_order_id", providerOrderId)
        .maybeSingle();
      if (!row) {
        console.warn("[razorpay-webhook] no payment row for", providerOrderId);
        return new Response("ok");
      }
      if (row.status === "paid") return new Response("ok"); // idempotent replay

      await supabaseAdmin
        .from("payments")
        .update({
          status: "paid",
          provider_payment_id: payment?.id ?? null,
          method: payment?.method ?? null,
          error_code: null,
          error_description: null,
        })
        .eq("id", row.id);

      await supabaseAdmin
        .from("orders")
        .update({ payment_status: "paid", paid_at: new Date().toISOString() })
        .eq("id", row.order_id)
        .neq("payment_status", "paid");

      if (row.user_id) {
        await supabaseAdmin.from("notifications").insert({
          user_id: row.user_id,
          title: "Payment successful",
          body: "Your payment was received. Your order is being processed.",
          category: "payment",
          data: { order_id: row.order_id },
        });
      }
      return new Response("ok");
    }

    if (event === "payment.failed") {
      const providerOrderId = payment?.order_id;
      if (!providerOrderId) return new Response("ok");

      const { data: row } = await supabaseAdmin
        .from("payments")
        .select("id, order_id, user_id, status")
        .eq("provider_order_id", providerOrderId)
        .maybeSingle();
      if (!row || row.status === "paid") return new Response("ok");

      await supabaseAdmin
        .from("payments")
        .update({
          status: "failed",
          provider_payment_id: payment?.id ?? null,
          error_code: payment?.error_code ?? "PAYMENT_FAILED",
          error_description: payment?.error_description ?? "Payment was not completed",
        })
        .eq("id", row.id);

      if (row.user_id) {
        await supabaseAdmin.from("notifications").insert({
          user_id: row.user_id,
          title: "Payment failed",
          body: payment?.error_description ?? "Your payment did not go through.",
          category: "payment",
          data: { order_id: row.order_id },
        });
      }
      return new Response("ok");
    }

    if (event === "refund.processed" || event === "refund.created") {
      const paymentId = refund?.payment_id;
      if (!paymentId || !refund?.id) return new Response("ok");

      const { data: row } = await supabaseAdmin
        .from("payments")
        .select("id, refund_id")
        .eq("provider_payment_id", paymentId)
        .maybeSingle();
      if (!row || row.refund_id === refund.id) return new Response("ok");

      const { error } = await supabaseAdmin.rpc("admin_record_refund", {
        _payment_id: row.id,
        _refund_id: refund.id,
        _amount: (refund.amount ?? 0) / 100,
      });
      if (error) console.error("[razorpay-webhook] admin_record_refund failed", error);
      return new Response("ok");
    }

    // Unhandled but valid event — acknowledge so Razorpay stops retrying.
    return new Response("ok");
  } catch (e) {
    console.error("[razorpay-webhook] handler error", e);
    // 500 makes Razorpay retry with backoff.
    return new Response("Handler error", { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/razorpay-webhook")({
  server: {
    handlers: {
      POST: ({ request }) => handle(request),
    },
  },
});
