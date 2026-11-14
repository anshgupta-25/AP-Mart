import process from "node:process";

// Server-only: transactional emails (sign-up code + confirm link, password reset, welcome),
// sent through Resend with AP Mart branding. Table layout + inline styles so they render
// in Gmail, Outlook and phone mail apps.

const BRAND = {
  green: "#1f8a4c",
  greenInk: "#135c32",
  greenSoft: "#e8f5ec",
  bg: "#f3f6f3",
  card: "#ffffff",
  text: "#1c1f24",
  muted: "#6b7280",
  border: "#e5e7eb",
};

export type Email = { to: string; subject: string; html: string; text: string };

/** Send through Resend. Needs RESEND_API_KEY; EMAIL_FROM must use a domain verified in Resend. */
export async function sendEmail(email: Email): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  const from = process.env.EMAIL_FROM || "AP Mart <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [email.to],
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${body.slice(0, 300)}`);
  }
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function layout(opts: { site: string; preheader: string; body: string }) {
  const { site, preheader, body } = opts;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><title>AP Mart</title></head>
<body style="margin:0;padding:0;background:${BRAND.bg};-webkit-text-size-adjust:100%;">
<span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
    <tr><td style="padding:0 4px 20px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td><img src="${site}/apmart-logo.png" width="40" height="40" alt="" style="display:block;border-radius:10px;"></td>
        <td style="padding-left:10px;font:700 18px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${BRAND.text};">AP Mart</td>
      </tr></table>
    </td></tr>
    <tr><td style="background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:18px;padding:32px 28px;font:400 15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${BRAND.text};">
      ${body}
    </td></tr>
    <tr><td style="padding:20px 8px 0;font:400 12px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${BRAND.muted};text-align:center;">
      AP Mart · Groceries from shops near you<br>
      If you didn't request this, you can safely ignore this email.
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

const h1 = (t: string) =>
  `<h1 style="margin:0 0 8px;font:700 24px/1.25 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${BRAND.text};letter-spacing:-0.02em;">${t}</h1>`;
const p = (t: string) => `<p style="margin:0 0 16px;color:${BRAND.muted};">${t}</p>`;
const button = (href: string, label: string) => `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;"><tr>
<td style="border-radius:12px;background:${BRAND.green};">
<a href="${href}" style="display:inline-block;padding:14px 26px;font:600 15px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#ffffff;text-decoration:none;border-radius:12px;">${label}</a>
</td></tr></table>`;
const fallbackLink = (href: string) =>
  `<p style="margin:0;font-size:12px;color:${BRAND.muted};word-break:break-all;">Button not working? Paste this link into your browser:<br><a href="${href}" style="color:${BRAND.greenInk};">${esc(href)}</a></p>`;

export function confirmSignupEmail(o: {
  to: string;
  name: string;
  code: string;
  link: string;
  site: string;
}): Email {
  const hi = o.name ? `Hi ${esc(o.name.split(" ")[0])},` : "Hi,";
  const body = `
    ${h1("Confirm your email")}
    ${p(`${hi} enter this code in the AP Mart app to finish creating your account:`)}
    <div style="margin:4px 0 20px;padding:18px;background:${BRAND.greenSoft};border-radius:14px;text-align:center;">
      <div style="font:700 32px/1 'SF Mono',Menlo,Consolas,monospace;letter-spacing:8px;color:${BRAND.greenInk};">${esc(o.code)}</div>
      <div style="margin-top:8px;font-size:12px;color:${BRAND.muted};">This code expires in 1 hour.</div>
    </div>
    ${p("Or confirm with one tap:")}
    ${button(o.link, "Confirm my email")}
    ${fallbackLink(o.link)}`;
  return {
    to: o.to,
    subject: `${o.code} is your AP Mart verification code`,
    html: layout({ site: o.site, preheader: `Your AP Mart code is ${o.code}`, body }),
    text: `${hi}\n\nYour AP Mart verification code is ${o.code} (expires in 1 hour).\n\nOr confirm your email here: ${o.link}\n\nIf you didn't sign up, ignore this email.`,
  };
}

export function resetPasswordEmail(o: { to: string; link: string; site: string }): Email {
  const body = `
    ${h1("Reset your password")}
    ${p("We got a request to reset the password for your AP Mart account. Tap the button below to choose a new one.")}
    ${button(o.link, "Reset my password")}
    ${p("This link is valid for 1 hour and can be used once.")}
    ${fallbackLink(o.link)}`;
  return {
    to: o.to,
    subject: "Reset your AP Mart password",
    html: layout({
      site: o.site,
      preheader: "Choose a new password for your AP Mart account",
      body,
    }),
    text: `Reset your AP Mart password: ${o.link}\n\nThis link is valid for 1 hour and can be used once. If you didn't ask for this, ignore this email.`,
  };
}

export function welcomeEmail(o: { to: string; name: string; site: string }): Email {
  const first = o.name ? esc(o.name.split(" ")[0]) : "there";
  const shop = `${o.site}/customer/home`;
  const row = (icon: string, title: string, sub: string) => `
    <tr><td style="padding:10px 0;vertical-align:top;width:40px;font-size:22px;">${icon}</td>
    <td style="padding:10px 0;"><div style="font-weight:600;color:${BRAND.text};">${title}</div>
    <div style="font-size:13px;color:${BRAND.muted};">${sub}</div></td></tr>`;
  const body = `
    ${h1(`Welcome to AP Mart, ${first}! 🎉`)}
    ${p("Your account is ready. Fresh groceries and daily essentials from trusted shops in your neighbourhood, delivered to your door.")}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 16px;">
      ${row("📍", "Add your delivery address", "See the shops that deliver to you.")}
      ${row("🛒", "Fill your cart", "Fruits, vegetables, dairy, snacks and more.")}
      ${row("🚚", "Track your order", "Live updates from the shop to your door.")}
    </table>
    ${button(shop, "Start shopping")}`;
  return {
    to: o.to,
    subject: "Welcome to AP Mart 🎉",
    html: layout({ site: o.site, preheader: "Your AP Mart account is ready", body }),
    text: `Welcome to AP Mart, ${o.name || "there"}!\n\nYour account is ready. Start shopping: ${shop}`,
  };
}
