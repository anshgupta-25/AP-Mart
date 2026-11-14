import process from "node:process";
import { EMAIL_LOGO_PNG_BASE64 } from "./emailLogo.server";

// Server-only: AP Mart transactional emails (sign-up code + confirm link, password reset,
// welcome) sent through Resend. Email-safe HTML: table layout, inline styles, solid-colour
// fallbacks behind gradients, logo embedded as an inline (cid) image.

const C = {
  green: "#1f8a4c",
  greenDark: "#156b3a",
  greenInk: "#135c32",
  greenSoft: "#e9f6ee",
  mint: "#f1faf4",
  sun: "#fff6e0",
  sky: "#e8f3ff",
  rose: "#ffecef",
  bg: "#eef4ef",
  card: "#ffffff",
  text: "#14181f",
  body: "#3d4450",
  muted: "#6b7280",
  border: "#e6ebe7",
};
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

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
      attachments: [
        { filename: "apmart-logo.png", content: EMAIL_LOGO_PNG_BASE64, content_id: "apmart-logo" },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${body.slice(0, 300)}`);
  }
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ---------------------------------------------------------------------------- layout

function layout(o: { site: string; preheader: string; hero: string; body: string; to: string }) {
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>AP Mart</title>
<style>
  @media (max-width:600px){ .px{padding-left:22px!important;padding-right:22px!important} .h1{font-size:24px!important} .digit{width:30px!important;font-size:22px!important} .stack{display:block!important;width:100%!important} }
  a{text-decoration:none}
</style></head>
<body style="margin:0;padding:0;background:${C.bg};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(o.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.bg}" style="background:${C.bg};">
<tr><td align="center" style="padding:28px 12px 40px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

    <!-- brand header -->
    <tr><td bgcolor="${C.green}" style="background:${C.green};background-image:linear-gradient(135deg,#2aa35d 0%,${C.green} 55%,${C.greenDark} 100%);border-radius:22px 22px 0 0;padding:22px 28px;" class="px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:middle;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="background:#ffffff;border-radius:14px;padding:5px;"><img src="cid:apmart-logo" width="38" height="38" alt="AP Mart" style="display:block;border-radius:10px;"></td>
            <td style="padding-left:12px;font:800 20px/1 ${FONT};color:#ffffff;letter-spacing:-0.02em;">AP Mart</td>
          </tr></table>
        </td>
        <td align="right" style="vertical-align:middle;font:600 12px/1.3 ${FONT};color:#d6f2e0;">Groceries from<br>shops near you</td>
      </tr></table>
    </td></tr>

    <!-- hero -->
    ${o.hero}

    <!-- content -->
    <tr><td bgcolor="${C.card}" style="background:${C.card};padding:8px 36px 34px;border-radius:0 0 22px 22px;font:400 15px/1.65 ${FONT};color:${C.body};" class="px">
      ${o.body}
    </td></tr>

    <!-- footer -->
    <tr><td align="center" style="padding:26px 20px 0;font:400 12px/1.7 ${FONT};color:${C.muted};">
      <a href="${o.site}/customer/home" style="color:${C.greenInk};font-weight:600;">Shop</a>
      &nbsp;·&nbsp;<a href="${o.site}/customer/orders" style="color:${C.greenInk};font-weight:600;">My orders</a>
      &nbsp;·&nbsp;<a href="${o.site}/customer/profile" style="color:${C.greenInk};font-weight:600;">Help &amp; support</a>
      <div style="margin-top:12px;">This email was sent to <span style="color:${C.body};">${esc(o.to)}</span>.</div>
      <div>AP Mart · Fresh groceries from trusted local shops</div>
    </td></tr>

  </table>
</td></tr></table>
</body></html>`;
}

/** White hero block with a big tinted icon circle, title and subtitle. */
function hero(o: { icon: string; tint: string; title: string; subtitle: string }) {
  return `<tr><td bgcolor="${C.card}" align="center" style="background:${C.card};padding:36px 36px 18px;" class="px">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td align="center" width="76" height="76" bgcolor="${o.tint}" style="background:${o.tint};border-radius:38px;font-size:36px;line-height:76px;">${o.icon}</td>
    </tr></table>
    <h1 class="h1" style="margin:20px 0 8px;font:800 27px/1.2 ${FONT};color:${C.text};letter-spacing:-0.025em;">${o.title}</h1>
    <p style="margin:0;font:400 15px/1.6 ${FONT};color:${C.muted};max-width:420px;">${o.subtitle}</p>
  </td></tr>`;
}

/** Bulletproof full-width-ish button. */
function button(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:26px auto 8px;"><tr>
    <td align="center" bgcolor="${C.green}" style="background:${C.green};background-image:linear-gradient(135deg,#2aa35d,${C.green});border-radius:14px;box-shadow:0 6px 16px rgba(31,138,76,0.28);">
      <a href="${href}" style="display:inline-block;padding:16px 40px;font:700 16px/1 ${FONT};color:#ffffff;border-radius:14px;letter-spacing:0.01em;">${label}&nbsp;&nbsp;&rarr;</a>
    </td></tr></table>`;
}

function badge(text: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:6px auto 0;"><tr>
    <td bgcolor="${C.sun}" style="background:${C.sun};border-radius:999px;padding:7px 14px;font:600 12px/1 ${FONT};color:#8a5a00;">⏱&nbsp; ${text}</td>
  </tr></table>`;
}

function note(icon: string, html: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:26px;"><tr>
    <td bgcolor="${C.mint}" style="background:${C.mint};border:1px solid ${C.border};border-radius:14px;padding:14px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:top;font-size:18px;padding-right:10px;">${icon}</td>
        <td style="font:400 13px/1.6 ${FONT};color:${C.body};">${html}</td>
      </tr></table>
    </td></tr></table>`;
}

function fallbackLink(href: string) {
  return `<p style="margin:22px 0 0;font:400 12px/1.6 ${FONT};color:${C.muted};text-align:center;word-break:break-all;">
    Button not working? Copy this link into your browser:<br>
    <a href="${href}" style="color:${C.greenInk};">${esc(href)}</a></p>`;
}

const divider = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:26px 0 0;"><tr><td style="border-top:1px solid ${C.border};font-size:0;line-height:0;">&nbsp;</td></tr></table>`;

/** The code as individual digit tiles. */
function codeTiles(code: string) {
  const cells = code
    .split("")
    .map(
      (d) =>
        `<td class="digit" width="38" align="center" bgcolor="${C.card}" style="background:${C.card};border:1.5px solid #cfe9d9;border-radius:10px;font:800 26px/52px 'SF Mono',Menlo,Consolas,monospace;color:${C.greenInk};width:38px;height:52px;">${esc(d)}</td>`,
    )
    .join(`<td width="6" style="width:6px;font-size:0;">&nbsp;</td>`);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;"><tr>
    <td bgcolor="${C.greenSoft}" align="center" style="background:${C.greenSoft};border-radius:18px;padding:22px 10px 18px;">
      <div style="font:700 11px/1 ${FONT};color:${C.greenInk};letter-spacing:0.14em;text-transform:uppercase;margin-bottom:14px;">Your verification code</div>
      <table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr>${cells}</tr></table>
    </td></tr></table>`;
}

// ---------------------------------------------------------------------------- emails

export function confirmSignupEmail(o: {
  to: string;
  name: string;
  code: string;
  link: string;
  site: string;
}): Email {
  const first = o.name ? esc(o.name.split(" ")[0]) : "";
  const body = `
    ${codeTiles(o.code)}
    ${badge("Expires in 1 hour")}
    <p style="margin:24px 0 0;text-align:center;color:${C.muted};font-size:14px;">Prefer one tap? Confirm straight from here:</p>
    ${button(o.link, "Confirm my email")}
    ${fallbackLink(o.link)}
    ${note("🔒", `<b style="color:${C.text};">Keep this code private.</b> AP Mart will never ask for it on a call or message. Didn't sign up? You can safely ignore this email.`)}`;
  return {
    to: o.to,
    subject: `${o.code} is your AP Mart verification code`,
    html: layout({
      site: o.site,
      to: o.to,
      preheader: `Your AP Mart verification code is ${o.code}. It expires in 1 hour.`,
      hero: hero({
        icon: "✉️",
        tint: C.greenSoft,
        title: first ? `Almost there, ${first}!` : "Confirm your email",
        subtitle: "Enter this code in the AP Mart app to finish creating your account.",
      }),
      body,
    }),
    text: `${first ? `Hi ${first},\n\n` : ""}Your AP Mart verification code is ${o.code} (expires in 1 hour).\n\nOr confirm your email here: ${o.link}\n\nKeep this code private. Didn't sign up? Ignore this email.`,
  };
}

export function resetPasswordEmail(o: { to: string; link: string; site: string }): Email {
  const body = `
    <p style="margin:18px 0 0;text-align:center;">We received a request to reset the password for <b style="color:${C.text};">${esc(o.to)}</b>. Tap the button below to choose a new one.</p>
    ${button(o.link, "Reset my password")}
    ${badge("Valid for 1 hour · single use")}
    ${fallbackLink(o.link)}
    ${note("🛡️", `<b style="color:${C.text};">Didn't ask for this?</b> Your password hasn't changed and your account is safe. You can ignore this email.`)}`;
  return {
    to: o.to,
    subject: "Reset your AP Mart password",
    html: layout({
      site: o.site,
      to: o.to,
      preheader: "Choose a new password for your AP Mart account. The link is valid for 1 hour.",
      hero: hero({
        icon: "🔑",
        tint: C.sun,
        title: "Reset your password",
        subtitle: "Locked out? No worries, it happens to the best of us.",
      }),
      body,
    }),
    text: `Reset your AP Mart password: ${o.link}\n\nThe link is valid for 1 hour and can be used once. Didn't ask for this? Your password hasn't changed; ignore this email.`,
  };
}

export function welcomeEmail(o: { to: string; name: string; site: string }): Email {
  const first = o.name ? esc(o.name.split(" ")[0]) : "there";
  const shop = `${o.site}/customer/home`;
  const feature = (icon: string, tint: string, title: string, sub: string) => `
    <td class="stack" width="33%" valign="top" style="padding:6px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td bgcolor="${tint}" align="center" style="background:${tint};border-radius:16px;padding:20px 12px;">
          <div style="font-size:30px;line-height:1;">${icon}</div>
          <div style="margin-top:10px;font:700 14px/1.3 ${FONT};color:${C.text};">${title}</div>
          <div style="margin-top:4px;font:400 12px/1.5 ${FONT};color:${C.muted};">${sub}</div>
        </td></tr></table>
    </td>`;
  const step = (n: string, title: string, sub: string) => `
    <tr><td style="padding:9px 0;vertical-align:top;width:44px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="30" height="30" align="center" bgcolor="${C.green}" style="background:${C.green};border-radius:15px;font:800 13px/30px ${FONT};color:#fff;">${n}</td></tr></table>
    </td><td style="padding:9px 0;">
      <div style="font:700 15px/1.3 ${FONT};color:${C.text};">${title}</div>
      <div style="font:400 13px/1.5 ${FONT};color:${C.muted};">${sub}</div>
    </td></tr>`;

  const welcomeHero = `<tr><td bgcolor="${C.card}" style="background:${C.card};padding:0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td bgcolor="${C.greenSoft}" align="center" style="background:${C.greenSoft};background-image:linear-gradient(180deg,#e2f5e9 0%,#ffffff 100%);padding:38px 32px 26px;" class="px">
        <div style="font-size:46px;line-height:1;letter-spacing:6px;">🥦🍎🥛🛒</div>
        <h1 class="h1" style="margin:20px 0 8px;font:800 30px/1.15 ${FONT};color:${C.text};letter-spacing:-0.03em;">Welcome to AP Mart, ${first}! 🎉</h1>
        <p style="margin:0 auto;max-width:430px;font:400 15px/1.6 ${FONT};color:${C.body};">Your account is ready. Fresh groceries and daily essentials from trusted shops in your neighbourhood, delivered to your door.</p>
      </td></tr></table>
  </td></tr>`;

  const body = `
    ${button(shop, "Start shopping")}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;"><tr>
      ${feature("🏪", C.mint, "Local shops", "Order from trusted stores near you")}
      ${feature("🥬", C.sun, "Always fresh", "Fruits, veggies, dairy &amp; more")}
      ${feature("🚚", C.sky, "Live tracking", "From the shop to your doorstep")}
    </tr></table>
    ${divider}
    <h2 style="margin:24px 0 6px;font:800 18px/1.3 ${FONT};color:${C.text};letter-spacing:-0.01em;">Get started in 3 steps</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${step("1", "Add your delivery address", "So we can show the shops that deliver to you.")}
      ${step("2", "Fill your cart", "Browse categories or search for anything you need.")}
      ${step("3", "Check out &amp; relax", "Pay online or cash on delivery, then track your order live.")}
    </table>
    ${note("💚", `Questions? We're here to help. Open <a href="${o.site}/customer/profile" style="color:${C.greenInk};font-weight:600;">Help &amp; support</a> in the app anytime.`)}`;

  return {
    to: o.to,
    subject: `Welcome to AP Mart, ${o.name ? o.name.split(" ")[0] : "friend"}! 🎉`,
    html: layout({
      site: o.site,
      to: o.to,
      preheader: "Your AP Mart account is ready. Here's how to get started.",
      hero: welcomeHero,
      body,
    }),
    text: `Welcome to AP Mart, ${o.name || "there"}!\n\nYour account is ready. Start shopping: ${shop}\n\n1. Add your delivery address\n2. Fill your cart\n3. Check out and track your order live`,
  };
}
