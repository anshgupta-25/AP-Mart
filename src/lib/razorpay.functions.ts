import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHmac, timingSafeEqual } from "node:crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const RAZORPAY_API = "https://api.razorpay.com/v1";

function basicAuth() {
  const id = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!id || !secret) throw new Error("Razorpay keys not configured");
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

/**
 * Create a Razorpay order for an existing internal order.
 * Returns { keyId, razorpayOrderId, amount, currency } to open Checkout.
 */
export const createRazorpayOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ orderId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Validate order belongs to user
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, total, order_number, payment_status, payment_method")
      .eq("id", data.orderId)
      .single();
    if (error || !order) throw new Error("Order not found");
    if (order.user_id !== userId) throw new Error("Forbidden");
    if (order.payment_status === "paid") throw new Error("Order already paid");

    const amountPaise = Math.round(Number(order.total) * 100);

    const res = await fetch(`${RAZORPAY_API}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: basicAuth() },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt: order.order_number,
        notes: { order_id: order.id, user_id: userId },
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      throw new Error(body?.error?.description || "Failed to create Razorpay order");
    }

    // Record pending payment row
    await supabaseAdmin.from("payments").insert({
      order_id: order.id,
      user_id: userId,
      provider: "razorpay",
      provider_order_id: body.id,
      amount: order.total,
      status: "pending",
    });

    return {
      keyId: process.env.RAZORPAY_KEY_ID!,
      razorpayOrderId: body.id as string,
      amount: amountPaise,
      currency: "INR",
      orderNumber: order.order_number,
    };
  });

/**
 * Verify Razorpay payment signature and mark order paid.
 */
export const verifyRazorpayPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      orderId: z.string().uuid(),
      razorpayOrderId: z.string().min(1),
      razorpayPaymentId: z.string().min(1),
      razorpaySignature: z.string().min(1),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) throw new Error("Razorpay not configured");

    // HMAC-SHA256(order_id|payment_id, secret)
    const expected = createHmac("sha256", secret)
      .update(`${data.razorpayOrderId}|${data.razorpayPaymentId}`)
      .digest("hex");

    const a = Buffer.from(expected);
    const b = Buffer.from(data.razorpaySignature);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      await supabaseAdmin
        .from("payments")
        .update({
          status: "failed",
          provider_payment_id: data.razorpayPaymentId,
          signature: data.razorpaySignature,
          error_code: "SIGNATURE_MISMATCH",
          error_description: "Signature verification failed",
        })
        .eq("provider_order_id", data.razorpayOrderId);
      await supabaseAdmin.from("notifications").insert({
        user_id: userId, title: "Payment failed",
        body: "We couldn't verify your payment. Please try again.",
        category: "payment",
      });
      throw new Error("Signature verification failed");
    }

    // Fetch payment details from Razorpay to capture method
    let method: string | null = null;
    try {
      const r = await fetch(`${RAZORPAY_API}/payments/${data.razorpayPaymentId}`, {
        headers: { Authorization: basicAuth() },
      });
      const d = await r.json();
      if (r.ok) method = d.method ?? null;
    } catch {}

    // Update payments row
    const { error: payErr } = await supabaseAdmin
      .from("payments")
      .update({
        status: "paid",
        provider_payment_id: data.razorpayPaymentId,
        signature: data.razorpaySignature,
        method,
      })
      .eq("provider_order_id", data.razorpayOrderId)
      .eq("user_id", userId);
    if (payErr) throw new Error(payErr.message);

    // Mark order paid
    await supabaseAdmin
      .from("orders")
      .update({
        payment_status: "paid",
        paid_at: new Date().toISOString(),
      })
      .eq("id", data.orderId)
      .eq("user_id", userId);

    await supabaseAdmin.from("notifications").insert({
      user_id: userId,
      title: "Payment successful",
      body: "Your payment was received. Your order is being processed.",
      category: "payment",
      data: { order_id: data.orderId },
    });

    return { ok: true, method };
  });

/**
 * Record a payment failure (called when Razorpay checkout reports failure).
 */
export const recordPaymentFailure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      razorpayOrderId: z.string().min(1),
      code: z.string().optional(),
      description: z.string().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await supabaseAdmin
      .from("payments")
      .update({
        status: "failed",
        error_code: data.code ?? "PAYMENT_FAILED",
        error_description: data.description ?? "Payment was not completed",
      })
      .eq("provider_order_id", data.razorpayOrderId)
      .eq("user_id", userId);

    await supabaseAdmin.from("notifications").insert({
      user_id: userId,
      title: "Payment failed",
      body: data.description ?? "Your payment did not go through.",
      category: "payment",
    });

    return { ok: true };
  });

/**
 * Admin-initiated refund. Calls Razorpay /payments/:id/refund then records.
 */
export const refundPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      paymentId: z.string().uuid(),
      amount: z.number().positive().optional(), // optional partial; defaults to full
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context; // user-scoped client respects RLS for admin check

    // Verify caller is admin via has_role RPC
    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin" as any,
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden");

    const { data: pay, error: payErr } = await supabaseAdmin
      .from("payments")
      .select("id, provider_payment_id, amount, status")
      .eq("id", data.paymentId)
      .single();
    if (payErr || !pay) throw new Error("Payment not found");
    if (pay.status !== "paid") throw new Error("Only paid payments can be refunded");
    if (!pay.provider_payment_id) throw new Error("Missing Razorpay payment id");

    const amount = data.amount ?? Number(pay.amount);
    const res = await fetch(`${RAZORPAY_API}/payments/${pay.provider_payment_id}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: basicAuth() },
      body: JSON.stringify({ amount: Math.round(amount * 100) }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.description || "Refund failed");

    const { error: rpcErr } = await supabaseAdmin.rpc("admin_record_refund", {
      _payment_id: pay.id,
      _refund_id: body.id,
      _amount: amount,
    });
    if (rpcErr) throw new Error(rpcErr.message);

    return { ok: true, refundId: body.id as string };
  });
