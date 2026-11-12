// Loads the Razorpay Checkout script and opens the modal.
declare global { interface Window { Razorpay?: any } }

let loadPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Razorpay) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Razorpay checkout"));
    document.head.appendChild(s);
  });
  return loadPromise;
}

export interface OpenCheckoutOpts {
  keyId: string;
  amount: number; // paise
  currency: string;
  razorpayOrderId: string;
  orderNumber: string;
  prefill?: { name?: string; email?: string; contact?: string };
  onSuccess: (resp: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
  onFailure: (err: { code?: string; description?: string }) => void;
  onDismiss?: () => void;
}

export async function openRazorpayCheckout(opts: OpenCheckoutOpts) {
  await loadScript();
  const rzp = new window.Razorpay({
    key: opts.keyId,
    amount: opts.amount,
    currency: opts.currency,
    order_id: opts.razorpayOrderId,
    name: "AP Mart",
    description: `Order ${opts.orderNumber}`,
    prefill: opts.prefill,
    theme: { color: "#A3E635" },
    method: { upi: true, card: true, netbanking: true, wallet: true, emi: false, paylater: false },
    handler: (resp: any) => opts.onSuccess(resp),
    modal: { ondismiss: () => opts.onDismiss?.() },
  });
  rzp.on("payment.failed", (resp: any) => {
    opts.onFailure({
      code: resp?.error?.code,
      description: resp?.error?.description,
    });
  });
  rzp.open();
}
